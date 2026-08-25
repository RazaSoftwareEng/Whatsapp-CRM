from django.contrib import admin

from .models import Company, Proposal, ProposalActivityLog


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["company_name", "contact_person", "email", "phone", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["company_name", "email"]


class ProposalActivityLogInline(admin.TabularInline):
    model = ProposalActivityLog
    extra = 0
    readonly_fields = ["actor", "action", "note", "created_at"]


@admin.register(Proposal)
class ProposalAdmin(admin.ModelAdmin):
    list_display = ["title", "company", "status", "created_by", "updated_at"]
    list_filter = ["status"]
    search_fields = ["title", "company__company_name"]
    inlines = [ProposalActivityLogInline]
