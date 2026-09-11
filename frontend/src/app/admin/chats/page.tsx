"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { DeliveryIcon } from "@/components/ui/DeliveryIcon";
import { formatTime } from "@/lib/format";
import { MessageContent } from "@/components/ui/MessageContent";
import { JumpToLatestButton } from "@/components/ui/JumpToLatestButton";
import { useAutoScroll } from "@/lib/useAutoScroll";
import type { ChatRow, ChatDetail } from "@/types/admin";

export default function AdminChatsPage() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { containerRef, showJump, scrollToBottom, onScroll } = useAutoScroll(
    activeChat?.messages.length ?? 0,
    activeId
  );

  const loadChats = useCallback(() => {
    api.get<ChatRow[]>("/chats/").then((res) => {
      setChats(res.data);
      setActiveId((current) => current ?? res.data[0]?.id ?? null);
    });
  }, []);

  const loadActive = useCallback((id: number) => {
    api.get<ChatDetail>(`/chats/${id}/`).then((res) => setActiveChat(res.data));
  }, []);

  useEffect(() => {
    loadChats();
    const t = setInterval(loadChats, 6000);
    return () => clearInterval(t);
  }, [loadChats]);

  useEffect(() => {
    if (activeId === null) return;
    loadActive(activeId);
    const t = setInterval(() => loadActive(activeId), 4000);
    setChats((prev) => prev.map((c) => (c.id === activeId ? { ...c, has_unread: false } : c)));
    api.post(`/chats/${activeId}/mark_read/`).catch(() => {});
    return () => clearInterval(t);
  }, [activeId, loadActive]);

  function selectChat(id: number) {
    setActiveId(id);
  }

  async function deleteChat() {
    if (!activeId) return;
    if (!window.confirm("Delete this chat and all its messages? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await api.delete(`/chats/${activeId}/`);
      setChats((prev) => prev.filter((c) => c.id !== activeId));
      setActiveChat(null);
      setActiveId(null);
    } finally {
      setDeleting(false);
    }
  }

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

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        Chats
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Every conversation across every lead and agent, in one place.
      </p>

      <div
        className="flex overflow-hidden rounded-2xl border"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-sm)",
          height: "calc(100vh - 260px)",
          minHeight: 420,
        }}
      >
        <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r" style={{ borderColor: "var(--border)" }}>
          {chats.length === 0 && (
            <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              No chats yet.
            </p>
          )}
          {chats.map((chat) => {
            const name = chat.lead.name || chat.lead.phone_number;
            const isActive = activeId === chat.id;
            return (
              <button
                key={chat.id}
                onClick={() => selectChat(chat.id)}
                className="flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                style={{ background: isActive ? "var(--indigo-soft)" : "transparent" }}
              >
                <Avatar name={name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                    {chat.has_unread && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: "var(--indigo)" }}
                        title="New message"
                      />
                    )}
                    <span className="truncate">{name}</span>
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {chat.assigned_user_username ?? "Unassigned"}
                  </p>
                </div>
                <StatusPill status={chat.status} />
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col">
          {!activeChat ? (
            <div className="flex flex-1 items-center justify-center text-sm" style={{ color: "var(--text-faint)" }}>
              Select a chat to view the conversation.
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-3 border-b px-5 py-3"
                style={{ borderColor: "var(--border)" }}
              >
                <Avatar name={activeChat.lead.name || activeChat.lead.phone_number} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                    {activeChat.lead.name || activeChat.lead.phone_number}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {activeChat.lead.phone_number}
                    {activeChat.assigned_user_username ? ` · assigned to ${activeChat.assigned_user_username}` : ""}
                  </p>
                </div>
                <StatusPill status={activeChat.status} />
                <button
                  onClick={deleteChat}
                  disabled={deleting}
                  title="Delete chat"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:opacity-70 disabled:opacity-40"
                  style={{ color: "var(--danger)" }}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="relative flex-1 overflow-hidden">
              <div
                ref={containerRef}
                onScroll={onScroll}
                className="h-full space-y-2.5 overflow-y-auto px-5 py-4"
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
                          ? { background: "linear-gradient(135deg, var(--indigo), var(--indigo-strong))", color: "white" }
                          : { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow-sm)" }
                      }
                    >
                      <MessageContent body={m.body} mediaUrl={m.media_url} />
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
              {showJump && <JumpToLatestButton onClick={() => scrollToBottom(true)} />}
              </div>

              <form
                onSubmit={sendReply}
                className="flex gap-2 border-t px-4 py-3"
                style={{ borderColor: "var(--border)" }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply as admin…"
                  className="flex-1 rounded-full border px-4 py-2.5 text-sm outline-none focus:border-[var(--indigo)]"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, var(--indigo), var(--teal))" }}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
