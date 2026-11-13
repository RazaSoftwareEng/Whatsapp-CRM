"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, FilePlus, LayoutDashboard, ListChecks, LogOut, Menu, MessageCircle, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/ui/Logo";

const NAV_ITEMS = [
  { href: "/manager", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/chats", label: "Chats", icon: MessageCircle },
  { href: "/manager/proposals", label: "Proposals", icon: ListChecks },
  { href: "/manager/proposals/new", label: "New Proposal", icon: FilePlus },
  { href: "/manager/companies", label: "Companies", icon: Building2 },
];

export default function ManagerLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
    else if (user.role !== "manager") router.push("/agent");
  }, [loading, user, router]);

  if (loading || !user || user.role !== "manager") return null;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <div
        className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            WhatsApp CRM
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r px-3 py-4 transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
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
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:opacity-70 lg:hidden"
            style={{ color: "var(--text-faint)" }}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
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
        <main className="mx-auto max-w-5xl px-4 py-8 pt-20 sm:px-8 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}
