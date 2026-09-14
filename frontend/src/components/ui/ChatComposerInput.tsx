import { useRef } from "react";
import { Loader2, Paperclip, Smile } from "lucide-react";

/** The pill-shaped text field for a chat reply, with an attachment picker and
 * an emoji icon (still a visual placeholder — no picker wired up) on the left. */
export function ChatComposerInput({
  value,
  onChange,
  placeholder,
  focusColor = "var(--teal)",
  onAttach,
  attaching,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  focusColor?: string;
  /** Called with the picked file when the user chooses one via the paperclip icon. */
  onAttach?: (file: File) => void;
  /** Shows a spinner on the paperclip icon while an upload is in flight. */
  attaching?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="flex flex-1 items-center gap-1 rounded-full border pl-1.5 pr-1 focus-within:border-[var(--focus-color)]"
      style={{ background: "var(--surface-2)", borderColor: "var(--border)", ["--focus-color" as string]: focusColor }}
    >
      {onAttach && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAttach(file);
            e.target.value = "";
          }}
        />
      )}
      <button
        type="button"
        title={onAttach ? "Attach a file" : "Attachments — coming soon"}
        disabled={!onAttach || attaching}
        onClick={() => fileInputRef.current?.click()}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:opacity-70 disabled:cursor-default disabled:opacity-100"
        style={{ color: onAttach ? focusColor : "var(--text-faint)" }}
      >
        {attaching ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
      </button>
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
