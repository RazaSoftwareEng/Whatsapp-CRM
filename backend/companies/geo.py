import requests


def get_client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def geolocate(ip: str) -> str:
    """Best-effort city/country lookup via ip-api.com's free tier. Never raises —
    an approval must never fail just because geolocation is unavailable."""
    if not ip:
        return ""
    try:
        resp = requests.get(f"http://ip-api.com/json/{ip}", timeout=3)
        data = resp.json()
        if data.get("status") != "success":
            return ""
        return ", ".join(p for p in [data.get("city"), data.get("country")] if p)
    except requests.RequestException:
        return ""
