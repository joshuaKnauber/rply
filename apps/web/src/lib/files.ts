import { useQuery } from "@tanstack/react-query";
import type { FileInfo } from "@rply/schema";
import { ApiError } from "./api";
import { auth, type StoredChannel } from "./channels";

const headers = (entry: StoredChannel) => {
  const { token, channel } = auth(entry);
  return { authorization: `Bearer ${token}`, ...(channel && { "x-rply-channel": channel }) };
};

async function fetchBlob(entry: StoredChannel, fileId: string) {
  const res = await fetch(`/v1/files/${fileId}`, { headers: headers(entry) });
  if (!res.ok) throw new ApiError((await res.json().catch(() => ({}))).error ?? "Couldn't load the file", res.status);
  return res.blob();
}

export const useFileUrl = (entry: StoredChannel | null, fileId: string) =>
  useQuery({
    queryKey: ["file", fileId],
    queryFn: async () => URL.createObjectURL(await fetchBlob(entry!, fileId)),
    enabled: Boolean(entry),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });

export async function downloadFile(entry: StoredChannel, fileId: string, name: string) {
  const url = URL.createObjectURL(await fetchBlob(entry, fileId));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function uploadFile(entry: StoredChannel, file: File): Promise<FileInfo> {
  const res = await fetch(`/v1/files?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { ...headers(entry), "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Upload failed (${res.status})`, res.status);
  return body.file;
}
