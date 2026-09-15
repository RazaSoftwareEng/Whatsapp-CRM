import mimetypes
import os
import subprocess
import tempfile

# Python's mimetypes module doesn't know several types WhatsApp actually sends/accepts
# (voice notes are "audio/ogg", for example) — without a correct extension the saved
# file has none (or the wrong one), so the frontend can't tell it's playable audio/
# video and just renders a plain download link. Check these known types first.
MIME_EXTENSIONS = {
    "audio/ogg": ".ogg",
    "audio/opus": ".ogg",
    "audio/aac": ".aac",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/amr": ".amr",
    "video/mp4": ".mp4",
    "video/3gpp": ".3gp",
    "image/webp": ".webp",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
}


def guess_media_extension(mime_type: str) -> str:
    clean_mime = (mime_type or "").split(";")[0].strip()
    return MIME_EXTENSIONS.get(clean_mime) or mimetypes.guess_extension(clean_mime) or ""


def transcode_webm_to_ogg(raw_bytes: bytes) -> bytes:
    """Browsers record voice notes as audio/webm (Opus codec) via MediaRecorder,
    but WhatsApp's Cloud API only accepts Opus audio inside an Ogg container —
    remux (not re-encode, the codec is already Opus) with ffmpeg."""
    with tempfile.TemporaryDirectory() as tmp:
        src_path = os.path.join(tmp, "in.webm")
        dst_path = os.path.join(tmp, "out.ogg")
        with open(src_path, "wb") as f:
            f.write(raw_bytes)
        subprocess.run(
            ["ffmpeg", "-y", "-i", src_path, "-c:a", "libopus", "-vn", dst_path],
            check=True, capture_output=True, timeout=30,
        )
        with open(dst_path, "rb") as f:
            return f.read()
