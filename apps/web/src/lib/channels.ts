import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Channel } from "@rply/schema";
import { api } from "./api";
import { createStore } from "./store";

export type StoredChannel = {
  channel: Channel;
  token: string;
  revoked?: boolean;
  admin?: boolean;
};

const paired = createStore<StoredChannel[]>("rply.channels", []);
const readSeqs = createStore<Record<string, number>>("rply.read", {});
const adminToken = createStore<string | null>("rply.admin", null);

export const addChannel = (entry: StoredChannel) =>
  paired.update((all) => [...all.filter((c) => c.channel.id !== entry.channel.id), entry]);

export const removeChannel = (id: string) => paired.update((all) => all.filter((c) => c.channel.id !== id));

export const markRevoked = (tokens: string[]) =>
  paired.update((all) => all.map((c) => (tokens.includes(c.token) ? { ...c, revoked: true } : c)));

export const useReadSeqs = readSeqs.use;
export const markRead = (id: string, seq: number) =>
  readSeqs.update((all) => ((all[id] ?? 0) >= seq ? all : { ...all, [id]: seq }));

export const useAdminToken = adminToken.use;
export const signInAsAdmin = async (token: string) => {
  await api<{ channels: Channel[] }>("/admin/channels", { token });
  adminToken.update(() => token);
};
export const signOutAdmin = () => adminToken.update(() => null);

export const auth = (entry: StoredChannel) => ({ token: entry.token, channel: entry.admin ? entry.channel.id : undefined });

export function useChannels() {
  const pairedChannels = paired.use();
  const admin = useAdminToken();
  const { data, error } = useQuery({
    queryKey: ["admin-channels", admin],
    queryFn: () => api<{ channels: Channel[] }>("/admin/channels", { token: admin! }).then((r) => r.channels),
    enabled: Boolean(admin),
    refetchInterval: 15_000,
  });

  const unauthorized = error !== null && "status" in error && error.status === 401;
  useEffect(() => {
    if (unauthorized) signOutAdmin();
  }, [unauthorized]);

  if (!admin) return pairedChannels;
  return (data ?? []).map((channel): StoredChannel => ({ channel, token: admin, admin: true }));
}
