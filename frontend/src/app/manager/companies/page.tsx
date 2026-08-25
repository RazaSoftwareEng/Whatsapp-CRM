"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { StatusPill } from "@/components/ui/StatusPill";
import type { CompanyRow } from "@/types/companies";

export default function ManagerCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    api.get<CompanyRow[]>("/companies/").then((res) => setCompanies(res.data));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = companies.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return c.company_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        Companies
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Every company registered across all proposals — shared with every Manager.
      </p>

      <div className="relative mb-4 max-w-sm">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-faint)" }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--orange)]"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
        />
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
                Contact Person
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>
                Email
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>
                Phone
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                  No companies found.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>
                  {c.company_name}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                  {c.contact_person || "—"}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                  {c.email}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                  {c.phone || "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={c.status ?? "active"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
