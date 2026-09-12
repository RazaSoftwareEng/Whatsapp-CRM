import { Search } from "lucide-react";

export type ChatTab = "all" | "unassigned" | "assigned";

const TABS: { value: ChatTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "unassigned", label: "Unassigned" },
];

export function ChatListControls({
  search,
  onSearchChange,
  tab,
  onTabChange,
  counts,
  accent = "var(--whatsapp-strong)",
}: {
  search: string;
  onSearchChange: (v: string) => void;
  tab?: ChatTab;
  onTabChange?: (v: ChatTab) => void;
  counts?: Record<ChatTab, number>;
  accent?: string;
}) {
  return (
    <div className="border-b px-3 pb-2 pt-3" style={{ borderColor: "var(--border)" }}>
      <div className="relative mb-2">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-faint)" }}
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search chats…"
          className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs outline-none"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
        />
      </div>

      {tab && onTabChange && counts && (
        <div className="flex gap-1">
          {TABS.map((t) => {
            const isActive = tab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => onTabChange(t.value)}
                className="flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                style={
                  isActive
                    ? { background: accent, color: "white" }
                    : { background: "var(--surface-2)", color: "var(--text-muted)" }
                }
              >
                {t.label} · {counts[t.value]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
