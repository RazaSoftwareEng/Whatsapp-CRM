from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import ActivityViolation, User


class UserSerializer(serializers.ModelSerializer):
    team_lead_username = serializers.CharField(source="team_lead.username", read_only=True, default=None)

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "status", "phone_number", "team_lead", "team_lead_username"]
        read_only_fields = ["id"]


class AgentCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    team_lead = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.TL), required=False, allow_null=True
    )

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "phone_number", "team_lead"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data, role=User.Role.AGENT)
        user.set_password(password)
        user.save()
        return user


class UserCreateSerializer(serializers.ModelSerializer):
    """Admin-only: create a user of any role except company_user (that login is only
    ever auto-created via companies.services.ensure_company_user)."""

    password = serializers.CharField(write_only=True)
    team_lead = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.TL), required=False, allow_null=True
    )

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "role", "phone_number", "team_lead"]

    def validate_role(self, value):
        if value == User.Role.COMPANY_USER:
            raise serializers.ValidationError("Company user accounts are created automatically, not manually.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ActivityViolationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ActivityViolation
        fields = ["id", "user", "username", "action", "path", "created_at"]
        read_only_fields = ["id", "user", "username", "created_at"]


class CRMTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["username"] = user.username
        return token
