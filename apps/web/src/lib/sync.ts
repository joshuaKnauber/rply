import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SyncResponse } from "@rply/schema";
import { api } from "./api";
import { markRevoked, useAdminToken, type StoredChannel } from "./channels";
import { pushEndpoint, usePushEndpoint } from "./push";
import { applySynced } from "./queries";

export function useSync(channels: StoredChannel[], activeId: string | undefined) {
  const queryClient = useQueryClient();
  const admin = useAdminToken();
  const endpoint = usePushEndpoint();
  const tokens = channels.filter((c) => !c.revoked && !c.admin).map((c) => c.token);
  const tokensKey = tokens.join(",");
  const viewing = useRef(activeId);
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    viewing.current = activeId;
    kick.current();
  }, [activeId, endpoint]);

  useEffect(() => {
    const onVisibility = () => kick.current();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (tokens.length === 0 && !admin) return;
    const stopped = new AbortController();
    let cursor: string | undefined;

    (async () => {
      while (!stopped.signal.aborted) {
        const request = new AbortController();
        const onStop = () => request.abort();
        stopped.signal.addEventListener("abort", onStop);
        kick.current = () => request.abort();
        try {
          const res = await api<SyncResponse>("/sync", {
            token: admin ?? undefined,
            body: {
              tokens,
              cursor,
              wait: cursor ? 30 : 0,
              viewing: document.visibilityState === "visible" ? (viewing.current ?? null) : null,
              push_endpoint: pushEndpoint(),
            },
            signal: request.signal,
          });
          cursor = res.cursor;
          applySynced(queryClient, res.messages);
          if (res.revoked.length) markRevoked(res.revoked);
        } catch {
          if (stopped.signal.aborted) return;
          if (!request.signal.aborted) await new Promise((r) => setTimeout(r, 3000));
        } finally {
          stopped.signal.removeEventListener("abort", onStop);
        }
      }
    })();

    return () => stopped.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokensKey, admin, queryClient]);
}
