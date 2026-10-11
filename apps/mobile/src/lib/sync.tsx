import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SyncResponse } from "@rply/schema";
import { api } from "./api";
import { markRevoked, useOwners, type StoredChannel } from "./channels";
import { applySynced } from "./queries";

export function SyncAll({ channels }: { channels: StoredChannel[] }) {
  const owners = useOwners();
  const servers = [...new Set([...channels.map((c) => c.server), ...owners.map((o) => o.server)])];
  return servers.map((server) => (
    <SyncServer
      key={server}
      server={server}
      tokens={channels.filter((c) => c.server === server && !c.admin && !c.revoked).map((c) => c.token)}
      adminToken={owners.find((o) => o.server === server)?.token}
    />
  ));
}

function SyncServer({ server, tokens, adminToken }: { server: string; tokens: string[]; adminToken?: string }) {
  const queryClient = useQueryClient();
  const tokensKey = tokens.join(",");

  useEffect(() => {
    if (tokens.length === 0 && !adminToken) return;
    const controller = new AbortController();
    let cursor: string | undefined;

    (async () => {
      while (!controller.signal.aborted) {
        try {
          const res = await api<SyncResponse>(server, "/sync", {
            token: adminToken,
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
  }, [server, tokensKey, adminToken, queryClient]);

  return null;
}
