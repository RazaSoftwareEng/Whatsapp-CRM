"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ProposalRow, ProposalStatus } from "@/types/companies";

const STATUS_OPTIONS: { value: ProposalStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "changes_requested", label: "Changes requested" },
];

export default function ManagerProposalsPage() {
  return (
    <Suspense fallback={null}>
      <ManagerProposalsPageInner />
    </Suspense>
  );
}

function ManagerProposalsPageInner() {
  const searchParams = useSearchParams();
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "">("");

  const loadProposals = useCallback(() => {
    api.get<ProposalRow[]>("/proposals/").then((res) => setProposals(res.data));
  }, []);

  useEffect(() => {
    loadProposals();
    const t = setInterval(loadProposals, 6000);
    return () => clearInterval(t);
  }, [loadProposals]);

  const filtered = proposals.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return p.title.toLowerCase().includes(q) || p.company.company_name.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
          Proposals
        </h1>
        <Link
          href="/manager/proposals/new"
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, var(--orange), var(--indigo))", boxShadow: "var(--shadow-sm)" }}
        >
          <Plus size={15} />
          Create Proposal
        </Link>
      </div>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Confirmation & approval requests you have sent out.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-faint)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or company"
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--orange)]"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProposalStatus | "")}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--orange)]"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className="overflow-hidden rounded-2xl border"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>
                Company
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>
                Updated
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                  No proposals found.
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="max-w-[280px] truncate px-4 py-3 font-medium" style={{ color: "var(--text)" }}>
                  {p.company.company_name}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={p.status} />
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-faint)" }}>
                  {formatDate(p.updated_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/manager/proposals/${p.id}`} className="text-xs font-medium" style={{ color: "var(--orange)" }}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
