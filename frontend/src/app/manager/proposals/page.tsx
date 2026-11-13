"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock, FileText, Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, isSameDay } from "@/lib/format";
import { usePolledLoad } from "@/lib/usePolledLoad";
import { LoadErrorBanner, StatSkeleton } from "@/components/ui/LoadErrorBanner";
import { StatusPill } from "@/components/ui/StatusPill";
import type { DashboardStats, ProposalRow, ProposalStatus } from "@/types/companies";

const STATUS_OPTIONS: { value: ProposalStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "changes_requested", label: "Changes requested" },
];

type DateRange = "all" | "today" | "week" | "month" | "year";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

function isWithinRange(iso: string, range: DateRange): boolean {
  if (range === "all") return true;
  const date = new Date(iso);
  const now = new Date();
  if (range === "today") return isSameDay(date, now);
  if (range === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return date >= weekAgo && date <= now;
  }
  if (range === "month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  return date.getFullYear() === now.getFullYear(); // year
}

const EMPTY_STATS: DashboardStats = {
  total: 0,
  pending_review: 0,
  approved: 0,
  rejected: 0,
  changes_requested: 0,
  today: 0,
};

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
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "">("");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const loadProposals = useCallback(
    () =>
      Promise.all([
        api.get<ProposalRow[]>("/proposals/").then((res) => setProposals(res.data)),
        api.get<DashboardStats>("/proposals/dashboard/").then((res) => setStats(res.data)),
      ]),
    []
  );

  const { state: loadState, retry } = usePolledLoad(loadProposals);
  const show = (value: number) => (loadState === "loading" ? <StatSkeleton /> : loadState === "error" ? "—" : value);

  const cards = [
    { label: "Total proposals", value: stats.total, icon: FileText, color: "var(--indigo)", soft: "var(--indigo-soft)" },
    {
      label: "Approved",
      value: stats.approved,
      icon: CheckCircle2,
      color: "var(--success)",
      soft: "var(--success-soft)",
    },
    { label: "Pending review", value: stats.pending_review, icon: Clock, color: "var(--warning)", soft: "var(--warning-soft)" },
    {
      label: "Today's proposals",
      value: stats.today,
      icon: CalendarDays,
      color: "var(--teal-strong)",
      soft: "var(--teal-soft)",
    },
  ];

  const filtered = useMemo(() => {
    return proposals.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!isWithinRange(p.created_at, dateRange)) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return p.title.toLowerCase().includes(q) || p.company.company_name.toLowerCase().includes(q);
    });
  }, [proposals, statusFilter, dateRange, search]);

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
        Confirmation &amp; approval requests you have sent out.
      </p>

      {loadState === "error" && <LoadErrorBanner onRetry={retry} />}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border p-4"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <div
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: s.soft, color: s.color }}
            >
              <s.icon size={18} />
            </div>
            <p className="text-2xl font-semibold tabular-nums" style={{ color: "var(--text)" }}>
              {show(s.value)}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {DATE_RANGE_OPTIONS.map((o) => {
          const isActive = dateRange === o.value;
          return (
            <button
              key={o.value}
              onClick={() => setDateRange(o.value)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                isActive
                  ? { background: "var(--orange)", color: "white" }
                  : { background: "var(--surface-2)", color: "var(--text-muted)" }
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>

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
