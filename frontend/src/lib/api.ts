import axios, { type InternalAxiosRequestConfig } from "axios";
import { tokenStorage } from "@/lib/tokenStorage";

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? tokenStorage.getAccess() : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The access token only lives 8 hours. Swap it for a new one using the refresh
// token (good for 7 days); one shared request so parallel 401s don't each refresh.
let refreshing: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return Promise.resolve(null);
  refreshing ??= axios
    .post<{ access: string }>(`${baseURL}/auth/refresh/`, { refresh })
    .then((res) => {
      tokenStorage.setAccess(res.data.access);
      return res.data.access;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(undefined, async (error) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthCall = original?.url?.includes("/auth/");
  if (
    typeof window === "undefined" ||
    error.response?.status !== 401 ||
    !original ||
    original._retried ||
    isAuthCall ||
    !tokenStorage.getAccess()
  ) {
    return Promise.reject(error);
  }

  original._retried = true;
  const access = await refreshAccessToken();
  if (access) {
    original.headers.Authorization = `Bearer ${access}`;
    return api(original);
  }

  tokenStorage.clear();
  if (!window.location.pathname.startsWith("/login")) window.location.assign("/login?expired=1");
  return Promise.reject(error);
});
