import { useEffect } from "react";
import { useQueries, type QueryClient } from "@tanstack/react-query";
import type { ChannelEntry, ChannelsResponse, ClaimChannelResponse, CreateOwnedChannelResponse } from "@rply/schema";
import { api, ApiError, normalizeServer } from "./api";
import { forgetSession, getSessions, useSessions, type Session } from "./sessions";

export type ServerChannel = { server: string; token: string; channel: ChannelEntry };

export const channelsKey = (server: string) => ["channels", server];

export const auth = (entry: ServerChannel) => ({ token: entry.token, channel: entry.channel.id });

export function useChannels(): ServerChannel[] {
  const sessions = useSessions();
  const results = useQueries({
    queries: sessions.map((s) => ({
      queryKey: channelsKey(s.server),
      queryFn: () => api<ChannelsResponse>(s.server, "/channels", { token: s.token }).then((r) => r.channels),
      staleTime: Infinity,
    })),
  });

  const expired = sessions.filter((_, i) => results[i]?.error instanceof ApiError && (results[i].error as ApiError).status === 401);
  useEffect(() => {
    expired.forEach((s) => forgetSession(s.server));
  }, [expired.map((s) => s.server).join(",")]);

  return sessions.flatMap((s, i) => (results[i]?.data ?? []).map((channel) => ({ server: s.server, token: s.token, channel })));
}

export function markRead(queryClient: QueryClient, entry: ServerChannel, seq: number) {
  if (seq <= entry.channel.read_seq) return;
  queryClient.setQueryData<ChannelEntry[]>(channelsKey(entry.server), (all = []) =>
    all.map((c) => (c.id === entry.channel.id ? { ...c, read_seq: Math.max(c.read_seq, seq) } : c)),
  );
  api(entry.server, "/channel/read", { ...auth(entry), method: "PUT", body: { seq } }).catch(() => undefined);
}

export async function createChannel(session: Session, name: string) {
  const res = await api<CreateOwnedChannelResponse>(session.server, "/channels", { token: session.token, body: { name } });
  return { entry: { server: session.server, token: session.token, channel: res.channel }, code: res.agent_code };
}

// a claim link names its server; a bare code goes to the server picked in the form
export async function claimChannel(input: string, fallback: Session | undefined) {
  const trimmed = input.trim();
  let server = fallback?.server;
  let code = trimmed;
  try {
    const url = new URL(trimmed);
    server = normalizeServer(url.origin);
    code = url.searchParams.get("c") ?? "";
  } catch {}
  const session = getSessions().find((s) => s.server === server);
  if (!session) throw new Error(`Sign in to ${server ?? "the agent's server"} first, under Account.`);
  const res = await api<ClaimChannelResponse>(session.server, "/channels/claim", { token: session.token, body: { code } });
  return { server: session.server, token: session.token, channel: res.channel } satisfies ServerChannel;
}
