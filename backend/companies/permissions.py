from rest_framework.permissions import BasePermission

from .models import Proposal


class CanActOnProposal(BasePermission):
    """approve/reject/request-changes: admin, or the company_user whose company owns the proposal.
    resend: admin, or the manager who created it."""

    def has_object_permission(self, request, view, obj: Proposal):
        user = request.user
        if user.role == "admin":
            return True
        if view.action == "send":
            return obj.created_by_id == user.id
        return user.role == "company_user" and user.company_id == obj.company_id
