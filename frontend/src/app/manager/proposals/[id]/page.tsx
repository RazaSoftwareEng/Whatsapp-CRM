"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Copy, MessageCircle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import { FormattedMessage } from "@/components/ui/FormattedMessage";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ProposalActivity, ProposalRow } from "@/types/companies";

function buildWhatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();

  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [activity, setActivity] = useState<ProposalActivity[]>([]);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.get<ProposalRow>(`/proposals/${params.id}/`).then((res) => setProposal(res.data));
    api.get<ProposalActivity[]>(`/proposals/activity/?proposal=${params.id}`).then((res) => setActivity(res.data));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleResend() {
    setResending(true);
    setNotice("");
    try {
      const res = await api.post<ProposalRow>(`/proposals/${params.id}/send/`);
      setProposal(res.data);
      setNotice(res.data.email_warning ? `Resend failed: ${res.data.email_warning}` : "Proposal sent for review.");
      load();
    } finally {
      setResending(false);
    }
  }

  async function copyLink() {
    if (!proposal) return;
    const link = `${window.location.origin}/review/${proposal.review_token}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!proposal) return null;

  const canResend = proposal.status === "draft" || proposal.status === "changes_requested";
  const reviewLink = `${typeof window !== "undefined" ? window.location.origin : ""}/review/${proposal.review_token}`;

  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
          {proposal.title}
        </h1>
        <StatusPill status={proposal.status} />
      </div>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        {proposal.company.company_name} · updated {formatDate(proposal.updated_at)}
      </p>

      {notice && (
        <p
          className="mb-4 max-w-xl rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--orange-soft)", color: "var(--orange)" }}
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
            <p
              className="mt-4 rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              Last send error: {proposal.last_email_error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {canResend && (
              <button
                onClick={handleResend}
                disabled={resending}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--orange)" }}
              >
                <RefreshCw size={13} />
                {resending ? "Sending…" : "Resend review email"}
              </button>
            )}
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              <Copy size={13} />
              {copied ? "Copied!" : "Copy review link"}
            </button>
            {proposal.company.phone && (
              <a
                href={buildWhatsappLink(proposal.company.phone, `${proposal.message}\n\n${reviewLink}`)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium"
                style={{ borderColor: "var(--border)", color: "var(--teal-strong)" }}
              >
                <MessageCircle size={13} />
                Share via WhatsApp
              </a>
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
