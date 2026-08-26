import re

from django.core.validators import RegexValidator
from rest_framework import serializers

PHONE_PATTERN = r"^(\+971\d{9}|\+92\d{10})$"
PHONE_ERROR_MESSAGE = "Enter a valid UAE (+971XXXXXXXXX) or Pakistan (+92XXXXXXXXXX) phone number."

_phone_regex = re.compile(PHONE_PATTERN)

company_phone_validator = RegexValidator(regex=PHONE_PATTERN, message=PHONE_ERROR_MESSAGE)


def validate_uae_pk_phone(value: str) -> str:
    """For serializer fields not auto-derived from the Company model (so the model's
    RegexValidator isn't picked up automatically) — same rule, same message."""
    if value and not _phone_regex.match(value):
        raise serializers.ValidationError(PHONE_ERROR_MESSAGE)
    return value
