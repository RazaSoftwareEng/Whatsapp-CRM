"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { StatusPill } from "@/components/ui/StatusPill";
import type { UserRow } from "@/types/admin";

export default function AgentsPage() {
  const [agents, setAgents] = useState<UserRow[]>([]);
  const [teamLeads, setTeamLeads] = useState<UserRow[]>([]);
  const [newAgent, setNewAgent] = useState({ username: "", email: "", password: "", team_lead: "" });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const loadAgents = useCallback(() => {
    api.get<UserRow[]>("/agents/").then((res) => setAgents(res.data));
  }, []);

  useEffect(() => {
    loadAgents();
    const t = setInterval(loadAgents, 6000);
    return () => clearInterval(t);
  }, [loadAgents]);

  useEffect(() => {
    api.get<UserRow[]>("/users/").then((res) => setTeamLeads(res.data.filter((u) => u.role === "tl")));
  }, []);

  async function createAgent(e: SubmitEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError("");
    try {
      await api.post("/agents/", {
        ...newAgent,
        team_lead: newAgent.team_lead ? Number(newAgent.team_lead) : null,
      });
      setNewAgent({ username: "", email: "", password: "", team_lead: "" });
      loadAgents();
    } catch {
      setFormError("Could not create agent — check the fields.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        Agent
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        The people who reply to chats you assign them.
      </p>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-2">
          {agents.length === 0 && (
            <div
              className="rounded-xl border border-dashed px-4 py-6 text-center text-sm"
              style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
            >
              No agents yet — add one on the right.
            </div>
          )}
          {agents.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <Avatar name={a.username} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                  {a.username}
                </p>
                <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                  {a.email || "no email"}
                  {a.team_lead_username ? ` · reports to ${a.team_lead_username}` : ""}
                </p>
              </div>
              <StatusPill status={a.status} />
            </div>
          ))}
        </div>

        <form
          onSubmit={createAgent}
          className="h-fit rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <UserPlus size={15} style={{ color: "var(--indigo)" }} />
            <p
              className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "var(--text-muted)" }}
            >
              Add agent
            </p>
          </div>
          {formError && (
            <p
              className="mb-3 rounded-lg px-2.5 py-1.5 text-xs"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              {formError}
            </p>
          )}
          <input
            placeholder="Username"
            value={newAgent.username}
            onChange={(e) => setNewAgent({ ...newAgent, username: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={newAgent.email}
            onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <PasswordInput
            className="mb-2"
            value={newAgent.password}
            onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
            placeholder="Password"
            inputClassName="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            inputStyle={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            required
          />
          <select
            value={newAgent.team_lead}
            onChange={(e) => setNewAgent({ ...newAgent, team_lead: e.target.value })}
            className="mb-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <option value="">No team lead</option>
            {teamLeads.map((tl) => (
              <option key={tl.id} value={tl.id}>
                {tl.username}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--indigo), var(--teal))", boxShadow: "var(--shadow-sm)" }}
          >
            {creating ? "Creating…" : "Create agent"}
          </button>
        </form>
      </div>
    </div>
  );
}
