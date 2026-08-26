"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { Building2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { isValidUaePkPhone } from "@/lib/phone";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { StatusPill } from "@/components/ui/StatusPill";
import type { CompanyRow, CompanyStatus } from "@/types/companies";

const emptyCompany = { company_name: "", contact_person: "", email: "", phone: "", status: "active" as CompanyStatus };

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [newCompany, setNewCompany] = useState(emptyCompany);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  const load = useCallback(() => {
    api.get<CompanyRow[]>("/companies/").then((res) => setCompanies(res.data));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const phoneValid = isValidUaePkPhone(newCompany.phone);

  async function createCompany(e: SubmitEvent) {
    e.preventDefault();
    if (!phoneValid) return;
    setCreating(true);
    setFormError("");
    try {
      await api.post("/companies/", newCompany);
      setNewCompany(emptyCompany);
      load();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { email?: string[] } } })?.response?.data;
      setFormError(data?.email?.[0] || "Could not create company — check the fields (email must be unique).");
    } finally {
      setCreating(false);
    }
  }

  async function deleteCompany(id: number) {
    setDeletingId(id);
    setRowError(null);
    try {
      await api.delete(`/companies/${id}/`);
      load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setRowError({ id, message: detail || "Could not delete this company." });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        Companies
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Every company registered across all proposals, shared by every manager.
      </p>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          {companies.length === 0 && (
            <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
              No companies yet.
            </p>
          )}
          {companies.map((c, i) => (
            <div key={c.id} className="px-4 py-3" style={i > 0 ? { borderTop: "1px solid var(--border)" } : undefined}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                    {c.company_name}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {c.contact_person ? `${c.contact_person} · ` : ""}
                    {c.email}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </p>
                </div>
                <StatusPill status={c.status ?? "active"} />
                <button
                  onClick={() => deleteCompany(c.id)}
                  disabled={deletingId === c.id}
                  className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:opacity-70 disabled:opacity-40"
                  style={{ color: "var(--danger)" }}
                  title="Delete company"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {rowError?.id === c.id && (
                <p className="mt-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                  {rowError.message}
                </p>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={createCompany}
          className="h-fit rounded-2xl border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={15} style={{ color: "var(--indigo)" }} />
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
              Add company
            </p>
          </div>
          {formError && (
            <p className="mb-3 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
              {formError}
            </p>
          )}

          <input
            placeholder="Company name"
            value={newCompany.company_name}
            onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            required
          />
          <input
            placeholder="Contact person"
            value={newCompany.contact_person}
            onChange={(e) => setNewCompany({ ...newCompany, contact_person: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            placeholder="Email"
            type="email"
            value={newCompany.email}
            onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
            className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--indigo)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            required
          />
          <div className="mb-3">
            <PhoneInput
              value={newCompany.phone}
              onChange={(v) => setNewCompany({ ...newCompany, phone: v })}
              focusColor="var(--indigo)"
            />
          </div>

          <button
            type="submit"
            disabled={creating || !phoneValid}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--indigo), var(--teal))", boxShadow: "var(--shadow-sm)" }}
          >
            {creating ? "Creating…" : "Create company"}
          </button>
        </form>
      </div>
    </div>
  );
}
