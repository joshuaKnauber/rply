import { dirname, join, resolve } from "node:path";
import { createDirectoryStore, createS3Store, type FileStore } from "./store.ts";

export type FilesConfig = { store: FileStore; maxSize: number; totalLimit: number; retentionMs: number | null };

const MB = 1024 * 1024;

export function parseSize(input: string | undefined, fallback: number) {
  if (!input) return fallback;
  const match = input.trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
  if (!match) throw new Error(`Invalid size "${input}", use e.g. 25MB or 5GB`);
  const unit = { b: 1, kb: 1024, mb: MB, gb: 1024 * MB }[(match[2] ?? "b").toLowerCase() as "b"];
  return Math.round(Number(match[1]) * unit);
}

export function parseRetention(input: string | undefined, name = "RPLY_FILES_RETENTION") {
  if (!input) return null;
  const match = input.trim().match(/^(\d+)\s*(h|d)$/);
  if (!match) throw new Error(`Invalid ${name} "${input}", use e.g. 30d or 12h`);
  return Number(match[1]) * (match[2] === "h" ? 3_600_000 : 86_400_000);
}

export function filesConfigFromEnv(env: NodeJS.ProcessEnv, dbPath: string | null): FilesConfig | null {
  if (env.RPLY_FILES === "off") return null;
  const limits = {
    maxSize: parseSize(env.RPLY_FILES_MAX_SIZE, 25 * MB),
    totalLimit: parseSize(env.RPLY_FILES_TOTAL_LIMIT, 5 * 1024 * MB),
    retentionMs: parseRetention(env.RPLY_FILES_RETENTION),
  };
  if (env.RPLY_S3_BUCKET) {
    const missing = ["RPLY_S3_ENDPOINT", "RPLY_S3_ACCESS_KEY_ID", "RPLY_S3_SECRET_ACCESS_KEY"].filter((k) => !env[k]);
    if (missing.length) throw new Error(`RPLY_S3_BUCKET is set but ${missing.join(", ")} missing`);
    const store = createS3Store({
      endpoint: env.RPLY_S3_ENDPOINT!,
      bucket: env.RPLY_S3_BUCKET,
      region: env.RPLY_S3_REGION ?? "auto",
      accessKeyId: env.RPLY_S3_ACCESS_KEY_ID!,
      secretAccessKey: env.RPLY_S3_SECRET_ACCESS_KEY!,
    });
    return { store, ...limits };
  }
  const dir = env.RPLY_FILES_DIR ?? (dbPath === null || dbPath === ":memory:" ? null : join(dirname(resolve(dbPath)), "files"));
  return dir ? { store: createDirectoryStore(resolve(dir)), ...limits } : null;
}
