import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { CallResponse, StorageListResponse } from "@rply/schema";
import { api } from "./api";
import { auth, type ServerChannel } from "./channels";

const MAX_STORAGE = 256 * 1024;

type CallRequest = { message_id: string; block_id: string | null; name: string; args: unknown; agent: boolean };

export async function callCommand(entry: ServerChannel, req: CallRequest, signal: AbortSignal) {
  let res = await api<CallResponse>(entry.server, "/calls", { ...auth(entry), body: { ...req, wait: 25 }, signal });
  while (res.status === "pending") res = await api<CallResponse>(entry.server, `/calls/${res.id}?wait=30`, { ...auth(entry), signal });
  if (res.status === "error") throw new Error(res.error);
  return res.result;
}

const storageKey = (entry: ServerChannel | null) => ["storage", entry?.channel.id];

// rply.storage values of every app and html block in the channel, keyed by pin key or message id
export const useAppStorage = (entry: ServerChannel | null) =>
  useQuery({
    queryKey: storageKey(entry),
    queryFn: () => api<StorageListResponse>(entry!.server, "/storage", auth(entry!)).then((r) => r.values),
    enabled: Boolean(entry),
    staleTime: Infinity,
  });

const pending = new Map<string, ReturnType<typeof setTimeout>>();

export function saveAppStorage(queryClient: QueryClient, entry: ServerChannel, key: string, values: Record<string, unknown>) {
  if (JSON.stringify(values).length > MAX_STORAGE) return;
  queryClient.setQueryData<Record<string, unknown>>(storageKey(entry), (all = {}) => ({ ...all, [key]: { ...values } }));
  const id = `${entry.channel.id}/${key}`;
  clearTimeout(pending.get(id));
  pending.set(
    id,
    setTimeout(() => {
      pending.delete(id);
      api(entry.server, `/storage/${encodeURIComponent(key)}`, { ...auth(entry), method: "PUT", body: { value: values } }).catch(() => undefined);
    }, 500),
  );
}
