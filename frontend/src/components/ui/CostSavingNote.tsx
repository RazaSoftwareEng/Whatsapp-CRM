import { Info } from "lucide-react";

/** Reminder shown to admin/manager/TL/agent: give new contacts this number
 * to message first — once a customer messages us, our replies within the
 * next 24 hours are free; only a message WE start (outside that window)
 * costs money. */
export function CostSavingNote({ accent = "var(--teal-strong)" }: { accent?: string }) {
  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
      style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
    >
      <Info size={16} className="mt-0.5 shrink-0" style={{ color: accent }} />
      <p style={{ color: "var(--text-muted)" }}>
        Give new contacts this number to message first:{" "}
        <span className="font-semibold" style={{ color: "var(--text)" }}>
          +971 56 538 4322
        </span>
        . Once a customer messages us, our replies within 24 hours are free — only a message we start first costs
        money.
      </p>
    </div>
  );
}
