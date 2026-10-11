import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import type { Command } from "commander";
import type { Block, FileInfo } from "@rply/schema";
import { CliError } from "../client.ts";
import { connect, json } from "../context.ts";
import { printJson } from "../io.ts";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".pdf": "application/pdf", ".json": "application/json", ".csv": "text/csv", ".txt": "text/plain", ".md": "text/markdown",
  ".html": "text/html", ".zip": "application/zip", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const collect = (value: string, previous: string[]) => [...previous, value];

const authHeaders = () => {
  const { config } = connect();
  return { server: config.server, headers: { authorization: `Bearer ${config.token}` } };
};

export async function uploadFile(path: string): Promise<FileInfo> {
  if (!existsSync(path) || !statSync(path).isFile()) throw new CliError(`No such file: ${path}`);
  const { server, headers } = authHeaders();
  const name = basename(path);
  const res = await fetch(`${server}/v1/files?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { ...headers, "content-type": MIME[extname(path).toLowerCase()] ?? "application/octet-stream" },
    body: readFileSync(path),
  }).catch((err) => {
    throw new CliError(`Can't reach ${server}: ${err.cause ?? err.message}`);
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new CliError(`Upload of ${name} failed: ${body.error ?? res.status}`);
  return body.file;
}

export async function attachmentBlocks(opts: { image?: string[]; file?: string[] }): Promise<Block[]> {
  const blocks: Block[] = [];
  for (const path of opts.image ?? []) {
    const file = await uploadFile(path);
    blocks.push({ type: "image", file_id: file.file_id, name: file.name });
  }
  for (const path of opts.file ?? []) {
    const file = await uploadFile(path);
    blocks.push({ type: "file", file_id: file.file_id, name: file.name, mime: file.mime, size: file.size });
  }
  return blocks;
}

function fileName(disposition: string | null, fallback: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const name = encoded ? decodeURIComponent(encoded) : (disposition?.match(/filename="([^"]+)"/)?.[1] ?? fallback);
  return basename(name);
}

export function registerFiles(program: Command) {
  const file = program.command("file").description("upload and download attachments");

  file
    .command("upload")
    .description("upload a file and print its id, for use in --blocks (image or file blocks)")
    .argument("<path>")
    .action(async (path: string) => {
      const info = await uploadFile(path);
      if (json()) return printJson(info);
      console.log(info.file_id);
    });

  file
    .command("get")
    .description("download an attachment the human sent")
    .argument("<file-id>")
    .option("--to <path>", "where to save it (default: its name in the current directory)")
    .option("--force", "overwrite an existing file")
    .action(async (id: string, opts: { to?: string; force?: boolean }) => {
      const { server, headers } = authHeaders();
      const res = await fetch(`${server}/v1/files/${id}`, { headers });
      if (!res.ok) throw new CliError((await res.json().catch(() => ({}))).error ?? `Download failed (${res.status})`);
      const target = resolve(opts.to ?? fileName(res.headers.get("content-disposition"), id));
      if (existsSync(target) && !opts.force) throw new CliError(`${target} already exists, use --force to overwrite`);
      writeFileSync(target, new Uint8Array(await res.arrayBuffer()));
      if (json()) return printJson({ file_id: id, path: target });
      console.log(`Saved to ${target}`);
    });
}
