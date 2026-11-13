"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  FileText,
  Headset,
  Inbox,
  MessageCircle,
  MessagesSquare,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { usePolledLoad } from "@/lib/usePolledLoad";
import { Avatar } from "@/components/ui/Avatar";
import { CostSavingNote } from "@/components/ui/CostSavingNote";
import { LoadErrorBanner, StatSkeleton } from "@/components/ui/LoadErrorBanner";
import { SimpleLineChart, type ChartPoint } from "@/components/ui/SimpleLineChart";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ChatRow, Message, UserRow } from "@/types/admin";
import type { DashboardStats, ProposalActivity } from "@/types/companies";

type ChartRange = 7 | 30 | 90;

function buildDailyCounts(dates: string[], days: ChartRange): ChartPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets.set(d.toDateString(), 0);
  }
  for (const iso of dates) {
    const key = new Date(iso).toDateString();
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([key, value]) => ({
    label: new Date(key).toLocaleDateString([], { month: "short", day: "numeric" }),
    value,
  }));
}

const EMPTY_PROPOSAL_STATS: DashboardStats = {
  total: 0,
  pending_review: 0,
  approved: 0,
  rejected: 0,
  changes_requested: 0,
  today: 0,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposalStats, setProposalStats] = useState<DashboardStats>(EMPTY_PROPOSAL_STATS);
  const [proposalActivity, setProposalActivity] = useState<ProposalActivity[]>([]);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [chartRange, setChartRange] = useState<ChartRange>(30);

  const loadData = useCallback(
    () =>
      Promise.all([
        api.get<ChatRow[]>("/chats/").then((res) => setChats(res.data)),
        api.get<UserRow[]>("/users/").then((res) => setUsers(res.data)),
        api.get<Message[]>("/messages/").then((res) => setMessages(res.data)),
        api.get<DashboardStats>("/proposals/dashboard/").then((res) => setProposalStats(res.data)),
        api.get<ProposalActivity[]>("/proposals/activity/?limit=5").then((res) => setProposalActivity(res.data)),
      ]),
    []
  );

  const { state: loadState, retry } = usePolledLoad(loadData);
  const show = (value: number) => (loadState === "loading" ? <StatSkeleton /> : loadState === "error" ? "—" : value);

  const unassigned = chats.filter((c) => c.status === "unassigned");
  const inProgress = chats.filter((c) => c.status === "in_progress");
  const closed = chats.filter((c) => c.status === "closed");
  const agents = users.filter((u) => u.role === "agent");
  const failedMessages = messages.filter((m) => m.delivery_status === "failed");

  const stats = [
    { label: "Total leads", value: chats.length, icon: Inbox, color: "var(--indigo)", soft: "var(--indigo-soft)" },
    {
      label: "Unassigned",
      value: unassigned.length,
      icon: MessagesSquare,
      color: "var(--warning)",
      soft: "var(--warning-soft)",
    },
    {
      label: "Active chats",
      value: inProgress.length,
      icon: MessagesSquare,
      color: "var(--teal-strong)",
      soft: "var(--teal-soft)",
    },
    { label: "Closed", value: closed.length, icon: MessageCircle, color: "var(--success)", soft: "var(--success-soft)" },
    { label: "Agents", value: agents.length, icon: Users, color: "var(--success)", soft: "var(--success-soft)" },
    {
      label: "Failed messages",
      value: failedMessages.length,
      icon: MessagesSquare,
      color: "var(--danger)",
      soft: "var(--danger-soft)",
      onClick: () => setShowFailedModal(true),
    },
  ];

  const chartData = useMemo(
    () => buildDailyCounts(chats.map((c) => c.lead.created_at), chartRange),
    [chats, chartRange]
  );

  const failedList = [...failedMessages].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );

  const pipeline = [
    { key: "unassigned", label: "Unassigned", count: unassigned.length, color: "var(--warning)" },
    { key: "in_progress", label: "In progress", count: inProgress.length, color: "var(--teal-strong)" },
    { key: "closed", label: "Closed", count: closed.length, color: "var(--success)" },
  ];
  const pipelineTotal = Math.max(chats.length, 1);

  const chatById = new Map(chats.map((c) => [c.id, c]));
  const recentMessages = [...messages]
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    .slice(0, 8);

  const workload = agents.map((agent) => {
    const agentChats = chats.filter((c) => c.assigned_user === agent.id);
    return {
      agent,
      total: agentChats.length,
      inProgress: agentChats.filter((c) => c.status === "in_progress").length,
      closed: agentChats.filter((c) => c.status === "closed").length,
    };
  });

  const quickActions = [
    { label: "View leads", desc: "See every inbound chat", href: "/admin/leads", icon: Inbox, color: "var(--indigo)", soft: "var(--indigo-soft)" },
    { label: "View chats", desc: "Open the chat inbox", href: "/admin/chats", icon: MessageCircle, color: "var(--teal-strong)", soft: "var(--teal-soft)" },
    { label: "Manage agents", desc: "Add or review agents", href: "/admin/agents", icon: Headset, color: "var(--success)", soft: "var(--success-soft)" },
    { label: "View proposals", desc: "Check all proposals", href: "/admin/proposals", icon: FileText, color: "var(--orange)", soft: "var(--orange-soft)" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="border-l-4 pl-3" style={{ borderColor: "var(--indigo)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Welcome back,
          </p>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
            {user?.username ?? "Admin"} 👋
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
            Overview of your WhatsApp CRM activity.
          </p>
        </div>
        <button
          onClick={() => setShowFailedModal(true)}
          title="Failed messages"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors hover:opacity-80"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          <Bell size={17} />
          {failedMessages.length > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
              style={{ background: "var(--danger)" }}
            >
              {failedMessages.length}
            </span>
          )}
        </button>
      </div>

      {loadState === "error" && <LoadErrorBanner onRetry={retry} />}

      <CostSavingNote accent="var(--indigo)" />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            onClick={s.onClick}
            className={`relative overflow-hidden rounded-2xl border p-4 transition-colors ${s.onClick ? "cursor-pointer hover:bg-[var(--surface-2)]" : ""}`}
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: s.soft, color: s.color }}
            >
              <s.icon size={19} />
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
        className="mb-8 rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="mb-4 flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: "var(--orange-soft)", color: "var(--orange)" }}
          >
            <Zap size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Quick actions
            </h2>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Get started with your daily tasks
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center gap-2.5 rounded-xl border p-3 transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: a.soft, color: a.color }}
              >
                <a.icon size={16} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                  {a.label}
                </p>
                <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                  {a.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div
          className="rounded-2xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                New leads over time
              </h2>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                How many new contacts came in each day
              </p>
            </div>
            <div className="flex gap-1 rounded-full p-1" style={{ background: "var(--surface-2)" }}>
              {([7, 30, 90] as ChartRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setChartRange(r)}
                  className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                  style={
                    chartRange === r
                      ? { background: "var(--indigo)", color: "white" }
                      : { color: "var(--text-muted)" }
                  }
                >
                  {r}D
                </button>
              ))}
            </div>
          </div>
          <SimpleLineChart data={chartData} color="var(--indigo)" />
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <h2 className="mb-4 text-sm font-semibold" style={{ color: "var(--text)" }}>
            Recent activity
          </h2>
          {recentMessages.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              No messages yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {recentMessages.slice(0, 6).map((m) => {
                const chat = chatById.get(m.chat);
                const name = chat?.lead.name || chat?.lead.phone_number || "Unknown";
                return (
                  <div key={m.id} className="flex items-start gap-3">
                    <Avatar name={name} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium" style={{ color: "var(--text)" }}>
                        {name}{" "}
                        <span style={{ color: "var(--text-faint)" }}>
                          · {m.direction === "in" ? "received" : "sent"}
                        </span>
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                        {m.body || "(media)"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px]" style={{ color: "var(--text-faint)" }}>
                      {formatTime(m.sent_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className="mb-8 rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <h2 className="mb-4 text-sm font-semibold" style={{ color: "var(--text)" }}>
          Chat pipeline
        </h2>
        <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
          {pipeline.map((stage) => (
            <div
              key={stage.key}
              style={{ width: `${(stage.count / pipelineTotal) * 100}%`, background: stage.color }}
              title={`${stage.label}: ${stage.count}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {pipeline.map((stage) => (
            <div key={stage.key} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
              {stage.label} — <span style={{ color: "var(--text)" }}>{show(stage.count)}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="mb-8 rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Proposals
          </h2>
          <Link
            href="/admin/proposals"
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "var(--indigo)" }}
          >
            View all proposals <ArrowRight size={13} />
          </Link>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Total", value: proposalStats.total, color: "var(--indigo)" },
            { label: "Pending review", value: proposalStats.pending_review, color: "var(--warning)" },
            { label: "Approved", value: proposalStats.approved, color: "var(--success)" },
            { label: "Rejected", value: proposalStats.rejected, color: "var(--danger)" },
            { label: "Changes requested", value: proposalStats.changes_requested, color: "var(--orange)" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
              <p className="text-xl font-semibold tabular-nums" style={{ color: s.color }}>
                {show(s.value)}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {proposalActivity.length === 0 ? (
          <p className="py-4 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            No proposal activity yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {proposalActivity.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "var(--indigo-soft)", color: "var(--indigo)" }}
                >
                  <FileText size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                    {a.proposal_title}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {a.action_display} {a.actor_username ? `by ${a.actor_username}` : "via review link"}
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

      <div
        className="mb-8 rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <h2 className="mb-4 text-sm font-semibold" style={{ color: "var(--text)" }}>
          Agent workload
        </h2>
        {workload.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            No agents yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {workload.map((w) => (
              <div key={w.agent.id} className="flex items-center gap-3">
                <Avatar name={w.agent.username} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                    {w.agent.username}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {w.inProgress} active · {w.closed} closed
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  {w.total}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Needs attention
          </h2>
          <Link
            href="/admin/leads"
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "var(--indigo)" }}
          >
            View all leads <ArrowRight size={13} />
          </Link>
        </div>

        {unassigned.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            Nothing waiting — inbox is clear.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {unassigned.slice(0, 5).map((chat) => {
              const name = chat.lead.name || chat.lead.phone_number;
              return (
                <div key={chat.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <Avatar name={name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                      {name}
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                      {chat.lead.phone_number}
                    </p>
                  </div>
                  <StatusPill status={chat.status} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showFailedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowFailedModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Failed messages
                </h2>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {failedList.length} message{failedList.length === 1 ? "" : "s"} didn&apos;t deliver
                </p>
              </div>
              <button
                onClick={() => setShowFailedModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-70"
                style={{ color: "var(--text-faint)" }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {failedList.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                  No failed messages.
                </p>
              ) : (
                failedList.map((m) => {
                  const chat = chatById.get(m.chat);
                  const name = chat?.lead.name || chat?.lead.phone_number || "Unknown";
                  return (
                    <Link
                      key={m.id}
                      href={`/admin/chats?chat=${m.chat}`}
                      onClick={() => setShowFailedModal(false)}
                      className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <Avatar name={name} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                          {name}
                        </p>
                        <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                          {chat?.lead.phone_number}
                        </p>
                        <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-muted)" }}>
                          {m.body || "(media)"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px]" style={{ color: "var(--text-faint)" }}>
                        {formatTime(m.sent_at)}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
