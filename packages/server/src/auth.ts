import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Sender } from "@rply/schema";
import { bearer, type AppEnv, type Deps } from "./context.ts";
import type { DB } from "./db/index.ts";
import { hashToken, now } from "./tokens.ts";

export function requireAuth(deps: Deps, role?: Sender | "owner") {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = await authenticate(deps, c);
    if (!auth) throw new HTTPException(401, { message: "Sign in or use an agent token" });
    if (role === "owner" && auth.role !== "owner") throw new HTTPException(403, { message: "Only the channel's owner can do this" });
    if (role && role !== "owner" && auth.sender !== role) throw new HTTPException(403, { message: `Only the ${role} can do this` });

    c.set("auth", auth);
    await next();
  });
}

export function requireUser({ accounts }: Deps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = await accounts.user(c.req.raw.headers);
    if (!user) throw new HTTPException(401, { message: "Sign in first" });
    c.set("user", user);
    await next();
  });
}

async function authenticate({ db, accounts }: Deps, c: Context<AppEnv>) {
  const token = bearer(c.req.header("authorization"));
  if (token?.startsWith("rply_a_")) {
    const row = await db
      .selectFrom("agent_tokens as t")
      .innerJoin("channels", "channels.id", "t.channel_id")
      .selectAll("channels")
      .select(["t.id as token_id", "t.last_seen_at as token_seen_at"])
      .where("t.token_hash", "=", hashToken(token))
      .where("t.revoked_at", "is", null)
      .executeTakeFirst();
    if (!row) return undefined;
    const { token_id, token_seen_at, ...channel } = row;
    await markSeen(db, token_id, token_seen_at);
    return { channel, sender: "agent" as const, agentId: token_id };
  }

  const user = await accounts.user(c.req.raw.headers);
  if (!user) return undefined;
  const channelId = c.req.header("x-rply-channel");
  if (!channelId) throw new HTTPException(400, { message: "Missing the X-Rply-Channel header" });
  const row = await db
    .selectFrom("channel_members as m")
    .innerJoin("channels", "channels.id", "m.channel_id")
    .selectAll("channels")
    .select("m.role as member_role")
    .where("m.user_id", "=", user.id)
    .where("m.channel_id", "=", channelId)
    .executeTakeFirst();
  if (!row) throw new HTTPException(404, { message: "Channel not found" });
  const { member_role, ...channel } = row;
  return { channel, sender: "human" as const, userId: user.id, role: member_role };
}

const SEEN_EVERY_MS = 60_000;

// last_seen_at only feeds "seen 5 minutes ago", so long-polling agents don't need a write per request
async function markSeen(db: DB, id: string, lastSeen: number | null) {
  if (lastSeen !== null && now() - lastSeen < SEEN_EVERY_MS) return;
  await db.updateTable("agent_tokens").set({ last_seen_at: now() }).where("id", "=", id).execute();
}
