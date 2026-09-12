import { ArrowDown } from "lucide-react";

export function JumpToLatestButton({
  onClick,
  accent = "var(--whatsapp-strong)",
}: {
  onClick: () => void;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-white shadow-lg transition-opacity hover:opacity-90"
      style={{ background: accent }}
    >
      <ArrowDown size={13} />
      New message
    </button>
  );
}
