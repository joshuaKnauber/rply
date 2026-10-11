import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { HumanMessageBody, Message, MessagesResponse, Status } from "@rply/schema";
import { api } from "./api";
import { auth, type StoredChannel } from "./channels";

export const messagesKey = (channelId: string) => ["messages", channelId];
export const statusKey = (channelId: string) => ["status", channelId];

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

export const useStatus = (entry: StoredChannel) =>
  useQuery({
    queryKey: statusKey(entry.channel.id),
    queryFn: () => api<{ status: Status | null }>(entry.server, "/status", auth(entry)).then((r) => r.status),
    staleTime: Infinity,
  });

export function mergeMessages(queryClient: QueryClient, channelId: string, incoming: Message[]) {
  const key = messagesKey(channelId);
  if (!queryClient.getQueryData(key)) {
    queryClient.invalidateQueries({ queryKey: key });
    return;
  }
  queryClient.setQueryData<Message[]>(key, (current = []) => {
    const known = new Set(current.map((m) => m.id));
    return [...current, ...incoming.filter((m) => !known.has(m.id))].sort((a, b) => a.seq - b.seq);
  });
}

export function useSendMessage(entry: StoredChannel) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: { body: HumanMessageBody; reply_to?: string }) =>
      api<{ message: Message }>(entry.server, "/messages", { ...auth(entry), body: req }).then((r) => r.message),
    onSuccess: (message) => mergeMessages(queryClient, entry.channel.id, [message]),
  });
}
