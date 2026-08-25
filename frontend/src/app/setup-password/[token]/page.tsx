"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { PasswordInput } from "@/components/ui/PasswordInput";

type InviteInfo = { company_name: string; email: string };

export default function SetupPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api
      .get<InviteInfo>(`/invites/${params.token}/`)
      .then((res) => setInfo(res.data))
      .catch((err) => setLoadError(err.response?.data?.detail || "This invite link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [params.token]);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setFormError("");
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/invites/${params.token}/set-password/`, {
        password,
        confirm_password: confirmPassword,
      });
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail || "Could not set your password — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden px-4"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--teal-soft), transparent 70%)" }}
      />

      <div
        className="relative w-full max-w-sm rounded-2xl border p-8"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className="mb-3 flex items-center justify-center rounded-2xl px-8 py-4"
            style={{ background: "#0b0b0d" }}
          >
            <Image src="/al-merak.webp" alt="Al Merak Tax Consultant L.L.C" width={180} height={115} priority />
          </div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
            Set your password
          </h1>
        </div>

        {loading && (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            Checking your invite…
          </p>
        )}

        {!loading && loadError && (
          <p
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            {loadError}
          </p>
        )}

        {!loading && info && !done && (
          <form onSubmit={handleSubmit}>
            <p className="mb-5 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              {info.company_name} · <span style={{ color: "var(--text)" }}>{info.email}</span>
            </p>

            {formError && (
              <p
                className="mb-4 rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
              >
                {formError}
              </p>
            )}

            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              New password
            </label>
            <PasswordInput
              icon
              className="mb-4"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a password"
              inputClassName="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--teal)]"
              inputStyle={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
              autoComplete="new-password"
              required
            />

            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Confirm password
            </label>
            <PasswordInput
              icon
              className="mb-6"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter the password"
              inputClassName="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--teal)]"
              inputStyle={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
              autoComplete="new-password"
              required
            />

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--teal), var(--indigo))", boxShadow: "var(--shadow-md)" }}
            >
              <ShieldCheck size={16} />
              {submitting ? "Saving…" : "Set password"}
            </button>
          </form>
        )}

        {done && (
          <p
            className="rounded-lg px-3 py-2 text-center text-sm"
            style={{ background: "var(--success-soft)", color: "var(--success)" }}
          >
            Password set — redirecting you to sign in…
          </p>
        )}
      </div>
    </div>
  );
}
