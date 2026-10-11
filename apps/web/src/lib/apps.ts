import type { CallResponse } from "@rply/schema";
import { api } from "./api";
import { auth, type StoredChannel } from "./channels";

const MAX_STORAGE = 256 * 1024;

type CallRequest = { message_id: string; block_id: string | null; name: string; args: unknown; agent: boolean };

export async function callCommand(entry: StoredChannel, req: CallRequest, signal: AbortSignal) {
  let res = await api<CallResponse>("/calls", { ...auth(entry), body: { ...req, wait: 25 }, signal });
  while (res.status === "pending") res = await api<CallResponse>(`/calls/${res.id}?wait=30`, { ...auth(entry), signal });
  if (res.status === "error") throw new Error(res.error);
  return res.result;
}

const storageKey = (channelId: string, key: string) => `rply.app.${channelId}.${key}`;

export function loadAppStorage(channelId: string, key: string): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(channelId, key)) ?? "{}");
  } catch {
    return {};
  }
}

export function saveAppStorage(channelId: string, key: string, values: Record<string, unknown>) {
  const raw = JSON.stringify(values);
  if (raw.length <= MAX_STORAGE) localStorage.setItem(storageKey(channelId, key), raw);
}
