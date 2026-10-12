import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChannelEntry, SyncResponse } from "@rply/schema";
import { api } from "./api";
import { channelsKey } from "./channels";
import { pushEndpoint, usePushEndpoint } from "./push";
import { applySynced } from "./queries";

export function useSync(activeId: string | undefined) {
  const queryClient = useQueryClient();
  const endpoint = usePushEndpoint();
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
            body: {
              cursor,
              wait: cursor ? 30 : 0,
              viewing: document.visibilityState === "visible" ? (viewing.current ?? null) : null,
              push_endpoint: pushEndpoint(),
            },
            signal: request.signal,
          });
          cursor = res.cursor;
          applySynced(queryClient, res.messages);
          const known = queryClient.getQueryData<ChannelEntry[]>(channelsKey);
          const changed = !known || known.length !== res.channels.length || known.some((c) => !res.channels.includes(c.id));
          if (changed) queryClient.invalidateQueries({ queryKey: channelsKey });
        } catch {
          if (stopped.signal.aborted) return;
          if (!request.signal.aborted) await new Promise((r) => setTimeout(r, 3000));
        } finally {
          stopped.signal.removeEventListener("abort", onStop);
        }
      }
    })();

    return () => stopped.abort();
  }, [queryClient]);
}
