import mimetypes
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from leads.models import Chat, Lead, Message
from leads.services import download_whatsapp_media

MEDIA_TYPE_LABELS = {
    "image": "Image",
    "video": "Video",
    "audio": "Audio",
    "document": "Document",
    "sticker": "Sticker",
}


class WhatsAppWebhookView(APIView):
    """Meta Cloud API webhook: verification handshake (GET) + inbound events (POST)."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if (
            request.GET.get("hub.mode") == "subscribe"
            and request.GET.get("hub.verify_token") == settings.WHATSAPP_VERIFY_TOKEN
        ):
            return HttpResponse(request.GET.get("hub.challenge", ""), content_type="text/plain")
        return HttpResponse(status=403)

    def post(self, request):
        for entry in request.data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                self._handle_messages(value)
                self._handle_statuses(value)
        return Response({"status": "ok"})

    def _handle_messages(self, value):
        contacts = {c["wa_id"]: c.get("profile", {}).get("name", "") for c in value.get("contacts", [])}
        for msg in value.get("messages", []):
            wa_id = msg["from"]
            lead, _ = Lead.objects.get_or_create(
                phone_number=wa_id,
                defaults={"name": contacts.get(wa_id, ""), "source": "whatsapp"},
            )
            chat, _ = Chat.objects.get_or_create(lead=lead)
            body, media_url = self._extract_content(msg)
            Message.objects.create(
                chat=chat,
                direction=Message.Direction.IN,
                body=body,
                media_url=media_url,
                wa_message_id=msg.get("id", ""),
                delivery_status=Message.DeliveryStatus.DELIVERED,
            )
            chat.last_message_at = timezone.now()
            chat.save(update_fields=["last_message_at"])

    def _extract_content(self, msg) -> tuple[str, str]:
        """Turn one inbound Cloud API message into (body text, media URL).

        Text messages just pass the body through. Media messages (image,
        video, audio, document, sticker) are downloaded immediately —
        WhatsApp's media URLs are short-lived and require our access token,
        so they can't be stored as-is — and re-hosted under MEDIA_URL; the
        caption (if any) becomes the body. Other message types (location,
        contacts, interactive replies, reactions...) get a plain-text
        summary since we don't have a UI for them yet.
        """
        msg_type = msg.get("type", "text")

        if msg_type == "text":
            return msg.get("text", {}).get("body", ""), ""

        if msg_type in MEDIA_TYPE_LABELS:
            payload = msg.get(msg_type, {})
            label = f"[{MEDIA_TYPE_LABELS[msg_type]}]"
            body = payload.get("caption") or label
            media_id = payload.get("id")
            media_url = self._store_media(media_id) if media_id else ""
            return body, media_url

        if msg_type == "location":
            loc = msg.get("location", {})
            return f"[Location] {loc.get('latitude')}, {loc.get('longitude')}", ""

        if msg_type == "contacts":
            names = ", ".join(c.get("name", {}).get("formatted_name", "") for c in msg.get("contacts", []))
            return f"[Contact shared] {names}".strip(), ""

        if msg_type == "button":
            return msg.get("button", {}).get("text", "[Button reply]"), ""

        if msg_type == "interactive":
            interactive = msg.get("interactive", {})
            reply = interactive.get("button_reply") or interactive.get("list_reply") or {}
            return reply.get("title", "[Interactive reply]"), ""

        return f"[Unsupported message: {msg_type}]", ""

    def _store_media(self, media_id: str) -> str:
        result = download_whatsapp_media(media_id)
        if not result:
            return ""
        content, mime_type = result
        ext = mimetypes.guess_extension(mime_type.split(";")[0].strip()) or ""
        filename = f"whatsapp/{uuid.uuid4().hex}{ext}"
        saved_path = default_storage.save(filename, ContentFile(content))
        return self.request.build_absolute_uri(default_storage.url(saved_path))

    def _handle_statuses(self, value):
        valid_statuses = dict(Message.DeliveryStatus.choices)
        for status in value.get("statuses", []):
            wamid = status.get("id")
            new_status = status.get("status")
            if wamid and new_status in valid_statuses:
                Message.objects.filter(wa_message_id=wamid).update(delivery_status=new_status)
