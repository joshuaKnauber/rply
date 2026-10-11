import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { HumanMessageBody, Message, MessagesResponse, ServerInfo } from "@rply/schema";
import { api } from "./api";
import { auth, type StoredChannel } from "./channels";

export const messagesKey = (channelId: string) => ["messages", channelId];
export const statusKey = (channelId: string) => ["status", channelId];

const fetchMessages = (entry: StoredChannel) =>
  api<MessagesResponse>("/messages?limit=200", auth(entry)).then((r) => r.messages);

export const useMessages = (entry: StoredChannel) =>
  useQuery({ queryKey: messagesKey(entry.channel.id), queryFn: () => fetchMessages(entry), staleTime: Infinity });

export const useAllMessages = (entries: StoredChannel[]) =>
  useQueries({
    queries: entries.map((entry) => ({
      queryKey: messagesKey(entry.channel.id),
      queryFn: () => fetchMessages(entry),
      staleTime: Infinity,
      enabled: !entry.revoked,
    })),
  });

export const useStatus = (entry: StoredChannel) =>
  useQuery({
    queryKey: statusKey(entry.channel.id),
    queryFn: () => api<{ status: Message | null }>("/status", auth(entry)).then((r) => r.status),
    staleTime: Infinity,
  });

export function mergeMessages(queryClient: QueryClient, channelId: string, incoming: Message[]) {
  const key = messagesKey(channelId);
  if (!queryClient.getQueryData(key)) {
    queryClient.invalidateQueries({ queryKey: key });
    return;
  }
  queryClient.setQueryData<Message[]>(key, (current = []) => {
    const byId = new Map(current.map((m) => [m.id, m]));
    for (const m of incoming) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.seq - b.seq);
  });
}

export function applySynced(queryClient: QueryClient, messages: Message[]) {
  const thread = messages.filter((m) => m.pin === null);
  for (const m of messages) if (m.pin === "status") queryClient.setQueryData(statusKey(m.channel_id), m);
  for (const [channelId, group] of Map.groupBy(thread, (m) => m.channel_id)) mergeMessages(queryClient, channelId, group);
}

export function useSendMessage(entry: StoredChannel) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: { body: HumanMessageBody; reply_to?: string }) =>
      api<{ message: Message }>("/messages", { ...auth(entry), body: req }).then((r) => r.message),
    onSuccess: (message) => mergeMessages(queryClient, entry.channel.id, [message]),
  });
}

export const useServerInfo = () =>
  useQuery({ queryKey: ["info"], queryFn: () => api<ServerInfo>("/info"), staleTime: Infinity }).data;
