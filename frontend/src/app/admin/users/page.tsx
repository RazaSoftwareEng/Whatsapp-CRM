"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { StatusPill } from "@/components/ui/StatusPill";
import type { Role, UserRow } from "@/types/admin";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  tl: "Team Lead",
  agent: "Agent",
  manager: "Manager",
  company_user: "Company User",
};
const ROLE_STYLES: Record<Role, { color: string; background: string }> = {
  admin: { color: "var(--indigo)", background: "var(--indigo-soft)" },
  tl: { color: "var(--warning)", background: "var(--warning-soft)" },
  agent: { color: "var(--teal-strong)", background: "var(--teal-soft)" },
  manager: { color: "var(--orange)", background: "var(--orange-soft)" },
  company_user: { color: "var(--text-muted)", background: "var(--surface-2)" },
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      style={ROLE_STYLES[role]}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "agent" as Role,
    team_lead: "",
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const loadUsers = useCallback(() => {
    api.get<UserRow[]>("/users/").then((res) => setUsers(res.data));
  }, []);

  useEffect(() => {
    loadUsers();
    const t = setInterval(loadUsers, 6000);
    return () => clearInterval(t);
  }, [loadUsers]);

  const teamLeads = users.filter((u) => u.role === "tl");

  async function createUser(e: SubmitEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError("");
    try {
      await api.post("/users/", {
        ...newUser,
        team_lead: newUser.role === "agent" && newUser.team_lead ? Number(newUser.team_lead) : null,
      });
      setNewUser({ username: "", email: "", password: "", role: "agent", team_lead: "" });
      loadUsers();
    } catch {
      setFormError("Could not create user — check the fields.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        Total Users
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Every account with access to this workspace, admins included.
      </p>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          {users.length === 0 && (
            <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              No users yet.
            </p>
          )}
          {users.map((u, i) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-3"
              style={i > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
            >
              <Avatar name={u.username} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                  {u.username}
                </p>
                <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                  {u.email || "no email"}
                  {u.role === "agent" && u.team_lead_username ? ` · reports to ${u.team_lead_username}` : ""}
                </p>
              </div>
              <RoleBadge role={u.role} />
              <StatusPill status={u.status} />
            </div>
          ))}
        </div>

        <form
          onSubmit={createUser}
          className="h-fit rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <UserPlus size={15} style={{ color: "var(--indigo)" }} />
            <p
              className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "var(--text-muted)" }}
            >
              Add user
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

          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Role
          </label>
          <select
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <option value="agent">Agent</option>
            <option value="tl">Team Lead</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>

          {newUser.role === "agent" && (
            <>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Team Lead
              </label>
              <select
                value={newUser.team_lead}
                onChange={(e) => setNewUser({ ...newUser, team_lead: e.target.value })}
                className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                <option value="">No team lead</option>
                {teamLeads.map((tl) => (
                  <option key={tl.id} value={tl.id}>
                    {tl.username}
                  </option>
                ))}
              </select>
            </>
          )}

          <input
            placeholder="Username"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <PasswordInput
            className="mb-3"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            placeholder="Password"
            inputClassName="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            inputStyle={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            required
          />

          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--indigo), var(--teal))", boxShadow: "var(--shadow-sm)" }}
          >
            {creating ? "Creating…" : "Create user"}
          </button>
        </form>
      </div>
    </div>
  );
}
