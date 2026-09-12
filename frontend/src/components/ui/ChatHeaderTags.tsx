import { StatusPill } from "@/components/ui/StatusPill";

export function ChatHeaderTags({ status, tags }: { status: string; tags: { id: number; name: string }[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <StatusPill status={status} />
      {tags.map((tag) => {
        const isUrgent = /urgent|priority|vip/i.test(tag.name);
        return (
          <span
            key={tag.id}
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={
              isUrgent
                ? { background: "var(--danger-soft)", color: "var(--danger)" }
                : { background: "var(--surface-2)", color: "var(--text-muted)" }
            }
          >
            {tag.name}
          </span>
        );
      })}
    </div>
  );
}
