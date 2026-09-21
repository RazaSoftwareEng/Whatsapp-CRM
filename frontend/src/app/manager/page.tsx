"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  MessageCircle,
  RefreshCw,
  Radio,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { usePolledLoad } from "@/lib/usePolledLoad";
import { LoadErrorBanner, StatSkeleton } from "@/components/ui/LoadErrorBanner";
import type { ChatStats, DashboardStats, ProposalActivity } from "@/types/companies";

const EMPTY_STATS: DashboardStats = {
  total: 0,
  pending_review: 0,
  approved: 0,
  rejected: 0,
  changes_requested: 0,
  today: 0,
};
const EMPTY_CHAT_STATS: ChatStats = { total: 0, active: 0, closed: 0, today: 0, new_today: 0 };

export default function ManagerDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [chatStats, setChatStats] = useState<ChatStats>(EMPTY_CHAT_STATS);
  const [activity, setActivity] = useState<ProposalActivity[]>([]);

  const loadData = useCallback(
    () =>
      Promise.all([
        api.get<DashboardStats>("/proposals/dashboard/").then((res) => setStats(res.data)),
        api.get<ChatStats>("/chats/stats/").then((res) => setChatStats(res.data)),
        api.get<ProposalActivity[]>("/proposals/activity/?limit=10").then((res) => setActivity(res.data)),
      ]),
    []
  );

  const { state: loadState, retry } = usePolledLoad(loadData);
  const show = (value: number) => (loadState === "loading" ? <StatSkeleton /> : loadState === "error" ? "—" : value);

  const cards = [
    { label: "Total proposals", value: stats.total, icon: FileText, color: "var(--indigo)", soft: "var(--indigo-soft)" },
    {
      label: "Pending review",
      value: stats.pending_review,
      icon: Clock,
      color: "var(--warning)",
      soft: "var(--warning-soft)",
    },
    {
      label: "Approved",
      value: stats.approved,
      icon: CheckCircle2,
      color: "var(--success)",
      soft: "var(--success-soft)",
    },
    { label: "Rejected", value: stats.rejected, icon: XCircle, color: "var(--danger)", soft: "var(--danger-soft)" },
    {
      label: "Changes requested",
      value: stats.changes_requested,
      icon: RefreshCw,
      color: "var(--orange)",
      soft: "var(--orange-soft)",
    },
    {
      label: "Today's proposals",
      value: stats.today,
      icon: CalendarDays,
      color: "var(--teal-strong)",
      soft: "var(--teal-soft)",
    },
  ];

  const chatCards = [
    { label: "Total chats", value: chatStats.total, icon: MessageCircle, color: "var(--indigo)", soft: "var(--indigo-soft)" },
    { label: "Active chats", value: chatStats.active, icon: Radio, color: "var(--warning)", soft: "var(--warning-soft)" },
    {
      label: "Closed chats",
      value: chatStats.closed,
      icon: CheckCircle2,
      color: "var(--success)",
      soft: "var(--success-soft)",
    },
    {
      label: "Today's chats",
      value: chatStats.today,
      icon: CalendarDays,
      color: "var(--teal-strong)",
      soft: "var(--teal-soft)",
    },
  ];

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        Manager Dashboard
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Track the proposals you have sent out for review.
      </p>

      {loadState === "error" && <LoadErrorBanner onRetry={retry} />}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
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

      <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text)" }}>
        Chats
      </h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {chatCards.map((s) => (
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

      <div
        className="rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Recent activity
          </h2>
          <Link
            href="/manager/proposals"
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "var(--orange)" }}
          >
            View all proposals <ArrowRight size={13} />
          </Link>
        </div>

        {activity.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            No activity yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                    {a.proposal_title}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {a.action_display} {a.actor_username ? `by ${a.actor_username}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {formatTime(a.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
