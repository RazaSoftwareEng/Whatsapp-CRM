"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Click-to-copy text — used for emails/phone numbers in list rows. Stops the
 * click from bubbling so it doesn't also trigger a parent row's navigation. */
export function CopyField({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span style={{ color: "var(--text-faint)" }}>—</span>;

  return (
    <button
      type="button"
      title="Click to copy"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className={`group inline-flex min-w-0 items-center gap-1.5 ${className ?? ""}`}
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check size={12} className="shrink-0" style={{ color: "var(--success)" }} />
      ) : (
        <Copy size={11} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
      )}
    </button>
  );
}
