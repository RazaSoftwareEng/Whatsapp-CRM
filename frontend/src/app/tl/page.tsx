"use client";

import { useCallback, useState } from "react";
import { CalendarDays, Headset, Inbox, MessagesSquare } from "lucide-react";
import { api } from "@/lib/api";
import { usePolledLoad } from "@/lib/usePolledLoad";
import { Avatar } from "@/components/ui/Avatar";
import { LoadErrorBanner, StatSkeleton } from "@/components/ui/LoadErrorBanner";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ChatRow, UserRow } from "@/types/admin";
import type { ChatStats } from "@/types/companies";

const EMPTY_CHAT_STATS: ChatStats = { total: 0, active: 0, closed: 0, today: 0, new_today: 0 };

export default function TLDashboardPage() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [agents, setAgents] = useState<UserRow[]>([]);
  const [chatStats, setChatStats] = useState<ChatStats>(EMPTY_CHAT_STATS);

  const loadData = useCallback(
    () =>
      Promise.all([
        api.get<ChatRow[]>("/chats/").then((res) => setChats(res.data)),
        api.get<UserRow[]>("/agents/").then((res) => setAgents(res.data)),
        api.get<ChatStats>("/chats/stats/").then((res) => setChatStats(res.data)),
      ]),
    []
  );

  const { state: loadState, retry } = usePolledLoad(loadData);
  const show = (value: number) => (loadState === "loading" ? <StatSkeleton /> : loadState === "error" ? "—" : value);

  const unassigned = chats.filter((c) => c.status === "unassigned");
  const inProgress = chats.filter((c) => c.status === "in_progress");
  const closed = chats.filter((c) => c.status === "closed");

  const stats = [
    { label: "Team chats", value: chats.length, icon: Inbox, color: "var(--teal-strong)", soft: "var(--teal-soft)" },
    {
      label: "Unassigned",
      value: unassigned.length,
      icon: MessagesSquare,
      color: "var(--warning)",
      soft: "var(--warning-soft)",
    },
    {
      label: "Active",
      value: inProgress.length,
      icon: MessagesSquare,
      color: "var(--indigo)",
      soft: "var(--indigo-soft)",
    },
    { label: "Agents", value: agents.length, icon: Headset, color: "var(--success)", soft: "var(--success-soft)" },
    {
      label: "New chats today",
      value: chatStats.new_today,
      icon: CalendarDays,
      color: "var(--orange)",
      soft: "var(--orange-soft)",
    },
  ];

  const workload = agents.map((agent) => {
    const agentChats = chats.filter((c) => c.assigned_user === agent.id);
    return {
      agent,
      total: agentChats.length,
      inProgress: agentChats.filter((c) => c.status === "in_progress").length,
      closed: agentChats.filter((c) => c.status === "closed").length,
    };
  });

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        Team dashboard
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Overview of your team&apos;s chat activity.
      </p>

      {loadState === "error" && <LoadErrorBanner onRetry={retry} />}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
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
        <h2 className="mb-4 text-sm font-semibold" style={{ color: "var(--text)" }}>
          Agent status
        </h2>
        {workload.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            No agents assigned to your team yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {workload.map((w) => (
              <div key={w.agent.id} className="flex items-center gap-3">
                <Avatar name={w.agent.username} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                    {w.agent.username}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {w.inProgress} active · {w.closed} closed
                  </p>
                </div>
                <StatusPill status={w.agent.status} />
                <p className="w-6 text-right text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                  {w.total}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
