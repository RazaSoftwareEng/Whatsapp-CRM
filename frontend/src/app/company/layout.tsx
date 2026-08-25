"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/ui/Logo";

export default function CompanyLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
    else if (user.role !== "company_user") router.push("/agent");
  }, [loading, user, router]);

  if (loading || !user || user.role !== "company_user") return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="flex items-center justify-between border-b px-6 py-3"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            WhatsApp CRM
          </p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-70"
          style={{ color: "var(--text-faint)" }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
