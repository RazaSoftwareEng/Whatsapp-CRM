import { useEffect, useState } from "react";

export type LoadState = "loading" | "ready" | "error";

const RETRY_DELAY_MS = 2000;

/** Runs `load` on mount and then every `intervalMs`. Stays in "loading" until the
 * first success; after `maxAttempts` consecutive failures flips to "error" (and
 * keeps polling, so it recovers on its own if the server comes back). `load` must
 * return a promise that rejects when any of its requests fail, and be stable
 * (wrap it in useCallback). */
export function usePolledLoad(load: () => Promise<unknown>, intervalMs = 6000, maxAttempts = 3) {
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;

    async function tick() {
      try {
        await load();
        failures = 0;
        if (!cancelled) setState("ready");
      } catch {
        failures += 1;
        if (!cancelled && failures >= maxAttempts) setState("error");
      }
      if (!cancelled) timer = setTimeout(tick, failures > 0 && failures < maxAttempts ? RETRY_DELAY_MS : intervalMs);
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load, intervalMs, maxAttempts, attempt]);

  function retry() {
    setState("loading");
    setAttempt((n) => n + 1);
  }

  return { state, retry };
}
