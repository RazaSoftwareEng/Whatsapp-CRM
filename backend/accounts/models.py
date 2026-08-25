import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        TL = "tl", "Team Lead"
        AGENT = "agent", "Agent"
        MANAGER = "manager", "Manager"
        COMPANY_USER = "company_user", "Company User"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        OFFLINE = "offline", "Offline"

    role = models.CharField(max_length=12, choices=Role.choices, default=Role.AGENT)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OFFLINE)
    phone_number = models.CharField(max_length=20, blank=True)
    team_lead = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="team_members"
    )
    company = models.ForeignKey(
        "companies.Company", null=True, blank=True, on_delete=models.CASCADE, related_name="users"
    )
    invite_token = models.CharField(max_length=64, blank=True, db_index=True)
    invite_token_expires_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.is_superuser:
            self.role = self.Role.ADMIN
        super().save(*args, **kwargs)

    def generate_invite_token(self, expiry_days: int = 7) -> str:
        """Sets a fresh invite token + expiry on this instance (caller must save())."""
        self.invite_token = secrets.token_urlsafe(32)
        self.invite_token_expires_at = timezone.now() + timedelta(days=expiry_days)
        return self.invite_token

    def __str__(self):
        return f"{self.username} ({self.role})"


class ActivityViolation(models.Model):
    class Action(models.TextChoices):
        COPY = "copy", "Copy"
        RIGHT_CLICK = "right_click", "Right click"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="violations")
    action = models.CharField(max_length=20, choices=Action.choices)
    path = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} · {self.action} · {self.created_at:%Y-%m-%d %H:%M}"
