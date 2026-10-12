import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChannelEntry, SyncResponse } from "@rply/schema";
import { api } from "./api";
import { channelsKey } from "./channels";
import { applySynced } from "./queries";
import { useSessions, type Session } from "./sessions";

export function SyncAll() {
  return useSessions().map((session) => <SyncServer key={session.server} session={session} />);
}

function SyncServer({ session }: { session: Session }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | undefined;

    (async () => {
      while (!controller.signal.aborted) {
        try {
          const res = await api<SyncResponse>(session.server, "/sync", {
            token: session.token,
            body: { cursor, wait: cursor ? 30 : 0 },
            signal: controller.signal,
          });
          cursor = res.cursor;
          applySynced(queryClient, res.messages);
          const known = queryClient.getQueryData<ChannelEntry[]>(channelsKey(session.server));
          if (!known || known.length !== res.channels.length || known.some((c) => !res.channels.includes(c.id))) {
            queryClient.invalidateQueries({ queryKey: channelsKey(session.server) });
          }
        } catch {
          if (controller.signal.aborted) return;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    })();

    return () => controller.abort();
  }, [session.server, session.token, queryClient]);

  return null;
}
