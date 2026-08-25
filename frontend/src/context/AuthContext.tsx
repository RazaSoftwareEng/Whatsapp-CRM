"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { tokenStorage } from "@/lib/tokenStorage";

export type Role = "admin" | "tl" | "agent" | "manager" | "company_user";

export type User = {
  id: number;
  username: string;
  email: string;
  role: Role;
  status: string;
  phone_number: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
};

const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  tl: "/tl",
  agent: "/agent",
  manager: "/manager",
  company_user: "/company",
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = tokenStorage.getAccess();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/me/")
      .then((res) => setUser(res.data))
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string, remember = true) {
    const res = await api.post<{ access: string; refresh: string }>("/auth/login/", {
      username,
      password,
    });
    tokenStorage.save(res.data.access, res.data.refresh, remember);
    const me = await api.get<User>("/me/");
    setUser(me.data);
    router.push(ROLE_HOME[me.data.role] ?? "/agent");
  }

  function logout() {
    tokenStorage.clear();
    setUser(null);
    router.push("/login");
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
