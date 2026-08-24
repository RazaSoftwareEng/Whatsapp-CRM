"use client";

import { useState, type SubmitEvent } from "react";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import type { ChatRow, ClientStatus } from "@/types/admin";

const CLIENT_STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "first_time", label: "First time" },
  { value: "follow_up", label: "Follow up" },
  { value: "existing_client", label: "Existing client" },
];

const EMPTY = {
  company_name: "",
  name: "",
  email: "",
  phone_number: "",
  client_status: "first_time" as ClientStatus,
};

/** Compact "add a new contact and start a chat" form used by the agent and team-lead views. */
export function NewContactForm({ onCreated }: { onCreated: (chat: ChatRow) => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!values.phone_number.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post<ChatRow>("/chats/start/", values);
      onCreated(res.data);
      setValues(EMPTY);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-3 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-colors hover:opacity-80"
        style={{ borderColor: "var(--border)", color: "var(--teal-strong)" }}
      >
        <UserPlus size={13} />
        New chat
      </button>
      {open && (
        <form onSubmit={submit} className="mt-2 flex flex-col gap-1.5">
          <input
            value={values.company_name}
            onChange={(e) => setValues({ ...values, company_name: e.target.value })}
            placeholder="Company name"
            className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:border-[var(--teal)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="Name of person"
            className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:border-[var(--teal)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
            placeholder="Email (optional)"
            type="email"
            className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:border-[var(--teal)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            value={values.phone_number}
            onChange={(e) => setValues({ ...values, phone_number: e.target.value })}
            placeholder="Phone number"
            className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:border-[var(--teal)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            required
          />
          <select
            value={values.client_status}
            onChange={(e) => setValues({ ...values, client_status: e.target.value as ClientStatus })}
            className="w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:border-[var(--teal)]"
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
            disabled={submitting || !values.phone_number.trim()}
            className="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--teal), var(--indigo))" }}
          >
            {submitting ? "Starting…" : "Start chat"}
          </button>
        </form>
      )}
    </div>
  );
}
