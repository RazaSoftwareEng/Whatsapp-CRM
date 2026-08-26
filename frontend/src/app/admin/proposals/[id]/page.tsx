"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy, ExternalLink, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import { FormattedMessage } from "@/components/ui/FormattedMessage";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ProposalActivity, ProposalRow } from "@/types/companies";

export default function AdminProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [activity, setActivity] = useState<ProposalActivity[]>([]);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.get<ProposalRow>(`/proposals/${params.id}/`).then((res) => setProposal(res.data));
    api.get<ProposalActivity[]>(`/proposals/activity/?proposal=${params.id}`).then((res) => setActivity(res.data));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyLink() {
    if (!proposal) return;
    await navigator.clipboard.writeText(`${window.location.origin}/review/${proposal.review_token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSendEmail() {
    setSending(true);
    setNotice("");
    try {
      const res = await api.post<ProposalRow>(`/proposals/${params.id}/send/`);
      setProposal(res.data);
      setNotice(res.data.email_warning ? `Send failed: ${res.data.email_warning}` : "Email sent to the company.");
      load();
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/proposals/${params.id}/`);
      router.push("/admin/proposals");
    } catch {
      setError("Could not delete this proposal — please try again.");
      setDeleting(false);
    }
  }

  if (!proposal) return null;

  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
          {proposal.title}
        </h1>
        <StatusPill status={proposal.status} />
      </div>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        {proposal.company.company_name} · created by {proposal.created_by_username || "—"} · updated{" "}
        {formatDate(proposal.updated_at)}
      </p>

      {error && (
        <p className="mb-4 max-w-xl rounded-lg px-3 py-2 text-sm" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {notice && (
        <p
          className="mb-4 max-w-xl rounded-lg px-3 py-2 text-sm"
          style={{
            background: notice.startsWith("Send failed") ? "var(--danger-soft)" : "var(--success-soft)",
            color: notice.startsWith("Send failed") ? "var(--danger)" : "var(--success)",
          }}
        >
          {notice}
        </p>
      )}

      <div className="grid max-w-3xl gap-4 lg:grid-cols-[2fr_1fr]">
        <div
          className="rounded-2xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text)" }}>
            Message
          </h2>
          <FormattedMessage text={proposal.message} />

          {proposal.last_email_error && (
            <p className="mt-4 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
              Last send error: {proposal.last_email_error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={handleSendEmail}
              disabled={sending}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--indigo)" }}
            >
              <Send size={13} />
              {sending ? "Sending…" : "Send Email"}
            </button>
            <a
              href={`/review/${proposal.review_token}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium"
              style={{ borderColor: "var(--border)", color: "var(--indigo)" }}
            >
              <ExternalLink size={13} />
              Open review link
            </a>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              <Copy size={13} />
              {copied ? "Copied!" : "Copy review link"}
            </button>

            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium"
                style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
              >
                <Trash2 size={13} />
                Delete proposal
              </button>
            ) : (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Delete this proposal permanently?
                </span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--danger)" }}
                >
                  {deleting ? "Deleting…" : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div
            className="rounded-2xl border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text)" }}>
              Company
            </h2>
            <p className="text-sm" style={{ color: "var(--text)" }}>
              {proposal.company.company_name}
            </p>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              {proposal.company.contact_person}
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {proposal.company.email}
            </p>
            {proposal.company.phone && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {proposal.company.phone}
              </p>
            )}
          </div>

          <div
            className="rounded-2xl border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text)" }}>
              Activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                No activity yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {activity.map((a) => (
                  <div key={a.id}>
                    <p className="text-xs font-medium" style={{ color: "var(--text)" }}>
                      {a.action_display} {a.actor_username ? `· ${a.actor_username}` : ""}
                    </p>
                    {a.note && (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        “{a.note}”
                      </p>
                    )}
                    {!a.actor_username && a.ip_address && (
                      <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                        via review link · {a.ip_address}
                        {a.location ? ` · ${a.location}` : ""}
                      </p>
                    )}
                    <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {formatDate(a.created_at)} {formatTime(a.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
