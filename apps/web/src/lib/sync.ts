import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SyncResponse } from "@rply/schema";
import { api } from "./api";
import { markRevoked, useAdminToken, type StoredChannel } from "./channels";
import { applySynced } from "./queries";

export function useSync(channels: StoredChannel[]) {
  const queryClient = useQueryClient();
  const admin = useAdminToken();
  const tokens = channels.filter((c) => !c.revoked && !c.admin).map((c) => c.token);
  const tokensKey = tokens.join(",");

  useEffect(() => {
    if (tokens.length === 0 && !admin) return;
    const controller = new AbortController();
    let cursor: string | undefined;

    (async () => {
      while (!controller.signal.aborted) {
        try {
          const res = await api<SyncResponse>("/sync", {
            token: admin ?? undefined,
            body: { tokens, cursor, wait: cursor ? 30 : 0 },
            signal: controller.signal,
          });
          cursor = res.cursor;
          applySynced(queryClient, res.messages);
          if (res.revoked.length) markRevoked(res.revoked);
        } catch {
          if (controller.signal.aborted) return;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokensKey, admin, queryClient]);
}
