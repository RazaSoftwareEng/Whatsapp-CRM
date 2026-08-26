"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Inbox, MessageCircle, MessagesSquare, Users } from "lucide-react";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { DeliveryIcon } from "@/components/ui/DeliveryIcon";
import { StatusPill } from "@/components/ui/StatusPill";
import type { ChatRow, Message, UserRow } from "@/types/admin";
import type { DashboardStats, ProposalActivity } from "@/types/companies";

const EMPTY_PROPOSAL_STATS: DashboardStats = { total: 0, pending_review: 0, approved: 0, rejected: 0, changes_requested: 0 };

export default function DashboardPage() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposalStats, setProposalStats] = useState<DashboardStats>(EMPTY_PROPOSAL_STATS);
  const [proposalActivity, setProposalActivity] = useState<ProposalActivity[]>([]);

  const loadData = useCallback(() => {
    api.get<ChatRow[]>("/chats/").then((res) => setChats(res.data));
    api.get<UserRow[]>("/users/").then((res) => setUsers(res.data));
    api.get<Message[]>("/messages/").then((res) => setMessages(res.data));
    api.get<DashboardStats>("/proposals/dashboard/").then((res) => setProposalStats(res.data));
    api.get<ProposalActivity[]>("/proposals/activity/?limit=5").then((res) => setProposalActivity(res.data));
  }, []);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 6000);
    return () => clearInterval(t);
  }, [loadData]);

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
    },
  ];

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

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        Dashboard
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Overview of your WhatsApp CRM activity.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
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
              {s.value}
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
              {stage.label} — <span style={{ color: "var(--text)" }}>{stage.count}</span>
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
                {s.value}
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

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          className="rounded-2xl border p-5"
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
            <div className="flex flex-col gap-3">
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
          <h2 className="mb-4 text-sm font-semibold" style={{ color: "var(--text)" }}>
            Recent activity
          </h2>
          {recentMessages.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              No messages yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {recentMessages.map((m) => {
                const chat = chatById.get(m.chat);
                const name = chat?.lead.name || chat?.lead.phone_number || "Unknown";
                return (
                  <div key={m.id} className="flex items-start gap-3">
                    <Avatar name={name} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium" style={{ color: "var(--text)" }}>
                        {name} <span style={{ color: "var(--text-faint)" }}>· {m.direction === "in" ? "received" : "sent"}</span>
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                        {m.body || "(media)"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {formatTime(m.sent_at)}
                      {m.direction === "out" && <DeliveryIcon status={m.delivery_status} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
    </div>
  );
}
