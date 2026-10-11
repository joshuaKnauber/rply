import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { FileInfo } from "@rply/schema";
import { ApiError } from "./api";
import { auth, type StoredChannel } from "./channels";

export const fileHeaders = (entry: StoredChannel) => {
  const { token, channel } = auth(entry);
  return { authorization: `Bearer ${token}`, ...(channel ? { "x-rply-channel": channel } : {}) };
};

export const fileUrl = (entry: StoredChannel, fileId: string) => `${entry.server}/v1/files/${fileId}`;

export async function uploadFile(entry: StoredChannel, picked: { uri: string; name: string; mime?: string | null }): Promise<FileInfo> {
  const blob = await (await fetch(picked.uri)).blob();
  const res = await fetch(`${entry.server}/v1/files?name=${encodeURIComponent(picked.name)}`, {
    method: "POST",
    headers: { ...fileHeaders(entry), "content-type": picked.mime || blob.type || "application/octet-stream" },
    body: blob,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Upload failed (${res.status})`, res.status);
  return body.file;
}

export async function openFile(entry: StoredChannel, fileId: string, name: string) {
  const dir = new Directory(Paths.cache, "rply-files", fileId);
  dir.create({ intermediates: true, idempotent: true });
  const file = await File.downloadFileAsync(fileUrl(entry, fileId), new File(dir, name), { headers: fileHeaders(entry), idempotent: true });
  await Sharing.shareAsync(file.uri);
}
