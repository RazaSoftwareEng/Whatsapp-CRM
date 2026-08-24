"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { DeliveryIcon } from "@/components/ui/DeliveryIcon";
import { CopyGuard } from "@/components/CopyGuard";
import { NewContactForm } from "@/components/NewContactForm";
import { formatTime } from "@/lib/format";
import type { ChatDetail, ChatRow as ChatSummary } from "@/types/admin";

export default function AgentPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const loadChats = useCallback(() => {
    api.get<ChatSummary[]>("/chats/").then((res) => setChats(res.data));
  }, []);

  const loadActive = useCallback((id: number) => {
    api.get<ChatDetail>(`/chats/${id}/`).then((res) => setActiveChat(res.data));
  }, []);

  useEffect(() => {
    if (!user) return;
    loadChats();
    const t = setInterval(loadChats, 5000);
    return () => clearInterval(t);
  }, [user, loadChats]);

  useEffect(() => {
    if (activeId === null) return;
    loadActive(activeId);
    const t = setInterval(() => loadActive(activeId), 4000);
    return () => clearInterval(t);
  }, [activeId, loadActive]);

  async function sendReply(e: SubmitEvent) {
    e.preventDefault();
    if (!activeId || !draft.trim()) return;
    setSending(true);
    try {
      await api.post("/messages/", { chat: activeId, body: draft });
      setDraft("");
      loadActive(activeId);
    } finally {
      setSending(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="flex h-screen" style={{ background: "var(--bg)" }}>
      <CopyGuard />
      <aside
        className="flex w-80 shrink-0 flex-col overflow-y-auto border-r"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between border-b px-4 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <div>
              <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text)" }}>
                {user.username}
              </p>
              <p
                className="font-mono text-[10px] font-medium uppercase leading-tight tracking-[0.12em]"
                style={{ color: "var(--teal)" }}
              >
                agent
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:opacity-70"
            style={{ color: "var(--text-faint)" }}
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>

        <NewContactForm
          onCreated={(chat) => {
            setChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)]);
            setActiveId(chat.id);
          }}
        />

        {chats.length === 0 && (
          <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            No chats assigned yet.
          </p>
        )}

        <div className="flex flex-col gap-1 p-2">
          {chats.map((chat) => {
            const name = chat.lead.name || chat.lead.phone_number;
            const isActive = activeId === chat.id;
            return (
              <button
                key={chat.id}
                onClick={() => setActiveId(chat.id)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                style={{ background: isActive ? "var(--teal-soft)" : "transparent" }}
              >
                <Avatar name={name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                    {name}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {chat.lead.phone_number}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        {!activeChat ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Logo size={40} />
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>
              Select a chat to view the conversation.
            </p>
          </div>
        ) : (
          <>
            <div
              className="flex items-center gap-3 border-b px-6 py-3.5"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <Avatar name={activeChat.lead.name || activeChat.lead.phone_number} size={36} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {activeChat.lead.name || activeChat.lead.phone_number}
                </p>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {activeChat.lead.phone_number}
                </p>
              </div>
            </div>

            <div
              className="flex-1 space-y-2.5 overflow-y-auto px-6 py-5"
              style={{
                background:
                  "radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0) 0 0/18px 18px, var(--bg)",
              }}
            >
              {activeChat.messages.length === 0 && (
                <p className="text-center text-sm" style={{ color: "var(--text-faint)" }}>
                  No messages yet.
                </p>
              )}
              {activeChat.messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-sm rounded-2xl px-3.5 py-2.5 text-sm"
                    style={
                      m.direction === "out"
                        ? { background: "linear-gradient(135deg, var(--teal), var(--teal-strong))", color: "white" }
                        : { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow-sm)" }
                    }
                  >
                    <p className="leading-relaxed">{m.body}</p>
                    <div
                      className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80"
                      style={m.direction === "in" ? { color: "var(--text-faint)" } : undefined}
                    >
                      {formatTime(m.sent_at)}
                      {m.direction === "out" && <DeliveryIcon status={m.delivery_status} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={sendReply}
              className="flex gap-2 border-t px-4 py-3.5"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a reply…"
                className="flex-1 rounded-full border px-4 py-2.5 text-sm outline-none focus:border-[var(--teal)]"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--teal), var(--indigo))" }}
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
