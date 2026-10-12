import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { ChannelEntry, ChannelsResponse } from "@rply/schema";
import { api } from "./api";

export const channelsKey = ["channels"];

export const useChannels = () =>
  useQuery({ queryKey: channelsKey, queryFn: () => api<ChannelsResponse>("/channels").then((r) => r.channels), staleTime: Infinity });

export const auth = (entry: ChannelEntry) => ({ channel: entry.id });

export function markRead(queryClient: QueryClient, entry: ChannelEntry, seq: number) {
  if (seq <= entry.read_seq) return;
  queryClient.setQueryData<ChannelEntry[]>(channelsKey, (all = []) => all.map((c) => (c.id === entry.id ? { ...c, read_seq: Math.max(c.read_seq, seq) } : c)));
  api("/channel/read", { ...auth(entry), method: "PUT", body: { seq } }).catch(() => undefined);
}
