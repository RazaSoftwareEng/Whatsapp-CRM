import requests
from django.conf import settings
from django.db.models import F
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsAdmin, IsManager, IsTL

from .models import Chat, Lead, Message, Tag
from .serializers import ChatDetailSerializer, ChatSerializer, LeadSerializer, MessageSerializer, TagSerializer
from .services import send_whatsapp_template, send_whatsapp_text

MANAGER_LEAD_SOURCE = "manager"


def _normalize_phone(raw: str) -> str:
    """Strip everything but digits — WhatsApp's Cloud API rejects a "to" number
    with spaces, dashes, or a leading "+" ("phone number is malformed")."""
    return "".join(ch for ch in raw if ch.isdigit())


class IsAdminOrTLOrOwnChat(permissions.BasePermission):
    """Admin: full access. TL: every chat except manager-started ones (those are
    private to the manager who started them, and admin). Agent/Manager: only
    chats assigned to them."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == "admin":
            return True
        if user.role == "tl":
            return obj.lead.source != MANAGER_LEAD_SOURCE
        return obj.assigned_user_id == user.id


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]


class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all()
    serializer_class = LeadSerializer
    permission_classes = [permissions.IsAuthenticated]


class ChatViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrTLOrOwnChat]

    def get_queryset(self):
        user = self.request.user
        qs = (
            Chat.objects.select_related("lead", "assigned_user")
            .prefetch_related("lead__tags", "messages")
            .order_by(F("last_message_at").desc(nulls_last=True))
        )
        if user.role == "admin":
            return qs
        if user.role == "tl":
            return qs.exclude(lead__source=MANAGER_LEAD_SOURCE)
        return qs.filter(assigned_user=user)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ChatDetailSerializer
        return ChatSerializer

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        """Mark this chat as read by the current viewer."""
        chat = self.get_object()
        chat.last_read_at = timezone.now()
        chat.save(update_fields=["last_read_at"])
        return Response(ChatSerializer(chat).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdmin | IsTL])
    def assign(self, request, pk=None):
        """Admin: assign (or unassign with user_id=null) any chat to any agent.

        TL: same, but limited to their own team — the chat must currently be
        unassigned or already owned by their team, and the target agent (if
        assigning, not unassigning) must report to them.
        """
        chat = self.get_object()
        user_id = request.data.get("user_id")
        requester = request.user

        if requester.role == "tl":
            current_owner = chat.assigned_user
            if current_owner is not None and current_owner.id != requester.id and current_owner.team_lead_id != requester.id:
                return Response({"detail": "This chat belongs to another team."}, status=403)
            if user_id:
                target = User.objects.filter(id=user_id).first()
                if not target or target.team_lead_id != requester.id:
                    return Response({"detail": "You can only assign chats to your own agents."}, status=403)

        chat.assigned_user_id = user_id
        chat.status = Chat.Status.IN_PROGRESS if user_id else Chat.Status.UNASSIGNED
        chat.save(update_fields=["assigned_user", "status"])
        return Response(ChatSerializer(chat).data)

    def _get_or_create_lead_and_chat(self, request, source):
        """Shared by start/start_with_template: upsert the Lead by phone number,
        then get-or-create its Chat and (re)claim it for the requesting user."""
        phone_number = _normalize_phone(request.data.get("phone_number") or "")
        if not phone_number:
            return None, None, Response({"detail": "phone_number is required."}, status=400)

        lead_fields = {
            "name": (request.data.get("name") or "").strip(),
            "company_name": (request.data.get("company_name") or "").strip(),
            "email": (request.data.get("email") or "").strip(),
            "client_status": request.data.get("client_status") or Lead.ClientStatus.FIRST_TIME,
            "source": source,
        }
        lead, created = Lead.objects.get_or_create(phone_number=phone_number, defaults=lead_fields)
        if not created:
            for field, value in lead_fields.items():
                if value and field != "source":
                    setattr(lead, field, value)
            lead.save()

        chat, chat_created = Chat.objects.get_or_create(
            lead=lead, defaults={"assigned_user": request.user, "status": Chat.Status.IN_PROGRESS}
        )
        if not chat_created and chat.assigned_user_id is None:
            chat.assigned_user = request.user
            chat.status = Chat.Status.IN_PROGRESS
            chat.save(update_fields=["assigned_user", "status"])

        return lead, chat, None

    @action(detail=False, methods=["post"])
    def start(self, request):
        """Admin/TL/agent: add a new contact and start (or claim) its chat."""
        _, chat, error = self._get_or_create_lead_and_chat(request, source="manual")
        if error:
            return error
        return Response(ChatSerializer(chat).data, status=201)

    @action(
        detail=False,
        methods=["post"],
        url_path="start-with-template",
        permission_classes=[permissions.IsAuthenticated, IsManager | IsAdmin],
    )
    def start_with_template(self, request):
        """Manager/Admin: add a brand-new contact and open the chat with our
        approved first-contact template (required — WhatsApp rejects a plain-
        text first message to someone who hasn't messaged us before). The
        resulting chat is tagged so it stays private to this manager + admin
        (see IsAdminOrTLOrOwnChat and the TL/agent querysets above)."""
        lead, chat, error = self._get_or_create_lead_and_chat(request, source=MANAGER_LEAD_SOURCE)
        if error:
            return error

        template_name = settings.WHATSAPP_FIRST_CONTACT_TEMPLATE_NAME
        template_body = (
            "Hi, this is Al Merak Tax Consultant. We're reaching out regarding your inquiry. "
            "Reply to this message and we'll assist you right away."
        )
        message = Message.objects.create(
            chat=chat,
            direction=Message.Direction.OUT,
            body=template_body,
            delivery_status=Message.DeliveryStatus.PENDING,
        )
        print(f"[start_with_template] to={lead.phone_number!r} name={template_name!r} "
              f"lang={settings.WHATSAPP_FIRST_CONTACT_TEMPLATE_LANGUAGE!r}", flush=True)
        try:
            result = send_whatsapp_template(
                lead.phone_number, template_name, settings.WHATSAPP_FIRST_CONTACT_TEMPLATE_LANGUAGE
            )
            message.wa_message_id = result.get("messages", [{}])[0].get("id", "")
            message.delivery_status = Message.DeliveryStatus.SENT
        except requests.RequestException as exc:
            body = exc.response.text if exc.response is not None else str(exc)
            print(f"[start_with_template] FAILED: {body}", flush=True)
            message.delivery_status = Message.DeliveryStatus.FAILED
        message.save(update_fields=["wa_message_id", "delivery_status"])

        chat.last_message_at = timezone.now()
        chat.save(update_fields=["last_message_at"])
        return Response(ChatDetailSerializer(chat).data, status=201)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Message.objects.select_related("chat", "chat__lead")
        if user.role == "admin":
            return qs
        if user.role == "tl":
            return qs.exclude(chat__lead__source=MANAGER_LEAD_SOURCE)
        return qs.filter(chat__assigned_user=user)

    def perform_create(self, serializer):
        """Agent/admin reply: save as outbound, then push it to WhatsApp via Meta."""
        message = serializer.save(
            direction=Message.Direction.OUT,
            delivery_status=Message.DeliveryStatus.PENDING,
        )
        try:
            result = send_whatsapp_text(message.chat.lead.phone_number, message.body)
            message.wa_message_id = result.get("messages", [{}])[0].get("id", "")
            message.delivery_status = Message.DeliveryStatus.SENT
        except requests.RequestException:
            message.delivery_status = Message.DeliveryStatus.FAILED
        message.save(update_fields=["wa_message_id", "delivery_status"])
