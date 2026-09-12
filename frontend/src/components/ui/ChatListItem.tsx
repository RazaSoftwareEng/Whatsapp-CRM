import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatListTimestamp } from "@/lib/format";
import type { ChatRow } from "@/types/admin";

export function ChatListItem({
  chat,
  isActive,
  onClick,
  accent = "var(--indigo)",
  activeBg = "var(--indigo-soft)",
  secondaryLine,
}: {
  chat: ChatRow;
  isActive: boolean;
  onClick: () => void;
  accent?: string;
  activeBg?: string;
  /** Overrides the default "assigned to X" / "Unassigned" second line (e.g. agent view omits it). */
  secondaryLine?: string;
}) {
  const name = chat.lead.name || chat.lead.phone_number;
  const preview = chat.last_message_body || "No messages yet";
  const topTag = chat.lead.tags[0];
  const isUrgentTag = /urgent|priority|vip/i.test(topTag?.name ?? "");

  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
      style={{ background: isActive ? activeBg : "transparent" }}
    >
      <Avatar name={name} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium" style={{ color: "var(--text)" }}>
            {chat.has_unread && (
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} title="New message" />
            )}
            <span className="truncate">{name}</span>
          </p>
          <span className="shrink-0 text-[10px]" style={{ color: "var(--text-faint)" }}>
            {formatListTimestamp(chat.last_message_at)}
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-faint)" }}>
          {preview}
        </p>

        <div className="mt-1 flex items-center gap-1.5">
          {secondaryLine !== undefined ? (
            secondaryLine && (
              <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                {secondaryLine}
              </span>
            )
          ) : (
            <StatusPill status={chat.status} />
          )}
          {topTag && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={
                isUrgentTag
                  ? { background: "var(--danger-soft)", color: "var(--danger)" }
                  : { background: "var(--surface-2)", color: "var(--text-muted)" }
              }
            >
              {topTag.name}
            </span>
          )}
          {chat.unread_count > 0 && (
            <span
              className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
              style={{ background: accent }}
            >
              {chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
