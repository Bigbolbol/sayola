"use client";

import { useCallback, useEffect, useState } from "react";
import type { Action, SayolaState } from "@/lib/types";

export interface TxResult {
  hash?: string;
  error?: string;
}

export function useSayola() {
  const [state, setState] = useState<SayolaState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<TxResult | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setState(data);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  const act = useCallback(
    async (action: Action, label: string): Promise<TxResult> => {
      setBusy(label);
      setLast(null);
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action),
        });
        const data = (await res.json()) as TxResult;
        setLast(data);
        if (data.hash) await refresh();
        return data;
      } catch (e) {
        const result = { error: e instanceof Error ? e.message : String(e) };
        setLast(result);
        return result;
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  return { state, loadError, busy, last, act, refresh };
}
