import { useEffect } from "react";
import * as Device from "expo-device";
import { useQueries } from "@tanstack/react-query";
import type { Channel, ClaimPairingResponse } from "@rply/schema";
import { api, ApiError, normalizeServer } from "./api";
import { createStore } from "./store";

export type StoredChannel = {
  server: string;
  channel: Channel;
  token: string;
  revoked?: boolean;
  admin?: boolean;
};

type OwnerSession = { server: string; token: string };

const paired = createStore<StoredChannel[]>("rply.channels", []);
const owners = createStore<OwnerSession[]>("rply.owners", []);
const readSeqs = createStore<Record<string, number>>("rply.read", {});

export const loadStores = () => Promise.all([paired.load(), owners.load(), readSeqs.load()]);

export const auth = (entry: StoredChannel) => ({ token: entry.token, channel: entry.admin ? entry.channel.id : undefined });

export function parsePairing(input: string, serverInput: string) {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("c");
    if (code) return { server: url.origin, code };
  } catch {}
  if (!serverInput.trim()) throw new Error("Enter the server URL, or paste the full pairing link");
  return { server: normalizeServer(serverInput), code: trimmed };
}

export async function claimPairing(input: string, serverInput: string) {
  const { server, code } = parsePairing(input, serverInput);
  const res = await api<ClaimPairingResponse>(server, "/pairings/claim", {
    body: { code, label: Device.deviceName ?? Device.modelName ?? "Phone" },
  });
  paired.update((all) => [...all.filter((c) => c.channel.id !== res.channel.id), { server, channel: res.channel, token: res.token }]);
  return res.channel;
}

export const removeChannel = (id: string) => paired.update((all) => all.filter((c) => c.channel.id !== id));

export const markRevoked = (tokens: string[]) =>
  paired.update((all) => all.map((c) => (tokens.includes(c.token) ? { ...c, revoked: true } : c)));

export const useReadSeqs = readSeqs.use;
export const markRead = (id: string, seq: number) =>
  readSeqs.update((all) => ((all[id] ?? 0) >= seq ? all : { ...all, [id]: seq }));

export const useOwners = owners.use;
export async function signInAsOwner(serverInput: string, token: string) {
  const server = normalizeServer(serverInput);
  await api(server, "/admin/channels", { token });
  owners.update((all) => [...all.filter((o) => o.server !== server), { server, token }]);
}
export const signOutOwner = (server: string) => owners.update((all) => all.filter((o) => o.server !== server));

export function useChannels(): StoredChannel[] {
  const pairedChannels = paired.use();
  const sessions = useOwners();
  const results = useQueries({
    queries: sessions.map((session) => ({
      queryKey: ["admin-channels", session.server, session.token],
      queryFn: () => api<{ channels: Channel[] }>(session.server, "/admin/channels", { token: session.token }).then((r) => r.channels),
      refetchInterval: 15_000,
    })),
  });

  const unauthorized = sessions.filter((_, i) => results[i]?.error instanceof ApiError && (results[i].error as ApiError).status === 401);
  useEffect(() => {
    unauthorized.forEach((s) => signOutOwner(s.server));
  }, [unauthorized.map((s) => s.server).join(",")]);

  const ownerServers = new Set(sessions.map((s) => s.server));
  const ownerChannels = sessions.flatMap((session, i) =>
    (results[i]?.data ?? []).map((channel): StoredChannel => ({ server: session.server, channel, token: session.token, admin: true })),
  );
  return [...pairedChannels.filter((c) => !ownerServers.has(c.server)), ...ownerChannels];
}
