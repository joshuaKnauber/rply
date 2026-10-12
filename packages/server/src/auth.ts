import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Sender } from "@rply/schema";
import { bearer, type AppEnv, type Deps } from "./context.ts";
import type { DB } from "./db/index.ts";
import { hashToken, now, randomId } from "./tokens.ts";

export function requireAuth({ db }: Deps, role?: Sender) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = bearer(c.req.header("authorization"));
    if (!token) throw new HTTPException(401, { message: "Missing bearer token" });

    const auth = await authenticate(db, token, c.req.header("x-rply-channel"));
    if (!auth) throw new HTTPException(401, { message: "Invalid token" });
    if (role && auth.sender !== role) throw new HTTPException(403, { message: `Only the ${role} can do this` });

    c.set("auth", auth);
    await next();
  });
}

async function authenticate(db: DB, token: string, channelId: string | undefined) {
  const hash = hashToken(token);
  if (token.startsWith("rply_a_")) {
    const row = await db
      .selectFrom("agent_tokens as t")
      .innerJoin("channels", "channels.id", "t.channel_id")
      .selectAll("channels")
      .select(["t.id as token_id", "t.last_seen_at as token_seen_at"])
      .where("t.token_hash", "=", hash)
      .where("t.revoked_at", "is", null)
      .executeTakeFirst();
    if (!row) return undefined;
    const { token_id, token_seen_at, ...channel } = row;
    await markSeen(db, "agent_tokens", [{ id: token_id, last_seen_at: token_seen_at }]);
    return { channel, sender: "agent" as const, agentId: token_id };
  }
  if (token.startsWith("rply_h_")) {
    const row = await db
      .selectFrom("human_tokens as t")
      .innerJoin("channels", "channels.id", "t.channel_id")
      .selectAll("channels")
      .select(["t.id as token_id", "t.last_seen_at as token_seen_at"])
      .where("t.token_hash", "=", hash)
      .where("t.revoked_at", "is", null)
      .executeTakeFirst();
    if (!row) return undefined;
    const { token_id, token_seen_at, ...channel } = row;
    await markSeen(db, "human_tokens", [{ id: token_id, last_seen_at: token_seen_at }]);
    return { channel, sender: "human" as const, deviceId: token_id };
  }
  if (channelId && (await isServerToken(db, token))) {
    const channel = await db.selectFrom("channels").selectAll().where("id", "=", channelId).executeTakeFirst();
    return channel && { channel, sender: "human" as const };
  }
  return undefined;
}

const SEEN_EVERY_MS = 60_000;

// last_seen_at only feeds "seen 5 minutes ago", so long-polling clients don't need a write per request
export async function markSeen(db: DB, table: "agent_tokens" | "human_tokens", tokens: { id: string; last_seen_at: number | null }[]) {
  const stale = tokens.filter((t) => t.last_seen_at === null || now() - t.last_seen_at >= SEEN_EVERY_MS).map((t) => t.id);
  if (stale.length) await db.updateTable(table).set({ last_seen_at: now() }).where("id", "in", stale).execute();
}

export async function isServerToken(db: DB, token: string | undefined) {
  if (!token) return false;
  const key = await db.selectFrom("api_keys").select("id").where("token_hash", "=", hashToken(token)).executeTakeFirst();
  return key !== undefined;
}

export function requireServerTokenAuth({ db }: Deps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!(await isServerToken(db, bearer(c.req.header("authorization"))))) throw new HTTPException(401, { message: "Invalid admin token" });
    await next();
  });
}

export async function serverTokenRequired(db: DB) {
  const { count } = await db.selectFrom("api_keys").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow();
  return Number(count) > 0;
}

export async function requireServerToken(db: DB, header: string | undefined) {
  if (!(await serverTokenRequired(db))) return;

  if (!(await isServerToken(db, bearer(header)))) {
    throw new HTTPException(401, { message: "This server requires a server token to create channels" });
  }
}

export async function syncAdminToken(db: DB, token: string | undefined) {
  const label = "env:RPLY_ADMIN_TOKEN";
  const existing = await db.selectFrom("api_keys").select(["id", "token_hash"]).where("label", "=", label).executeTakeFirst();
  if (token && existing?.token_hash === hashToken(token)) return;
  await db.deleteFrom("api_keys").where("label", "=", label).execute();
  if (!token) return;
  await db.insertInto("api_keys").values({ id: randomId(), token_hash: hashToken(token), owner_id: null, label, created_at: now() }).execute();
}
