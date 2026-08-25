import Image from "next/image";
import { ShieldCheck } from "lucide-react";

/** Shared header for the public-facing pages (review link, invite/setup-password link).
 * The Al Merak mark has white text baked in, so it needs a dark backing to read. */
export function BrandHeader({ label }: { label: string }) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <div
        className="mb-3 flex items-center justify-center rounded-2xl px-10 py-5"
        style={{ background: "#0b0b0d", boxShadow: "var(--shadow-md)" }}
      >
        <Image src="/al-merak.webp" alt="Al Merak Tax Consultant L.L.C" width={220} height={140} priority />
      </div>
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: "var(--indigo)" }}>
        {label}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: "var(--text-faint)" }}>
        <ShieldCheck size={12} />
        Secure link — your response is recorded and shared only with the sender
      </p>
    </div>
  );
}
