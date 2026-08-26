from rest_framework import serializers

from .models import Company, Proposal, ProposalActivityLog
from .validators import validate_uae_pk_phone


class CompanySearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "company_name", "contact_person", "email", "phone"]


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            "id",
            "company_name",
            "contact_person",
            "email",
            "phone",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProposalSerializer(serializers.ModelSerializer):
    company = CompanySearchSerializer(read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True, default=None)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Proposal
        fields = [
            "id",
            "title",
            "message",
            "company",
            "status",
            "status_display",
            "created_by_username",
            "last_email_error",
            "review_token",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ProposalCreateSerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), required=False, allow_null=True)
    company_name = serializers.CharField(required=False, allow_blank=True)
    contact_person = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Proposal
        fields = ["id", "title", "message", "company", "company_name", "contact_person", "email", "phone"]
        read_only_fields = ["id"]

    def validate_phone(self, value):
        return validate_uae_pk_phone(value)

    def validate(self, attrs):
        # `company` (an exact id from search) takes precedence when present — otherwise
        # company_name + email are required so the company can be created or matched by email.
        if attrs.get("company") is None and not (attrs.get("company_name") and attrs.get("email")):
            raise serializers.ValidationError("company_name and email are required.")
        return attrs


class ProposalActionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ProposalActivityLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True, default=None)
    proposal_title = serializers.CharField(source="proposal.title", read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = ProposalActivityLog
        fields = [
            "id",
            "proposal",
            "proposal_title",
            "actor_username",
            "action",
            "action_display",
            "note",
            "ip_address",
            "location",
            "created_at",
        ]
        read_only_fields = fields
