"use client";

import { useState, type SubmitEvent } from "react";
import { LogIn, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/ui/Logo";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password, remember);
    } catch {
      setError("Invalid username or password.");
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
        className="pointer-events-none absolute -bottom-40 right-1/3 h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--indigo-soft), transparent 70%)" }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-2xl border p-8"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size={44} />
          <p className="mt-4 font-mono text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: "var(--text-faint)" }}>
            WhatsApp CRM
          </p>
          <h1 className="mt-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
            Welcome back
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Sign in to manage your conversations.
          </p>
        </div>

        {error && (
          <p
            className="mb-4 rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            {error}
          </p>
        )}

        <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Username
        </label>
        <div className="relative mb-4">
          <User
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-faint)" }}
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--teal)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            autoComplete="username"
            required
          />
        </div>

        <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Password
        </label>
        <PasswordInput
          icon
          className="mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          inputClassName="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--teal)]"
          inputStyle={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          autoComplete="current-password"
          required
        />

        <label className="mb-7 flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded accent-current"
            style={{ color: "var(--teal)" }}
          />
          Remember me
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--teal), var(--indigo))", boxShadow: "var(--shadow-md)" }}
        >
          <LogIn size={16} />
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
