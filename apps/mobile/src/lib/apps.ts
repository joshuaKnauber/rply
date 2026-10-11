import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import type { CallResponse } from "@rply/schema";
import { api } from "./api";
import { auth, type StoredChannel } from "./channels";

const MAX_STORAGE = 256 * 1024;

type CallRequest = { message_id: string; block_id: string | null; name: string; args: unknown; agent: boolean };

export async function callCommand(entry: StoredChannel, req: CallRequest, signal: AbortSignal) {
  let res = await api<CallResponse>(entry.server, "/calls", { ...auth(entry), body: { ...req, wait: 25 }, signal });
  while (res.status === "pending") res = await api<CallResponse>(entry.server, `/calls/${res.id}?wait=30`, { ...auth(entry), signal });
  if (res.status === "error") throw new Error(res.error);
  return res.result;
}

const storageName = (channelId: string, key: string) => `${channelId}.${key}.json`;
const storageFile = (channelId: string, key: string) => new File(new Directory(Paths.document, "rply-apps"), storageName(channelId, key));

export function loadAppStorage(channelId: string, key: string): Record<string, unknown> {
  try {
    if (Platform.OS === "web") return JSON.parse(localStorage.getItem(`rply.app.${storageName(channelId, key)}`) ?? "{}");
    const file = storageFile(channelId, key);
    return file.exists ? JSON.parse(file.textSync()) : {};
  } catch {
    return {};
  }
}

export function saveAppStorage(channelId: string, key: string, values: Record<string, unknown>) {
  const raw = JSON.stringify(values);
  if (raw.length > MAX_STORAGE) return;
  if (Platform.OS === "web") return localStorage.setItem(`rply.app.${storageName(channelId, key)}`, raw);
  const file = storageFile(channelId, key);
  file.parentDirectory.create({ intermediates: true, idempotent: true });
  if (!file.exists) file.create();
  file.write(raw);
}
