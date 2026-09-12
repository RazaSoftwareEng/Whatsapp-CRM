"use client";

import { useCallback, useEffect, useMemo, useState, type SubmitEvent } from "react";
import { MessageCircle, Send, UserCog } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { DeliveryIcon } from "@/components/ui/DeliveryIcon";
import { formatTime } from "@/lib/format";
import { NewContactForm } from "@/components/NewContactForm";
import { MessageContent } from "@/components/ui/MessageContent";
import { JumpToLatestButton } from "@/components/ui/JumpToLatestButton";
import { ChatListControls, type ChatTab } from "@/components/ui/ChatListControls";
import { ChatListItem } from "@/components/ui/ChatListItem";
import { DateDivider } from "@/components/ui/DateDivider";
import { ChatHeaderTags } from "@/components/ui/ChatHeaderTags";
import { ChatComposerInput } from "@/components/ui/ChatComposerInput";
import { useAutoScroll } from "@/lib/useAutoScroll";
import { useNewChatRequest } from "@/context/NewChatContext";
import { groupMessagesByDay } from "@/lib/groupMessagesByDay";
import type { ChatRow, ChatDetail, UserRow } from "@/types/admin";

export default function TLChatsPage() {
  const { requestId } = useNewChatRequest();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [agents, setAgents] = useState<UserRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ChatTab>("all");
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
    api.get<UserRow[]>("/agents/").then((res) => setAgents(res.data));
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

  const counts = useMemo(
    () => ({
      all: chats.length,
      assigned: chats.filter((c) => c.assigned_user).length,
      unassigned: chats.filter((c) => !c.assigned_user).length,
    }),
    [chats]
  );

  const filteredChats = useMemo(() => {
    let list = chats;
    if (tab === "assigned") list = list.filter((c) => c.assigned_user);
    if (tab === "unassigned") list = list.filter((c) => !c.assigned_user);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          (c.lead.name || "").toLowerCase().includes(q) ||
          c.lead.phone_number.toLowerCase().includes(q) ||
          (c.last_message_body || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [chats, tab, search]);

  const messageFeed = useMemo(() => groupMessagesByDay(activeChat?.messages ?? []), [activeChat?.messages]);

  async function assignChat(userId: string) {
    if (!activeId) return;
    setAssigning(true);
    try {
      const res = await api.post<ChatRow>(`/chats/${activeId}/assign/`, {
        user_id: userId ? Number(userId) : null,
      });
      setChats((prev) => prev.map((c) => (c.id === activeId ? { ...c, ...res.data } : c)));
      setActiveChat((prev) => (prev ? { ...prev, ...res.data } : prev));
    } catch {
      alert("Could not assign this chat.");
    } finally {
      setAssigning(false);
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
        Team chats
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Every conversation across the workspace. Assign new or unassigned chats to your own agents.
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
          <ChatListControls
            search={search}
            onSearchChange={setSearch}
            tab={tab}
            onTabChange={setTab}
            counts={counts}
            accent="var(--teal-strong)"
          />
          <NewContactForm
            openSignal={requestId}
            hideTrigger
            onCreated={(chat) => {
              setChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)]);
              setActiveId(chat.id);
            }}
          />
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 && (
              <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                {chats.length === 0 ? "No chats yet." : "No chats match this filter."}
              </p>
            )}
            {filteredChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={activeId === chat.id}
                onClick={() => setActiveId(chat.id)}
                accent="var(--teal-strong)"
                activeBg="var(--teal-soft)"
                secondaryLine={chat.assigned_user_username ?? "Unassigned"}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          {!activeChat ? (
            <div className="flex flex-1 items-center justify-center text-sm" style={{ color: "var(--text-faint)" }}>
              Select a chat to view the conversation.
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
                <div className="relative shrink-0">
                  <Avatar name={activeChat.lead.name || activeChat.lead.phone_number} size={38} />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2"
                    style={{ background: "var(--teal-strong)", borderColor: "var(--surface)" }}
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
                <div className="relative shrink-0">
                  <UserCog
                    size={13}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--teal-strong)" }}
                  />
                  <select
                    value={activeChat.assigned_user ?? ""}
                    onChange={(e) => assignChat(e.target.value)}
                    disabled={assigning}
                    className="rounded-full border py-1.5 pl-7 pr-3 text-xs font-medium outline-none focus:border-[var(--teal)] disabled:opacity-50"
                    style={{ background: "var(--teal-soft)", borderColor: "transparent", color: "var(--teal-strong)" }}
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.username}
                      </option>
                    ))}
                  </select>
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
                              ? { background: "var(--teal-strong)", color: "white" }
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
                {showJump && <JumpToLatestButton onClick={() => scrollToBottom(true)} accent="var(--teal-strong)" />}
              </div>

              <form onSubmit={sendReply} className="flex gap-2 border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
                <ChatComposerInput value={draft} onChange={setDraft} placeholder="Reply as team lead…" />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--teal-strong)" }}
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
