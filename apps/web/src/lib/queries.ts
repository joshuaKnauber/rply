import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { AgentsResponse, ChannelEntry, HumanMessageBody, Message, MessagesResponse, ServerInfo } from "@rply/schema";
import { api } from "./api";
import { auth, channelsKey } from "./channels";

export const messagesKey = (channelId: string) => ["messages", channelId];
export const pinsKey = (channelId: string) => ["pins", channelId];

const fetchMessages = (entry: ChannelEntry) =>
  api<MessagesResponse>("/messages?limit=200", auth(entry)).then((r) => r.messages);

export const useMessages = (entry: ChannelEntry) =>
  useQuery({ queryKey: messagesKey(entry.id), queryFn: () => fetchMessages(entry), staleTime: Infinity });

export const useAllMessages = (entries: ChannelEntry[]) =>
  useQueries({
    queries: entries.map((entry) => ({
      queryKey: messagesKey(entry.id),
      queryFn: () => fetchMessages(entry),
      staleTime: Infinity,
    })),
  });

const pinsQuery = (entry: ChannelEntry) => ({
  queryKey: pinsKey(entry.id),
  queryFn: () => api<{ messages: Message[] }>("/pins", auth(entry)).then((r) => r.messages),
  staleTime: Infinity,
});

export const usePins = (entry: ChannelEntry) => useQuery(pinsQuery(entry));

export const useAllPins = (entries: ChannelEntry[]) => useQueries({ queries: entries.map(pinsQuery) });

const agentsQuery = (entry: ChannelEntry, refetchInterval = 60_000) => ({
  queryKey: ["agents", entry.id],
  queryFn: () => api<AgentsResponse>("/agents", auth(entry)).then((r) => r.agents),
  refetchInterval,
  refetchOnWindowFocus: true,
});

export const useAgents = (entry: ChannelEntry, refetchInterval?: number) => useQuery(agentsQuery(entry, refetchInterval));

export const useAllAgents = (entries: ChannelEntry[]) => useQueries({ queries: entries.map((entry) => agentsQuery(entry)) });

export function useRevokeAgent(entry: ChannelEntry) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/agents/${id}`, { ...auth(entry), method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents", entry.id] }),
  });
}

function upsert(queryClient: QueryClient, key: string[], incoming: Message[], belongs: (m: Message) => boolean) {
  if (!queryClient.getQueryData(key)) {
    if (incoming.some(belongs)) queryClient.invalidateQueries({ queryKey: key });
    return;
  }
  queryClient.setQueryData<Message[]>(key, (current = []) => {
    const byId = new Map(current.map((m) => [m.id, m]));
    for (const m of incoming) {
      if (m.deleted_at || !belongs(m)) byId.delete(m.id);
      else byId.set(m.id, m);
    }
    return [...byId.values()].sort((a, b) => a.seq - b.seq);
  });
}

export function applySynced(queryClient: QueryClient, messages: Message[]) {
  for (const channelId of new Set(messages.map((m) => m.channel_id))) {
    const group = messages.filter((m) => m.channel_id === channelId);
    upsert(queryClient, pinsKey(channelId), group, (m) => m.pin !== null);
    upsert(queryClient, messagesKey(channelId), group, (m) => m.pin === null);
  }
}

export function useUnpin(entry: ChannelEntry) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ message: Message }>(`/messages/${id}/unpin`, { ...auth(entry), method: "POST" }).then((r) => r.message),
    onSuccess: (message) => applySynced(queryClient, [message]),
  });
}

export function useDeleteChannel(entry: ChannelEntry) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api("/channel", { ...auth(entry), method: "DELETE" }),
    onSuccess: () => queryClient.setQueryData<ChannelEntry[]>(channelsKey, (all = []) => all.filter((c) => c.id !== entry.id)),
  });
}

export function useRemoveApp(entry: ChannelEntry) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api(`/pins/${key}`, { ...auth(entry), method: "DELETE" }),
    onSuccess: (_, key) => queryClient.setQueryData<Message[]>(pinsKey(entry.id), (pins = []) => pins.filter((m) => m.pin !== key)),
  });
}

export function useSendMessage(entry: ChannelEntry) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: { body: HumanMessageBody; reply_to?: string }) =>
      api<{ message: Message }>("/messages", { ...auth(entry), body: req }).then((r) => r.message),
    onSuccess: (message) => applySynced(queryClient, [message]),
  });
}

export const useServerInfo = () =>
  useQuery({ queryKey: ["info"], queryFn: () => api<ServerInfo>("/info"), staleTime: Infinity }).data;
