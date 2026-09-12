import { Paperclip, Smile } from "lucide-react";

/** The pill-shaped text field for a chat reply, with attachment/emoji icons
 * on the left (visual placeholders for now — sending media isn't wired up yet,
 * so they're deliberately non-interactive rather than pretending to work). */
export function ChatComposerInput({
  value,
  onChange,
  placeholder,
  focusColor = "var(--teal)",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  focusColor?: string;
}) {
  return (
    <div
      className="flex flex-1 items-center gap-1 rounded-full border pl-1.5 pr-1 focus-within:border-[var(--focus-color)]"
      style={{ background: "var(--surface-2)", borderColor: "var(--border)", ["--focus-color" as string]: focusColor }}
    >
      <span
        title="Attachments — coming soon"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ color: "var(--text-faint)" }}
      >
        <Paperclip size={15} />
      </span>
      <span
        title="Emoji — coming soon"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ color: "var(--text-faint)" }}
      >
        <Smile size={15} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
        style={{ color: "var(--text)" }}
      />
    </div>
  );
}
