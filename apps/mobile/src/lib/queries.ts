import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { HumanMessageBody, Message, MessagesResponse } from "@rply/schema";
import { api } from "./api";
import { auth, type StoredChannel } from "./channels";

export const messagesKey = (channelId: string) => ["messages", channelId];
export const pinsKey = (channelId: string) => ["pins", channelId];

const fetchMessages = (entry: StoredChannel) =>
  api<MessagesResponse>(entry.server, "/messages?limit=200", auth(entry)).then((r) => r.messages);

const messagesQuery = (entry: StoredChannel) => ({
  queryKey: messagesKey(entry.channel.id),
  queryFn: () => fetchMessages(entry),
  staleTime: Infinity,
  enabled: !entry.revoked,
});

export const useMessages = (entry: StoredChannel) => useQuery(messagesQuery(entry));

export const useAllMessages = (entries: StoredChannel[]) => useQueries({ queries: entries.map(messagesQuery) });

export const usePins = (entry: StoredChannel) =>
  useQuery({
    queryKey: pinsKey(entry.channel.id),
    queryFn: () => api<{ messages: Message[] }>(entry.server, "/pins", auth(entry)).then((r) => r.messages),
    staleTime: Infinity,
    enabled: !entry.revoked,
  });

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

export function useUnpin(entry: StoredChannel) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ message: Message }>(entry.server, `/messages/${id}/unpin`, { ...auth(entry), method: "POST" }).then((r) => r.message),
    onSuccess: (message) => applySynced(queryClient, [message]),
  });
}

export function useSendMessage(entry: StoredChannel) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: { body: HumanMessageBody; reply_to?: string }) =>
      api<{ message: Message }>(entry.server, "/messages", { ...auth(entry), body: req }).then((r) => r.message),
    onSuccess: (message) => applySynced(queryClient, [message]),
  });
}
