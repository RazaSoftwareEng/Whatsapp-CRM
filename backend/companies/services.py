from urllib.parse import quote

from django.conf import settings
from django.core.mail import send_mail

from accounts.models import User

from .models import Company, Proposal


def ensure_company_user(company: Company) -> tuple[User, bool]:
    """Get-or-create the single COMPANY_USER login tied to `company`.

    New user: username=company.email, unusable password, inactive until they set one,
    name/email/phone copied from the company. Existing user: email/phone/name re-synced
    (username left untouched so a contact-info edit never changes their login).
    Returns (user, created) — caller decides whether to invite based on `created`.
    """
    user = User.objects.filter(company=company, role=User.Role.COMPANY_USER).first()
    if user:
        user.email = company.email
        user.first_name = company.contact_person
        user.phone_number = company.phone
        user.save(update_fields=["email", "first_name", "phone_number"])
        return user, False

    user = User(
        username=company.email,
        email=company.email,
        first_name=company.contact_person,
        phone_number=company.phone,
        role=User.Role.COMPANY_USER,
        company=company,
        is_active=False,
    )
    user.set_unusable_password()
    user.save()
    return user, True


def build_whatsapp_share_link(phone: str, message: str) -> str:
    """Pure string helper — no network call. digits-only phone + urlencoded message -> wa.me link."""
    digits = "".join(ch for ch in phone if ch.isdigit())
    return f"https://wa.me/{digits}?text={quote(message)}"


def send_invite(user: User) -> dict:
    """Generate an invite token, email the setup-password link, and return share links.

    Raises on mail failure — the caller decides how to surface that.
    """
    token = user.generate_invite_token(expiry_days=7)
    user.save(update_fields=["invite_token", "invite_token_expires_at"])

    invite_link = f"{settings.FRONTEND_URL}/setup-password/{token}"
    message = (
        f"Hello {user.first_name or user.username},\n\n"
        f"An account has been created for you on {settings.DEFAULT_FROM_EMAIL}.\n"
        f"Set your password to log in and review proposals sent to you:\n\n{invite_link}\n\n"
        "This link expires in 7 days."
    )
    send_mail(
        subject="Set up your account",
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
    return {
        "invite_link": invite_link,
        "whatsapp_link": build_whatsapp_share_link(user.phone_number, message) if user.phone_number else None,
    }


def send_proposal_review_email(proposal: Proposal) -> None:
    """Email the company contact that a proposal is waiting for their review.

    Raises on mail failure — the caller decides how to surface that (draft stays DRAFT).
    """
    review_link = f"{settings.FRONTEND_URL}/review/{proposal.review_token}"
    message = (
        f"Hello {proposal.company.contact_person or proposal.company.company_name},\n\n"
        f"A new document, \"{proposal.title}\", is waiting for your review:\n\n{proposal.message}\n\n"
        f"Review and respond here: {review_link}"
    )
    send_mail(
        subject=f"Review requested: {proposal.title}",
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[proposal.company.email],
    )
