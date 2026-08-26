from urllib.parse import quote

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from accounts.models import User

from .models import Company, Proposal


def _html_email(intro_lines: list[str], cta_label: str, cta_url: str, footer: str = "") -> str:
    """Small styled HTML email body: intro paragraphs + one button, no page content dumped
    into the email itself — the recipient always clicks through to actually see/act on it."""
    intro_html = "".join(
        f'<p style="margin:0 0 12px;color:#14171f;font-size:14px;line-height:1.6;">{line}</p>'
        for line in intro_lines
    )
    footer_html = f'<p style="margin:16px 0 0;color:#9aa1ad;font-size:12px;">{footer}</p>' if footer else ""
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      {intro_html}
      <p style="text-align:center;margin:28px 0;">
        <a href="{cta_url}" style="background:linear-gradient(135deg,#4f46e5,#0d9488);color:#ffffff;
           padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;
           display:inline-block;">{cta_label}</a>
      </p>
      <p style="margin:0;color:#9aa1ad;font-size:12px;line-height:1.5;">
        If the button doesn't work, copy this link into your browser:<br>
        <a href="{cta_url}" style="color:#4f46e5;word-break:break-all;">{cta_url}</a>
      </p>
      {footer_html}
    </div>
    """


def _send_html_email(subject: str, text_body: str, html_body: str, to: str) -> None:
    email = EmailMultiAlternatives(subject=subject, body=text_body, from_email=settings.DEFAULT_FROM_EMAIL, to=[to])
    email.attach_alternative(html_body, "text/html")
    email.send()


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
    name = user.first_name or user.username
    text_body = (
        f"Hello {name},\n\n"
        f"An account has been created for you.\n"
        f"Set your password to log in and review proposals sent to you: {invite_link}\n\n"
        "This link expires in 7 days."
    )
    html_body = _html_email(
        intro_lines=[
            f"Hello {name},",
            "An account has been created for you. Set your password to log in and review proposals sent to you.",
        ],
        cta_label="Set Your Password",
        cta_url=invite_link,
        footer="This link expires in 7 days.",
    )
    _send_html_email("Set up your account", text_body, html_body, user.email)
    return {
        "invite_link": invite_link,
        "whatsapp_link": build_whatsapp_share_link(user.phone_number, text_body) if user.phone_number else None,
    }


def send_proposal_review_email(proposal: Proposal) -> None:
    """Email the company contact that a proposal is waiting for their review.

    Raises on mail failure — the caller decides how to surface that (draft stays DRAFT).
    """
    review_link = f"{settings.FRONTEND_URL}/review/{proposal.review_token}"
    contact = proposal.company.contact_person or proposal.company.company_name
    text_body = (
        f"Hello {contact},\n\n"
        f'A new document, "{proposal.title}", is waiting for your review.\n\n'
        f"Review and respond here: {review_link}"
    )
    html_body = _html_email(
        intro_lines=[
            f"Hello {contact},",
            f'A new document, "<strong>{proposal.title}</strong>", is waiting for your review.',
        ],
        cta_label="View & Respond",
        cta_url=review_link,
    )
    _send_html_email(f"Review requested: {proposal.title}", text_body, html_body, proposal.company.email)
