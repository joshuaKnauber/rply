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

    const auth = await authenticate(db, token);
    if (!auth) throw new HTTPException(401, { message: "Invalid token" });
    if (role && auth.sender !== role) throw new HTTPException(403, { message: `Only the ${role} can do this` });

    c.set("auth", auth);
    await next();
  });
}

async function authenticate(db: DB, token: string) {
  const hash = hashToken(token);
  if (token.startsWith("rply_a_")) {
    const channel = await db.selectFrom("channels").selectAll().where("agent_token_hash", "=", hash).executeTakeFirst();
    return channel && { channel, sender: "agent" as const };
  }
  if (token.startsWith("rply_h_")) {
    const human = await db
      .updateTable("human_tokens")
      .set({ last_seen_at: now() })
      .where("token_hash", "=", hash)
      .where("revoked_at", "is", null)
      .returning("channel_id")
      .executeTakeFirst();
    if (!human) return undefined;
    const channel = await db.selectFrom("channels").selectAll().where("id", "=", human.channel_id).executeTakeFirstOrThrow();
    return { channel, sender: "human" as const };
  }
  return undefined;
}

export async function serverTokenRequired(db: DB) {
  const { count } = await db.selectFrom("api_keys").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow();
  return Number(count) > 0;
}

export async function requireServerToken(db: DB, header: string | undefined) {
  if (!(await serverTokenRequired(db))) return;

  const token = bearer(header);
  const key = token && (await db.selectFrom("api_keys").select("id").where("token_hash", "=", hashToken(token)).executeTakeFirst());
  if (!key) throw new HTTPException(401, { message: "This server requires a server token to create channels" });
}

export async function syncAdminToken(db: DB, token: string | undefined) {
  await db.deleteFrom("api_keys").where("label", "=", "env:RPLY_ADMIN_TOKEN").execute();
  if (!token) return;
  await db
    .insertInto("api_keys")
    .values({ id: randomId(), token_hash: hashToken(token), owner_id: null, label: "env:RPLY_ADMIN_TOKEN", created_at: now() })
    .execute();
}
