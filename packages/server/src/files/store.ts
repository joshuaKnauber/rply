import { createReadStream } from "node:fs";
import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { AwsClient } from "aws4fetch";

export type Download = { kind: "stream"; body: ReadableStream; size: number } | { kind: "redirect"; url: string };

export type FileStore = {
  name: string;
  put(id: string, bytes: Uint8Array, mime: string): Promise<void>;
  download(id: string, headers: { contentType: string; disposition: string }): Promise<Download | null>;
  remove(id: string): Promise<void>;
};

export function createDirectoryStore(dir: string): FileStore {
  const path = (id: string) => join(dir, id);
  return {
    name: `directory ${dir}`,
    async put(id, bytes) {
      await mkdir(dir, { recursive: true });
      const tmp = `${path(id)}.tmp`;
      await writeFile(tmp, bytes);
      await rename(tmp, path(id));
    },
    async download(id) {
      const info = await stat(path(id)).catch(() => null);
      if (!info) return null;
      return { kind: "stream", body: Readable.toWeb(createReadStream(path(id))) as ReadableStream, size: info.size };
    },
    async remove(id) {
      await unlink(path(id)).catch(() => {});
    },
  };
}

export type S3Config = { endpoint: string; bucket: string; region: string; accessKeyId: string; secretAccessKey: string };

export function createS3Store(config: S3Config): FileStore {
  const aws = new AwsClient({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, service: "s3", region: config.region });
  const url = (id: string) => `${config.endpoint.replace(/\/+$/, "")}/${config.bucket}/files/${id}`;
  return {
    name: `S3 bucket ${config.bucket}`,
    async put(id, bytes, mime) {
      const res = await aws.fetch(url(id), { method: "PUT", body: bytes as Uint8Array<ArrayBuffer>, headers: { "content-type": mime } });
      if (!res.ok) throw new Error(`S3 upload failed (${res.status}): ${await res.text()}`);
    },
    async download(id, headers) {
      const target = new URL(url(id));
      target.searchParams.set("X-Amz-Expires", "300");
      target.searchParams.set("response-content-type", headers.contentType);
      target.searchParams.set("response-content-disposition", headers.disposition);
      const signed = await aws.sign(target.toString(), { method: "GET", aws: { signQuery: true } });
      return { kind: "redirect", url: signed.url };
    },
    async remove(id) {
      await aws.fetch(url(id), { method: "DELETE" });
    },
  };
}
