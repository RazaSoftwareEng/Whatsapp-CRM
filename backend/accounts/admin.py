from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import ActivityViolation, User


@admin.register(User)
class CRMUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("CRM", {"fields": ("role", "status", "phone_number", "team_lead", "company")}),
    )
    list_display = ("username", "email", "role", "team_lead", "status", "is_staff")
    list_filter = ("role", "status", "is_staff")


@admin.register(ActivityViolation)
class ActivityViolationAdmin(admin.ModelAdmin):
    list_display = ("user", "action", "path", "created_at")
    list_filter = ("action",)
    ordering = ("-created_at",)
