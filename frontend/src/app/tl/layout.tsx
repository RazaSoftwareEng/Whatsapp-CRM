"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, MessageCircle, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { CopyGuard } from "@/components/CopyGuard";
import { Logo } from "@/components/ui/Logo";
import { NewChatProvider, useNewChatRequest } from "@/context/NewChatContext";

const NAV_ITEMS = [
  { href: "/tl", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tl/chats", label: "Chats", icon: MessageCircle },
];

export default function TLLayout({ children }: { children: ReactNode }) {
  return (
    <NewChatProvider>
      <TLLayoutInner>{children}</TLLayoutInner>
    </NewChatProvider>
  );
}

function TLLayoutInner({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { requestNewChat } = useNewChatRequest();

  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
    else if (user.role !== "tl") router.push(user.role === "admin" ? "/admin" : "/agent");
  }, [loading, user, router]);

  if (loading || !user || user.role !== "tl") return null;

  function startNewChat() {
    requestNewChat();
    if (pathname !== "/tl/chats") router.push("/tl/chats");
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <CopyGuard />
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
              style={{ color: "var(--teal-strong)" }}
            >
              team lead console
            </p>
          </div>
        </div>

        <button
          onClick={startNewChat}
          className="mb-3 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, var(--teal), var(--indigo))" }}
        >
          <UserPlus size={15} />
          New chat
        </button>

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
                    ? { background: "var(--teal-soft)", color: "var(--teal-strong)" }
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
            style={{ background: "var(--teal-soft)", color: "var(--teal-strong)" }}
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
