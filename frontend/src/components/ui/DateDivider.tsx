export function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-1">
      <span
        className="rounded-full px-3 py-1 text-[11px] font-medium"
        style={{ background: "var(--surface)", color: "var(--text-faint)", boxShadow: "var(--shadow-md)" }}
      >
        {label}
      </span>
    </div>
  );
}
