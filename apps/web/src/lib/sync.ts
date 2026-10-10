import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Message, SyncResponse } from "@rply/schema";
import { api } from "./api";
import { markRevoked, type StoredChannel } from "./channels";
import { mergeMessages, statusKey } from "./queries";

export function useSync(channels: StoredChannel[]) {
  const queryClient = useQueryClient();
  const tokens = channels.filter((c) => !c.revoked).map((c) => c.token);
  const tokensKey = tokens.join(",");

  useEffect(() => {
    if (tokens.length === 0) return;
    const controller = new AbortController();
    let cursor: string | undefined;

    (async () => {
      while (!controller.signal.aborted) {
        try {
          const res = await api<SyncResponse>("/sync", {
            body: { tokens, cursor, wait: cursor ? 30 : 0 },
            signal: controller.signal,
          });
          cursor = res.cursor;
          for (const [channelId, messages] of Map.groupBy(res.messages, (m: Message) => m.channel_id)) {
            mergeMessages(queryClient, channelId, messages);
          }
          for (const status of res.statuses) queryClient.setQueryData(statusKey(status.channel_id), status);
          if (res.revoked.length) markRevoked(res.revoked);
        } catch {
          if (controller.signal.aborted) return;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokensKey, queryClient]);
}
