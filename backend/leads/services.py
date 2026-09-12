import requests
from django.conf import settings

GRAPH_API_VERSION = "v20.0"


def download_whatsapp_media(media_id: str) -> tuple[bytes, str] | None:
    """Resolve a WhatsApp media ID to its bytes + mime type via the Cloud API.

    WhatsApp media URLs are short-lived and require the same bearer token to
    fetch, so this must be done right away (from the webhook) rather than
    stored for later. Returns None if either Graph API call fails.
    """
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"}
    lookup = requests.get(f"https://graph.facebook.com/{GRAPH_API_VERSION}/{media_id}", headers=headers, timeout=10)
    if not lookup.ok:
        return None
    media_url = lookup.json().get("url")
    if not media_url:
        return None
    download = requests.get(media_url, headers=headers, timeout=20)
    if not download.ok:
        return None
    return download.content, download.headers.get("Content-Type", "application/octet-stream")


def send_whatsapp_text(to: str, body: str) -> dict:
    """Send a plain-text WhatsApp message via the Meta Cloud API.

    Raises requests.HTTPError if Meta rejects the request (e.g. bad token,
    recipient outside the 24h session window without a template).
    """
    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body},
    }
    response = requests.post(url, headers=headers, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


def send_whatsapp_template(to: str, template_name: str, language_code: str) -> dict:
    """Send an approved WhatsApp template message — the only way to message a
    contact who hasn't messaged us first (see send_whatsapp_text's docstring).

    Assumes a template with no variable placeholders (static body text); add a
    "components" entry here if a parameterised template is needed later.
    """
    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {"name": template_name, "language": {"code": language_code}},
    }
    response = requests.post(url, headers=headers, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()
