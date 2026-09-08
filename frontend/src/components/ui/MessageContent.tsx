import { FileText } from "lucide-react";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const VIDEO_EXTENSIONS = [".mp4", ".3gp", ".mov", ".webm"];
const AUDIO_EXTENSIONS = [".ogg", ".oga", ".mp3", ".aac", ".amr", ".m4a", ".wav"];

function extensionOf(url: string) {
  return url.split("?")[0].toLowerCase();
}

function kindOf(url: string): "image" | "video" | "audio" | "other" {
  const clean = extensionOf(url);
  if (IMAGE_EXTENSIONS.some((ext) => clean.endsWith(ext))) return "image";
  if (VIDEO_EXTENSIONS.some((ext) => clean.endsWith(ext))) return "video";
  if (AUDIO_EXTENSIONS.some((ext) => clean.endsWith(ext))) return "audio";
  return "other";
}

/** True for our own placeholder labels ("[Image]", "[Document]", ...) — not a real caption. */
function isPlaceholderLabel(body: string) {
  return /^\[[A-Za-z]+\]$/.test(body.trim());
}

/** Renders a message's text plus, if present, its downloaded WhatsApp media —
 * inline preview for images/video/audio (stickers are just small webp images,
 * so they fall under "image"), a file link for anything else (documents). */
export function MessageContent({ body, mediaUrl }: { body: string; mediaUrl?: string }) {
  if (!mediaUrl) {
    return <p className="leading-relaxed">{body}</p>;
  }

  const kind = kindOf(mediaUrl);
  const hasRealCaption = body && !isPlaceholderLabel(body);

  return (
    <div>
      {kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl} alt={body || "Image"} className="mb-1.5 max-h-64 rounded-lg" />
      )}
      {kind === "video" && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={mediaUrl} controls className="mb-1.5 max-h-64 rounded-lg" />
      )}
      {kind === "audio" && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio src={mediaUrl} controls className="mb-1.5 max-w-full" />
      )}
      {kind === "other" && (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-1.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium underline"
          style={{ background: "rgba(0,0,0,0.06)" }}
        >
          <FileText size={13} />
          {body || "Attachment"}
        </a>
      )}
      {kind !== "other" && hasRealCaption && <p className="leading-relaxed">{body}</p>}
    </div>
  );
}
