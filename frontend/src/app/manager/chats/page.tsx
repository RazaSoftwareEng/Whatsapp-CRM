"use client";

import { useCallback, useEffect, useMemo, useState, type SubmitEvent } from "react";
import { MessageCircle, Send } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { DeliveryIcon } from "@/components/ui/DeliveryIcon";
import { formatTime } from "@/lib/format";
import { NewContactForm } from "@/components/NewContactForm";
import { MessageContent } from "@/components/ui/MessageContent";
import { JumpToLatestButton } from "@/components/ui/JumpToLatestButton";
import { ChatListItem } from "@/components/ui/ChatListItem";
import { DateDivider } from "@/components/ui/DateDivider";
import { ChatHeaderTags } from "@/components/ui/ChatHeaderTags";
import { ChatComposerInput } from "@/components/ui/ChatComposerInput";
import { useAutoScroll } from "@/lib/useAutoScroll";
import { groupMessagesByDay } from "@/lib/groupMessagesByDay";
import type { ChatRow, ChatDetail } from "@/types/admin";

const TEMPLATE_PREVIEW =
  "Hi, this is Al Merak Tax Consultant. We're reaching out regarding your inquiry. " +
  "Reply to this message and we'll assist you right away.";

export default function ManagerChatsPage() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
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
    api
      .post(`/chats/${activeId}/mark_read/`)
      .then(() => setChats((prev) => prev.map((c) => (c.id === activeId ? { ...c, has_unread: false, unread_count: 0 } : c))))
      .catch(() => {});
    return () => clearInterval(t);
  }, [activeId, loadActive]);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c) =>
        (c.lead.name || "").toLowerCase().includes(q) ||
        c.lead.phone_number.toLowerCase().includes(q) ||
        (c.last_message_body || "").toLowerCase().includes(q)
    );
  }, [chats, search]);

  const messageFeed = useMemo(() => groupMessagesByDay(activeChat?.messages ?? []), [activeChat?.messages]);

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
        Conversations you&apos;ve started with new contacts. Only you and admins can see these.
      </p>

      <div
        className="flex overflow-hidden rounded-2xl border"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-md)",
          height: "calc(100vh - 260px)",
          minHeight: 420,
        }}
      >
        <div className="flex w-80 shrink-0 flex-col border-r" style={{ borderColor: "var(--border)" }}>
          <div className="relative px-3 pt-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            />
          </div>

          <NewContactForm
            endpoint="/chats/start-with-template/"
            templatePreview={TEMPLATE_PREVIEW}
            onCreated={(chat) => {
              setChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)]);
              setActiveId(chat.id);
            }}
          />

          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 && (
              <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                {chats.length === 0 ? "No chats yet — start one above." : "No chats match your search."}
              </p>
            )}
            {filteredChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={activeId === chat.id}
                onClick={() => setActiveId(chat.id)}
                secondaryLine=""
              />
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          {!activeChat ? (
            <div className="flex flex-1 items-center justify-center text-sm" style={{ color: "var(--text-faint)" }}>
              Select a chat, or start a new one.
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
                <div className="relative shrink-0">
                  <Avatar name={activeChat.lead.name || activeChat.lead.phone_number} size={38} />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2"
                    style={{ background: "var(--whatsapp-strong)", borderColor: "var(--surface)" }}
                    title="WhatsApp"
                  >
                    <MessageCircle size={9} color="white" strokeWidth={2.5} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {activeChat.lead.name || activeChat.lead.phone_number}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {activeChat.lead.phone_number}
                  </p>
                  <ChatHeaderTags status={activeChat.status} tags={activeChat.lead.tags} />
                </div>
              </div>

              <div className="relative flex-1 overflow-hidden">
                <div
                  ref={containerRef}
                  onScroll={onScroll}
                  className="h-full space-y-1.5 overflow-y-auto px-5 py-3"
                  style={{ background: "var(--bg)" }}
                >
                  {messageFeed.length === 0 && (
                    <p className="text-center text-sm" style={{ color: "var(--text-faint)" }}>
                      No messages yet.
                    </p>
                  )}
                  {messageFeed.map((item) =>
                    item.kind === "divider" ? (
                      <DateDivider key={`divider-${item.label}`} label={item.label} />
                    ) : (
                      <div
                        key={item.message.id}
                        className={`flex items-end gap-1.5 ${item.message.direction === "out" ? "justify-end" : "justify-start"}`}
                      >
                        {item.message.direction === "in" && (
                          <Avatar name={activeChat.lead.name || activeChat.lead.phone_number} size={26} />
                        )}
                        <div
                          className="max-w-sm rounded-2xl px-3.5 py-2.5 text-sm"
                          style={
                            item.message.direction === "out"
                              ? { background: "var(--whatsapp-strong)", color: "white" }
                              : { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow-md)" }
                          }
                        >
                          <MessageContent body={item.message.body} mediaUrl={item.message.media_url} />
                          <div
                            className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80"
                            style={item.message.direction === "in" ? { color: "var(--text-faint)" } : undefined}
                          >
                            {formatTime(item.message.sent_at)}
                            {item.message.direction === "out" && <DeliveryIcon status={item.message.delivery_status} />}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
                {showJump && <JumpToLatestButton onClick={() => scrollToBottom(true)} />}
              </div>

              <form onSubmit={sendReply} className="flex gap-2 border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
                <ChatComposerInput value={draft} onChange={setDraft} placeholder="Reply as manager…" />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--whatsapp-strong)" }}
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
