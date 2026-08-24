import requests
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdmin

from .models import Chat, Lead, Message, Tag
from .serializers import ChatDetailSerializer, ChatSerializer, LeadSerializer, MessageSerializer, TagSerializer
from .services import send_whatsapp_text


class IsAdminOrTLOrOwnChat(permissions.BasePermission):
    """Admin: full access. TL: chats owned by their team. Agent: only chats assigned to them."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == "admin":
            return True
        if user.role == "tl":
            return obj.assigned_user_id == user.id or (
                obj.assigned_user_id is not None and obj.assigned_user.team_lead_id == user.id
            )
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
        qs = Chat.objects.select_related("lead", "assigned_user")
        if user.role == "admin":
            return qs
        if user.role == "tl":
            return qs.filter(Q(assigned_user=user) | Q(assigned_user__team_lead=user))
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

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def assign(self, request, pk=None):
        """Admin-only: assign (or unassign with user_id=null) a chat to an agent."""
        chat = self.get_object()
        user_id = request.data.get("user_id")
        chat.assigned_user_id = user_id
        chat.status = Chat.Status.IN_PROGRESS if user_id else Chat.Status.UNASSIGNED
        chat.save(update_fields=["assigned_user", "status"])
        return Response(ChatSerializer(chat).data)

    @action(detail=False, methods=["post"])
    def start(self, request):
        """Admin/TL/agent: add a new contact and start (or claim) its chat."""
        phone_number = (request.data.get("phone_number") or "").strip()
        if not phone_number:
            return Response({"detail": "phone_number is required."}, status=400)

        lead_fields = {
            "name": (request.data.get("name") or "").strip(),
            "company_name": (request.data.get("company_name") or "").strip(),
            "email": (request.data.get("email") or "").strip(),
            "client_status": request.data.get("client_status") or Lead.ClientStatus.FIRST_TIME,
            "source": "manual",
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

        return Response(ChatSerializer(chat).data, status=201)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Message.objects.select_related("chat")
        if user.role == "admin":
            return qs
        if user.role == "tl":
            return qs.filter(Q(chat__assigned_user=user) | Q(chat__assigned_user__team_lead=user))
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
