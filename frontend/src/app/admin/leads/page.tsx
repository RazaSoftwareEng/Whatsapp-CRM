"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import type { ChatRow, ClientStatus, UserRow } from "@/types/admin";

const CLIENT_STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "first_time", label: "First time" },
  { value: "follow_up", label: "Follow up" },
  { value: "existing_client", label: "Existing client" },
];

const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  first_time: "First time",
  follow_up: "Follow up",
  existing_client: "Existing client",
};

const emptyContact = {
  company_name: "",
  name: "",
  email: "",
  phone_number: "",
  client_status: "first_time" as ClientStatus,
};

export default function LeadsPage() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [agents, setAgents] = useState<UserRow[]>([]);
  const [newContact, setNewContact] = useState(emptyContact);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(() => {
    api.get<ChatRow[]>("/chats/").then((res) => setChats(res.data));
    api.get<UserRow[]>("/agents/").then((res) => setAgents(res.data));
  }, []);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 6000);
    return () => clearInterval(t);
  }, [loadData]);

  async function assign(chatId: number, userId: string) {
    await api.post(`/chats/${chatId}/assign/`, { user_id: userId || null });
    loadData();
  }

  async function createContact(e: SubmitEvent) {
    e.preventDefault();
    if (!newContact.phone_number.trim()) return;
    setCreating(true);
    setFormError("");
    try {
      await api.post("/chats/start/", newContact);
      setNewContact(emptyContact);
      loadData();
    } catch {
      setFormError("Could not add contact — check the phone number.");
    } finally {
      setCreating(false);
    }
  }

  const unassigned = chats.filter((c) => c.status === "unassigned");

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        Leads
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Every WhatsApp conversation that has come in, and who owns it.
      </p>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Unassigned
            </h2>
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              {unassigned.length} waiting
            </span>
          </div>
          <div className="mb-8 flex flex-col gap-2">
            {unassigned.length === 0 && <EmptyRow text="Nothing waiting — inbox is clear." />}
            {unassigned.map((chat) => (
              <ChatRowItem key={chat.id} chat={chat} agents={agents} onAssign={assign} />
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              All chats
            </h2>
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>
              {chats.length} total
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {chats.length === 0 && <EmptyRow text="No chats yet." />}
            {chats.map((chat) => (
              <ChatRowItem key={chat.id} chat={chat} agents={agents} onAssign={assign} />
            ))}
          </div>
        </div>

        <form
          onSubmit={createContact}
          className="h-fit rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <UserPlus size={15} style={{ color: "var(--indigo)" }} />
            <p
              className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "var(--text-muted)" }}
            >
              New contact
            </p>
          </div>
          {formError && (
            <p
              className="mb-3 rounded-lg px-2.5 py-1.5 text-xs"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              {formError}
            </p>
          )}

          <input
            placeholder="Company name"
            value={newContact.company_name}
            onChange={(e) => setNewContact({ ...newContact, company_name: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            placeholder="Name of person"
            value={newContact.name}
            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            placeholder="Email (optional)"
            type="email"
            value={newContact.email}
            onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            placeholder="Phone number"
            value={newContact.phone_number}
            onChange={(e) => setNewContact({ ...newContact, phone_number: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            required
          />

          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Client status
          </label>
          <select
            value={newContact.client_status}
            onChange={(e) => setNewContact({ ...newContact, client_status: e.target.value as ClientStatus })}
            className="mb-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            {CLIENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={creating || !newContact.phone_number.trim()}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--indigo), var(--teal))", boxShadow: "var(--shadow-sm)" }}
          >
            {creating ? "Adding…" : "Add contact"}
          </button>
        </form>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      className="rounded-xl border border-dashed px-4 py-6 text-center text-sm"
      style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
    >
      {text}
    </div>
  );
}

function ChatRowItem({
  chat,
  agents,
  onAssign,
}: {
  chat: ChatRow;
  agents: UserRow[];
  onAssign: (chatId: number, userId: string) => void;
}) {
  const displayName = chat.lead.name || chat.lead.phone_number;
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <Avatar name={displayName} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
          {displayName}
          {chat.lead.company_name ? ` · ${chat.lead.company_name}` : ""}
        </p>
        <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
          {chat.lead.phone_number}
          {chat.assigned_user_username ? ` · ${chat.assigned_user_username}` : ""}
          {chat.lead.client_status ? ` · ${CLIENT_STATUS_LABELS[chat.lead.client_status]}` : ""}
        </p>
      </div>
      <select
        defaultValue={chat.assigned_user ?? ""}
        onChange={(e) => onAssign(chat.id, e.target.value)}
        className="ml-auto shrink-0 rounded-lg border px-2 py-1.5 text-xs outline-none"
        style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <option value="">Unassigned</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.username}
          </option>
        ))}
      </select>
    </div>
  );
}
