import secrets

from django.db import migrations


def backfill_review_token(apps, schema_editor):
    Proposal = apps.get_model("companies", "Proposal")
    for proposal in Proposal.objects.filter(review_token=""):
        proposal.review_token = secrets.token_urlsafe(32)
        proposal.save(update_fields=["review_token"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0002_proposal_review_token_proposalactivitylog_ip_address_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_review_token, noop),
    ]
