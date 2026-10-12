import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { ChannelRole, Sender } from "@rply/schema";
import type { Accounts } from "./accounts.ts";
import type { DB } from "./db/index.ts";
import type { ChannelRow } from "./db/schema.ts";
import type { FilesConfig } from "./files/config.ts";
import type { Notifier } from "./notifier.ts";
import type { Push } from "./push/index.ts";

export type Deps = { db: DB; notifier: Notifier; accounts: Accounts; files?: FilesConfig | null; push?: Push | null };

export type Auth = { channel: ChannelRow; sender: Sender; agentId?: string; userId?: string; role?: ChannelRole };

export type User = { id: string; email: string; name: string };

export type AppEnv = { Variables: { auth: Auth; user: User } };

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new HTTPException(400, { message: result.error.issues.map(formatIssue).join("; ") });
  return result.data;
}

const formatIssue = (issue: z.core.$ZodIssue) =>
  issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message;

export function waitParam(value: string | undefined) {
  const seconds = Number(value ?? 0);
  return Number.isFinite(seconds) ? Math.min(Math.max(seconds, 0), 60) : 0;
}

export function bearer(header: string | undefined) {
  return header?.match(/^Bearer (.+)$/)?.[1];
}
