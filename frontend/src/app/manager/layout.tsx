"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, FilePlus, LayoutDashboard, ListChecks, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/ui/Logo";

const NAV_ITEMS = [
  { href: "/manager", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/proposals", label: "Proposals", icon: ListChecks },
  { href: "/manager/proposals/new", label: "New Proposal", icon: FilePlus },
  { href: "/manager/companies", label: "Companies", icon: Building2 },
];

export default function ManagerLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
    else if (user.role !== "manager") router.push("/agent");
  }, [loading, user, router]);

  if (loading || !user || user.role !== "manager") return null;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <aside
        className="flex w-60 shrink-0 flex-col border-r px-3 py-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <Logo size={30} />
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text)" }}>
              WhatsApp CRM
            </p>
            <p
              className="font-mono text-[10px] font-medium uppercase leading-tight tracking-[0.14em]"
              style={{ color: "var(--orange)" }}
            >
              manager console
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={
                  isActive
                    ? { background: "var(--orange-soft)", color: "var(--orange)" }
                    : { color: "var(--text-muted)" }
                }
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 rounded-lg px-2 py-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: "var(--orange-soft)", color: "var(--orange)" }}
          >
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium" style={{ color: "var(--text)" }}>
              {user.username}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-70"
            style={{ color: "var(--text-faint)" }}
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-5xl px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
