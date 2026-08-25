"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, MessageSquareWarning, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import { BrandHeader } from "@/components/ui/BrandHeader";
import { FormattedMessage } from "@/components/ui/FormattedMessage";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ProposalRow } from "@/types/companies";

type PendingAction = "reject" | "request-changes" | null;

export default function ReviewPage() {
  const params = useParams<{ token: string }>();

  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [confirmed, setConfirmed] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  function load() {
    api
      .get<ProposalRow>(`/review/${params.token}/`)
      .then((res) => setProposal(res.data))
      .catch(() => setLoadError("This review link is invalid or no longer available."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  async function submitAction(action: "approve" | "reject" | "request-changes") {
    setSubmitting(true);
    setActionError("");
    try {
      const res = await api.post<ProposalRow>(`/review/${params.token}/${action}/`, {
        confirmed: true,
        note,
      });
      setProposal(res.data);
      setPendingAction(null);
      setNote("");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setActionError(detail || "Could not submit your decision — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-xl">
        <BrandHeader label="Confirmation & Approval Portal" />

        {loading && (
          <p className="py-10 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            Loading…
          </p>
        )}

        {!loading && loadError && (
          <p
            className="rounded-2xl border px-4 py-6 text-center text-sm"
            style={{ background: "var(--danger-soft)", borderColor: "var(--border)", color: "var(--danger)" }}
          >
            {loadError}
          </p>
        )}

        {!loading && proposal && (
          <div
            className="rounded-2xl border p-6"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
          >
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: "var(--text-faint)" }}>
              Proposal
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                {proposal.title}
              </h1>
              <StatusPill status={proposal.status} />
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="font-medium" style={{ color: "var(--text-faint)" }}>
                  Company
                </p>
                <p style={{ color: "var(--text)" }}>{proposal.company.company_name}</p>
              </div>
              <div>
                <p className="font-medium" style={{ color: "var(--text-faint)" }}>
                  Contact Person
                </p>
                <p style={{ color: "var(--text)" }}>{proposal.company.contact_person || "—"}</p>
              </div>
              <div>
                <p className="font-medium" style={{ color: "var(--text-faint)" }}>
                  Phone Number
                </p>
                <p style={{ color: "var(--text)" }}>{proposal.company.phone || "—"}</p>
              </div>
              <div>
                <p className="font-medium" style={{ color: "var(--text-faint)" }}>
                  Email
                </p>
                <p style={{ color: "var(--text)" }}>{proposal.company.email}</p>
              </div>
            </div>

            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: "var(--text-faint)" }}>
              Message for your review
            </p>
            <div
              className="mb-5 rounded-xl border p-4"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <FormattedMessage text={proposal.message} />
            </div>

            {actionError && (
              <p
                className="mb-4 rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
              >
                {actionError}
              </p>
            )}

            {proposal.status === "pending_review" ? (
              <>
                <label
                  className="mb-4 flex cursor-pointer items-start gap-2 rounded-xl p-3 text-xs"
                  style={{ background: "var(--warning-soft)", color: "var(--text)" }}
                >
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded"
                  />
                  I confirm that I have read, understood, and approve the content above, and I am authorized to
                  make this decision on behalf of the company.
                </label>

                {pendingAction ? (
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
                        onClick={() => submitAction(pendingAction)}
                        disabled={submitting}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        style={{ background: "var(--danger)" }}
                      >
                        Confirm {pendingAction === "reject" ? "reject" : "request changes"}
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
                  <>
                    <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      What would you like to do?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => submitAction("approve")}
                        disabled={!confirmed || submitting}
                        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                        style={{ background: "var(--success)" }}
                      >
                        <Check size={14} />
                        Approve
                      </button>
                      <button
                        onClick={() => setPendingAction("reject")}
                        disabled={!confirmed || submitting}
                        className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40"
                        style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                      >
                        <X size={14} />
                        Reject
                      </button>
                      <button
                        onClick={() => setPendingAction("request-changes")}
                        disabled={!confirmed || submitting}
                        className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40"
                        style={{ borderColor: "var(--orange)", color: "var(--orange)" }}
                      >
                        <MessageSquareWarning size={14} />
                        Request Changes
                      </button>
                    </div>
                    {!confirmed && (
                      <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
                        Please check the confirmation box above to enable these actions.
                      </p>
                    )}
                  </>
                )}
              </>
            ) : (
              <div
                className="rounded-xl border p-4 text-center text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-muted)" }}
              >
                This proposal has already been {proposal.status_display.toLowerCase()} — last updated{" "}
                {formatDate(proposal.updated_at)} {formatTime(proposal.updated_at)}.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
