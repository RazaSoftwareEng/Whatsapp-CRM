from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsAdmin, IsCompanyUser, IsManager

from .geo import geolocate, get_client_ip
from .models import Company, Proposal, ProposalActivityLog
from .permissions import CanActOnProposal
from .serializers import (
    CompanySearchSerializer,
    CompanySerializer,
    ProposalActionSerializer,
    ProposalActivityLogSerializer,
    ProposalCreateSerializer,
    ProposalSerializer,
)
from .services import ensure_company_user, send_invite, send_proposal_review_email

STATUS_ACTION_MAP = {
    "approve": (Proposal.Status.APPROVED, ProposalActivityLog.Action.APPROVED),
    "reject": (Proposal.Status.REJECTED, ProposalActivityLog.Action.REJECTED),
    "request-changes": (Proposal.Status.CHANGES_REQUESTED, ProposalActivityLog.Action.CHANGES_REQUESTED),
}


def apply_proposal_decision(proposal, new_status, action_name, *, actor=None, note="", ip_address="", location=""):
    """Shared by the authenticated (ProposalViewSet) and public (ReviewActionView) paths so
    every approve/reject/request-changes decision is logged the same way, IP/location included."""
    proposal.status = new_status
    proposal.save(update_fields=["status"])
    ProposalActivityLog.objects.create(
        proposal=proposal,
        actor=actor,
        action=action_name,
        note=note,
        ip_address=ip_address or None,
        location=location,
    )


class CompanyViewSet(viewsets.ModelViewSet):
    """Companies are shared/global across all Managers — one real company, one row."""

    queryset = Company.objects.all()

    def get_queryset(self):
        qs = Company.objects.all()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(company_name__icontains=search) | qs.filter(email__icontains=search)
        return qs

    def get_serializer_class(self):
        if self.action == "list" and self.request.query_params.get("search"):
            return CompanySearchSerializer
        return CompanySerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated(), (IsManager | IsAdmin)()]
        return [IsAdmin()]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete a company with existing proposals. Set it Inactive instead."},
                status=400,
            )


class ProposalViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        user = self.request.user
        qs = Proposal.objects.select_related("company", "created_by")
        if user.role == "admin":
            return qs
        if user.role == "manager":
            return qs.filter(created_by=user)
        if user.role == "company_user":
            return qs.filter(company=user.company)
        return qs.none()

    def get_serializer_class(self):
        if self.action == "create":
            return ProposalCreateSerializer
        return ProposalSerializer

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated(), (IsManager | IsAdmin)()]
        if self.action in ("approve", "reject", "request_changes", "send"):
            return [permissions.IsAuthenticated(), CanActOnProposal()]
        if self.action == "dashboard":
            return [permissions.IsAuthenticated(), (IsManager | IsAdmin)()]
        return [permissions.IsAuthenticated(), (IsManager | IsAdmin | IsCompanyUser)()]

    def _resolve_company(self, validated_data):
        """Resolve the company for a new proposal — by explicit id if the manager picked
        one from search, otherwise by email (one email = one company, so an email that
        already exists reuses that company and re-syncs its contact info instead of
        erroring — the manager may not have used the search box at all)."""
        company = validated_data.pop("company", None)
        company_name = validated_data.pop("company_name", "")
        contact_person = validated_data.pop("contact_person", "")
        email = validated_data.pop("email", "")
        phone = validated_data.pop("phone", "")

        if company:
            # Re-sync in case the manager tweaked the autofilled fields after picking a match.
            changed = {}
            if company_name and company.company_name != company_name:
                changed["company_name"] = company_name
            if contact_person and company.contact_person != contact_person:
                changed["contact_person"] = contact_person
            if phone and company.phone != phone:
                changed["phone"] = phone
            if changed:
                for field, value in changed.items():
                    setattr(company, field, value)
                company.save(update_fields=list(changed))
            return company, False

        try:
            with transaction.atomic():
                return (
                    Company.objects.create(
                        company_name=company_name,
                        contact_person=contact_person,
                        email=email,
                        phone=phone,
                        created_by=self.request.user,
                    ),
                    True,
                )
        except IntegrityError:
            existing = Company.objects.get(email__iexact=email)
            existing.company_name = company_name
            existing.contact_person = contact_person
            existing.phone = phone
            existing.save(update_fields=["company_name", "contact_person", "phone"])
            return existing, False

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = dict(serializer.validated_data)

        with transaction.atomic():
            company, company_created = self._resolve_company(validated)

            response_extra = {}
            if company_created:
                user, user_created = ensure_company_user(company)
                if user_created:
                    try:
                        response_extra.update(send_invite(user))
                    except Exception as exc:  # noqa: BLE001 — mail backend errors aren't a single narrow class
                        response_extra["invite_warning"] = str(exc)

            proposal = Proposal.objects.create(
                title=validated["title"],
                message=validated["message"],
                company=company,
                created_by=request.user,
            )
            ProposalActivityLog.objects.create(proposal=proposal, actor=request.user, action="created")

            try:
                send_proposal_review_email(proposal)
                proposal.status = Proposal.Status.PENDING_REVIEW
                proposal.last_email_error = ""
                proposal.save(update_fields=["status", "last_email_error"])
                ProposalActivityLog.objects.create(proposal=proposal, actor=request.user, action="sent")
            except Exception as exc:  # noqa: BLE001
                proposal.last_email_error = str(exc)
                proposal.save(update_fields=["last_email_error"])
                response_extra["email_warning"] = str(exc)

        data = ProposalSerializer(proposal).data
        data.update(response_extra)
        return Response(data, status=201)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        """(Re)send the proposal review email — allowed from any status, e.g. the client
        says they never got it. Draft/changes_requested also move to pending_review since
        this is what starts (or restarts) their review clock; other statuses are left as-is
        so a courtesy resend can't silently undo an approve/reject decision."""
        proposal = self.get_object()
        try:
            send_proposal_review_email(proposal)
            update_fields = ["last_email_error"]
            proposal.last_email_error = ""
            if proposal.status in (Proposal.Status.DRAFT, Proposal.Status.CHANGES_REQUESTED):
                proposal.status = Proposal.Status.PENDING_REVIEW
                update_fields.append("status")
            proposal.save(update_fields=update_fields)
            ProposalActivityLog.objects.create(proposal=proposal, actor=request.user, action="resent")
            return Response(ProposalSerializer(proposal).data)
        except Exception as exc:  # noqa: BLE001
            proposal.last_email_error = str(exc)
            proposal.save(update_fields=["last_email_error"])
            data = ProposalSerializer(proposal).data
            data["email_warning"] = str(exc)
            return Response(data)

    def _transition(self, request, pk, new_status, action_name):
        proposal = self.get_object()
        if proposal.status != Proposal.Status.PENDING_REVIEW:
            raise ValidationError({"detail": "Only a proposal pending review can be acted on."})
        note_serializer = ProposalActionSerializer(data=request.data)
        note_serializer.is_valid(raise_exception=True)
        ip = get_client_ip(request)
        apply_proposal_decision(
            proposal,
            new_status,
            action_name,
            actor=request.user,
            note=note_serializer.validated_data["note"],
            ip_address=ip,
            location=geolocate(ip),
        )
        return Response(ProposalSerializer(proposal).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._transition(request, pk, Proposal.Status.APPROVED, "approved")

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._transition(request, pk, Proposal.Status.REJECTED, "rejected")

    @action(detail=True, methods=["post"], url_path="request-changes")
    def request_changes(self, request, pk=None):
        return self._transition(request, pk, Proposal.Status.CHANGES_REQUESTED, "changes_requested")

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        qs = self.get_queryset()
        return Response(
            {
                "total": qs.count(),
                "pending_review": qs.filter(status=Proposal.Status.PENDING_REVIEW).count(),
                "approved": qs.filter(status=Proposal.Status.APPROVED).count(),
                "rejected": qs.filter(status=Proposal.Status.REJECTED).count(),
                "changes_requested": qs.filter(status=Proposal.Status.CHANGES_REQUESTED).count(),
            }
        )

    @action(detail=False, methods=["get"])
    def activity(self, request):
        qs = ProposalActivityLog.objects.select_related("proposal", "actor").filter(
            proposal__in=self.get_queryset()
        )
        proposal_id = request.query_params.get("proposal")
        if proposal_id:
            qs = qs.filter(proposal_id=proposal_id)
        limit = int(request.query_params.get("limit", 10))
        return Response(ProposalActivityLogSerializer(qs[:limit], many=True).data)


class InviteInfoView(APIView):
    """Public: lets the setup-password page show who this invite is for."""

    permission_classes = [AllowAny]

    def get(self, request, token):
        user = User.objects.filter(invite_token=token, invite_token_expires_at__gt=timezone.now()).first()
        if not user:
            return Response({"detail": "This invite link is invalid or has expired."}, status=400)
        return Response({"company_name": user.company.company_name if user.company else "", "email": user.email})


class InviteSetPasswordView(APIView):
    """Public: completes the invite flow by letting the user choose a password."""

    permission_classes = [AllowAny]

    def post(self, request, token):
        user = User.objects.filter(invite_token=token, invite_token_expires_at__gt=timezone.now()).first()
        if not user:
            return Response({"detail": "This invite link is invalid or has expired."}, status=400)

        password = request.data.get("password") or ""
        confirm_password = request.data.get("confirm_password") or ""
        if password != confirm_password:
            return Response({"detail": "Passwords do not match."}, status=400)
        try:
            password_validation.validate_password(password, user)
        except DjangoValidationError as exc:
            return Response({"detail": " ".join(exc.messages)}, status=400)

        user.set_password(password)
        user.is_active = True
        user.invite_token = ""
        user.invite_token_expires_at = None
        user.save(update_fields=["password", "is_active", "invite_token", "invite_token_expires_at"])
        return Response({"detail": "Password set. You can now log in."})


class ReviewInfoView(APIView):
    """Public: the shared review link — no login required to view a proposal."""

    permission_classes = [AllowAny]

    def get(self, request, token):
        proposal = get_object_or_404(Proposal, review_token=token)
        return Response(ProposalSerializer(proposal).data)


class ReviewActionView(APIView):
    """Public: approve/reject/request-changes from the shared review link. Identity here is
    the IP/location pair (no account required), not an authenticated actor."""

    permission_classes = [AllowAny]

    def post(self, request, token, action):
        if action not in STATUS_ACTION_MAP:
            return Response({"detail": "Unknown action."}, status=404)
        proposal = get_object_or_404(Proposal, review_token=token)
        if proposal.status != Proposal.Status.PENDING_REVIEW:
            return Response({"detail": "This proposal has already been actioned."}, status=400)
        if not request.data.get("confirmed"):
            return Response({"detail": "Please check the confirmation box before continuing."}, status=400)

        new_status, action_name = STATUS_ACTION_MAP[action]
        ip = get_client_ip(request)
        apply_proposal_decision(
            proposal,
            new_status,
            action_name,
            actor=None,
            note=(request.data.get("note") or "").strip(),
            ip_address=ip,
            location=geolocate(ip),
        )
        return Response(ProposalSerializer(proposal).data)
