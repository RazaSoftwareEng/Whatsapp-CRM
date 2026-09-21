import { AlertTriangle, RefreshCw } from "lucide-react";

/** Shown when a dashboard couldn't load its data after several retries — tells
 * the user it's a server/connection problem rather than silently showing zeros. */
export function LoadErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
      style={{ background: "var(--danger-soft)", borderColor: "var(--danger)", color: "var(--danger)" }}
    >
      <AlertTriangle size={16} className="shrink-0" />
      <p className="flex-1">
        Server is not responding. Please check your internet connection or contact the admin.
      </p>
      <button
        onClick={onRetry}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
        style={{ borderColor: "var(--danger)" }}
      >
        <RefreshCw size={12} />
        Retry
      </button>
    </div>
  );
}

/** Placeholder for a stat number while the first fetch is in flight. */
export function StatSkeleton() {
  return <span className="inline-block h-7 w-12 animate-pulse rounded-md align-middle" style={{ background: "var(--surface-2)" }} />;
}
