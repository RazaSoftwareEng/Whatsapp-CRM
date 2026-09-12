"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
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

/** Compact "add a new contact and start a chat" form used by the agent, team-lead
 * and manager views. `openSignal`, if given, pops the form open each time it
 * changes — lets a button elsewhere (e.g. the persistent sidebar) trigger this
 * without owning its state. */
export function NewContactForm({
  onCreated,
  openSignal,
  hideTrigger,
  endpoint = "/chats/start/",
  templatePreview,
  accent = "var(--whatsapp-strong)",
}: {
  onCreated: (chat: ChatRow) => void;
  openSignal?: number;
  /** Hide the built-in "New chat" toggle — use when an external button (e.g. the
   * sidebar) drives `openSignal` instead, so there isn't a duplicate button. */
  hideTrigger?: boolean;
  /** Where to POST the new contact — defaults to the plain "start a chat" flow.
   * Pass "/chats/start-with-template/" for the manager flow, which sends our
   * approved first-contact template instead of just creating an empty chat. */
  endpoint?: string;
  /** When set, shows this as a read-only preview of the first message that will
   * be sent (manager/template flow) and relabels the submit button accordingly. */
  templatePreview?: string;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const prevSignal = useRef(openSignal);

  useEffect(() => {
    if (openSignal !== undefined && openSignal !== prevSignal.current) {
      prevSignal.current = openSignal;
      setOpen(true);
    }
  }, [openSignal]);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!values.phone_number.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post<ChatRow>(endpoint, values);
      onCreated(res.data);
      setValues(EMPTY);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-3 pt-3">
      {!hideTrigger && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-colors hover:opacity-80"
          style={{ borderColor: "var(--border)", color: accent }}
        >
          <UserPlus size={13} />
          New chat
        </button>
      )}
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
          {templatePreview && (
            <div
              className="rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              <p className="mb-1 font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                First message (template)
              </p>
              {templatePreview}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !values.phone_number.trim()}
            className="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: accent }}
          >
            {submitting ? "Starting…" : templatePreview ? "Send template & start chat" : "Start chat"}
          </button>
        </form>
      )}
    </div>
  );
}
