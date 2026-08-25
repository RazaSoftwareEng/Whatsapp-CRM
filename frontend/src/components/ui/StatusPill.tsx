const STATUS_STYLES: Record<string, { fg: string; bg: string; label: string }> = {
  unassigned: { fg: "var(--warning)", bg: "var(--warning-soft)", label: "Unassigned" },
  in_progress: { fg: "var(--teal-strong)", bg: "var(--teal-soft)", label: "In progress" },
  closed: { fg: "var(--text-faint)", bg: "var(--surface-2)", label: "Closed" },
  pending: { fg: "var(--text-faint)", bg: "var(--surface-2)", label: "Pending" },
  sent: { fg: "var(--indigo)", bg: "var(--indigo-soft)", label: "Sent" },
  delivered: { fg: "var(--success)", bg: "var(--success-soft)", label: "Delivered" },
  read: { fg: "var(--success)", bg: "var(--success-soft)", label: "Read" },
  failed: { fg: "var(--danger)", bg: "var(--danger-soft)", label: "Failed" },
  active: { fg: "var(--success)", bg: "var(--success-soft)", label: "Active" },
  inactive: { fg: "var(--text-faint)", bg: "var(--surface-2)", label: "Inactive" },
  offline: { fg: "var(--text-faint)", bg: "var(--surface-2)", label: "Offline" },
  draft: { fg: "var(--text-faint)", bg: "var(--surface-2)", label: "Draft" },
  pending_review: { fg: "var(--warning)", bg: "var(--warning-soft)", label: "Pending review" },
  approved: { fg: "var(--success)", bg: "var(--success-soft)", label: "Approved" },
  rejected: { fg: "var(--danger)", bg: "var(--danger-soft)", label: "Rejected" },
  changes_requested: { fg: "var(--orange)", bg: "var(--orange-soft)", label: "Changes requested" },
};

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    fg: "var(--text-faint)",
    bg: "var(--surface-2)",
    label: status,
  };
  return (
    <span
      style={{ color: style.fg, background: style.bg }}
      className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
    >
      {style.label}
    </span>
  );
}
