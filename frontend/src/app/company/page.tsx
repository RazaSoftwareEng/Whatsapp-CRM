"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, MessageSquareWarning, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { FormattedMessage } from "@/components/ui/FormattedMessage";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ProposalRow } from "@/types/companies";

type PendingAction = { proposalId: number; kind: "reject" | "request-changes" } | null;

export default function CompanyPortalPage() {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    api.get<ProposalRow[]>("/proposals/").then((res) => setProposals(res.data));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  async function approve(id: number) {
    setSubmitting(true);
    try {
      await api.post(`/proposals/${id}/approve/`);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmNoted() {
    if (!pendingAction) return;
    setSubmitting(true);
    try {
      await api.post(`/proposals/${pendingAction.proposalId}/${pendingAction.kind}/`, { note });
      setPendingAction(null);
      setNote("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        Proposals for your review
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Approve, reject, or ask for changes on documents sent to you.
      </p>

      {proposals.length === 0 && (
        <p
          className="rounded-2xl border px-4 py-8 text-center text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-faint)" }}
        >
          Nothing here yet.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {proposals.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {p.title}
              </h2>
              <StatusPill status={p.status} />
              <Link
                href={`/review/${p.review_token}`}
                className="ml-auto flex items-center gap-1 text-xs font-medium"
                style={{ color: "var(--indigo)" }}
              >
                View full document <ExternalLink size={12} />
              </Link>
            </div>
            <p className="mb-1 text-xs" style={{ color: "var(--text-faint)" }}>
              Updated {formatDate(p.updated_at)}
            </p>
            <div className="mt-2">
              <FormattedMessage text={p.message} />
            </div>

            {p.status === "pending_review" && (
              <div className="mt-4">
                {pendingAction?.proposalId === p.id ? (
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add an optional note explaining why…"
                      rows={3}
                      className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
                      style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={confirmNoted}
                        disabled={submitting}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        style={{ background: "var(--danger)" }}
                      >
                        Confirm {pendingAction.kind === "reject" ? "reject" : "request changes"}
                      </button>
                      <button
                        onClick={() => {
                          setPendingAction(null);
                          setNote("");
                        }}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => approve(p.id)}
                      disabled={submitting}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                      style={{ background: "var(--success)" }}
                    >
                      <Check size={13} />
                      Approve
                    </button>
                    <button
                      onClick={() => setPendingAction({ proposalId: p.id, kind: "request-changes" })}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium"
                      style={{ borderColor: "var(--orange)", color: "var(--orange)" }}
                    >
                      <MessageSquareWarning size={13} />
                      Request changes
                    </button>
                    <button
                      onClick={() => setPendingAction({ proposalId: p.id, kind: "reject" })}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium"
                      style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                    >
                      <X size={13} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
