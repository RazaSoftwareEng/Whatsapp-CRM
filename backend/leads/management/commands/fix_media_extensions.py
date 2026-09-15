from urllib.parse import urlparse

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from leads.models import Message

# (signature bytes, offset, extension) — checked in order, first match wins.
SIGNATURES = [
    (b"OggS", 0, ".ogg"),
    (b"ID3", 0, ".mp3"),
    (b"\xff\xfb", 0, ".mp3"),
    (b"#!AMR", 0, ".amr"),
    (b"\x89PNG\r\n\x1a\n", 0, ".png"),
    (b"\xff\xd8\xff", 0, ".jpg"),
    (b"WEBP", 8, ".webp"),
    (b"%PDF", 0, ".pdf"),
    (b"ftyp", 4, ".mp4"),
]

# Already-valid extensions the frontend can render — nothing to do for these.
KNOWN_EXTENSIONS = (
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".mp4", ".3gp", ".mov", ".webm",
    ".ogg", ".oga", ".mp3", ".aac", ".amr", ".m4a", ".wav",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
)


def sniff_extension(header: bytes) -> str:
    for signature, offset, ext in SIGNATURES:
        if header[offset:offset + len(signature)] == signature:
            return ext
    return ""


class Command(BaseCommand):
    help = "Renames already-downloaded WhatsApp media files that were saved without a file " \
           "extension (e.g. old voice notes) so the frontend can recognize and play them."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report what would change without touching files or the DB.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        media_prefix = urlparse(settings.MEDIA_URL if "://" in settings.MEDIA_URL else "http://x" + settings.MEDIA_URL).path

        fixed, skipped, missing = 0, 0, 0

        for message in Message.objects.exclude(media_url="").only("id", "media_url"):
            path = urlparse(message.media_url).path
            if not path.startswith(media_prefix):
                skipped += 1
                continue
            relative_path = path[len(media_prefix):]

            if relative_path.lower().endswith(KNOWN_EXTENSIONS):
                skipped += 1
                continue

            if not default_storage.exists(relative_path):
                self.stdout.write(self.style.WARNING(f"Message {message.id}: file missing on disk ({relative_path}) — skipping."))
                missing += 1
                continue

            with default_storage.open(relative_path, "rb") as f:
                header = f.read(16)
                ext = sniff_extension(header)
                if not ext:
                    self.stdout.write(self.style.WARNING(f"Message {message.id}: could not identify file type ({relative_path}) — skipping."))
                    skipped += 1
                    continue
                f.seek(0)
                content = f.read()

            new_relative_path = relative_path + ext
            new_media_url = message.media_url + ext

            self.stdout.write(f"Message {message.id}: {relative_path} -> {new_relative_path}")
            if not dry_run:
                default_storage.save(new_relative_path, ContentFile(content))
                default_storage.delete(relative_path)
                message.media_url = new_media_url
                message.save(update_fields=["media_url"])
            fixed += 1

        self.stdout.write(self.style.SUCCESS(f"Fixed: {fixed}, skipped: {skipped}, missing on disk: {missing}."))
