from rest_framework import serializers

from .models import Chat, Lead, Message, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name"]


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "chat", "direction", "body", "media_url", "wa_message_id", "delivery_status", "sent_at"]
        read_only_fields = ["id", "direction", "wa_message_id", "sent_at", "delivery_status"]


class LeadSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id",
            "name",
            "company_name",
            "email",
            "phone_number",
            "source",
            "client_status",
            "tags",
            "created_at",
        ]


class ChatSerializer(serializers.ModelSerializer):
    lead = LeadSerializer(read_only=True)
    lead_id = serializers.PrimaryKeyRelatedField(source="lead", queryset=Lead.objects.all(), write_only=True)
    assigned_user_username = serializers.CharField(source="assigned_user.username", read_only=True, default=None)
    has_unread = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    last_message_body = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = [
            "id",
            "lead",
            "lead_id",
            "assigned_user",
            "assigned_user_username",
            "status",
            "last_message_at",
            "last_message_body",
            "has_unread",
            "unread_count",
        ]
        read_only_fields = ["id", "assigned_user", "status", "last_message_at"]

    def get_has_unread(self, obj):
        if not obj.last_message_at:
            return False
        return obj.last_read_at is None or obj.last_message_at > obj.last_read_at

    def get_unread_count(self, obj):
        if not obj.last_message_at:
            return 0
        qs = obj.messages.filter(direction="in")
        if obj.last_read_at:
            qs = qs.filter(sent_at__gt=obj.last_read_at)
        return qs.count()

    def get_last_message_body(self, obj):
        last = obj.messages.last()
        if not last:
            return ""
        if last.body:
            return last.body
        if last.media_url:
            return "📎 Attachment"
        return ""


class ChatDetailSerializer(ChatSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta(ChatSerializer.Meta):
        fields = ChatSerializer.Meta.fields + ["messages"]
