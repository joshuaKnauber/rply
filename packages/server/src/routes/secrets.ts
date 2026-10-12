import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { CreateSecretRequest, FulfilSecretRequest, type BlockOf, type SecretResponse, type SecretStatus } from "@rply/schema";
import { requireAuth } from "../auth.ts";
import { parse, waitParam, type AppEnv, type Deps } from "../context.ts";
import type { DB } from "../db/index.ts";
import { insertMessage, loadMessage, recordChanges, toMessage } from "../messages.ts";
import { longPoll } from "../notifier.ts";
import { notifyAboutMessage } from "../push/notify.ts";
import { now, randomId } from "../tokens.ts";

type Stored = Exclude<SecretStatus, "expired">;

export function secretRoutes(deps: Deps) {
  const { db, notifier } = deps;
  const agent = requireAuth(deps, "agent");
  const human = requireAuth(deps, "human");

  const load = async (channelId: string, id: string) => {
    const row = await db.selectFrom("secret_requests").selectAll().where("id", "=", id).where("channel_id", "=", channelId).executeTakeFirst();
    if (!row) throw new HTTPException(404, { message: "Secret request not found" });
    return row;
  };

  const effective = (row: { status: Stored; expires_at: number | null }): SecretStatus =>
    row.status === "open" && row.expires_at !== null && Number(row.expires_at) <= Date.now() ? "expired" : row.status;

  const transition = async (channelId: string, id: string, from: Stored[], to: Stored, set: { ciphertext?: string | null } = {}) => {
    const row = await load(channelId, id);
    const status = effective(row);
    if (!(from as SecretStatus[]).includes(status)) throw new HTTPException(409, { message: `This secret request is already ${status}` });
    await db
      .updateTable("secret_requests")
      .set({ status: to, closed_at: to === "provided" ? null : now(), ...set })
      .where("id", "=", id)
      .execute();
    await setBlockStatus(db, channelId, row.message_id, id, to);
    await recordChanges(deps, channelId, [row.message_id]);
  };

  return new Hono<AppEnv>()
    .post("/secrets", agent, async (c) => {
      const { channel, agentId } = c.var.auth;
      const { public_key: publicKey } = await db.selectFrom("agent_tokens").select("public_key").where("id", "=", agentId!).executeTakeFirstOrThrow();
      if (!publicKey) throw new HTTPException(400, { message: "Upload a public key first (PUT /v1/channel/key)" });
      const req = parse(CreateSecretRequest, await c.req.json());
      await deps.limits.newMessage(channel.id);
      const id = randomId();
      const messageId = randomId();
      const block: BlockOf<"secret"> = {
        type: "secret",
        id,
        name: req.name,
        target: req.target,
        mode: req.mode,
        reason: req.reason,
        status: "open",
        expires_at: req.expires_at ?? null,
        public_key: publicKey,
      };
      await db.transaction().execute(async (trx) => {
        await insertMessage(trx, {
          id: messageId,
          channel_id: channel.id,
          sender: "agent",
          enc: 0,
          body: JSON.stringify({ blocks: [block] }),
          reply_to: null,
          pin: null,
          state: null,
          created_at: now(),
          updated_at: null,
          deleted_at: null,
        });
        await trx
          .insertInto("secret_requests")
          .values({ id, channel_id: channel.id, message_id: messageId, name: req.name, target: req.target, mode: req.mode, status: "open", ciphertext: null, public_key: publicKey, expires_at: req.expires_at ?? null, created_at: now(), closed_at: null })
          .execute();
      });
      await recordChanges(deps, channel.id, [messageId]);
      const message = toMessage(await loadMessage(db, channel.id, messageId));
      notifyAboutMessage(deps, channel, message);
      return c.json({ id, message }, 201);
    })
    .get("/secrets/:id", agent, async (c) => {
      const { channel } = c.var.auth;
      const id = c.req.param("id");
      const first = await load(channel.id, id);
      const untilExpiry = first.expires_at === null ? Infinity : Math.max(0, Math.ceil((Number(first.expires_at) - Date.now()) / 1000));
      const row = await longPoll({
        notifier,
        client: c.var.auth.agentId!,
        channelIds: [channel.id],
        waitSeconds: Math.min(waitParam(c.req.query("wait")), untilExpiry),
        signal: c.req.raw.signal,
        fetch: () => load(channel.id, id),
        isEmpty: (r) => effective(r) === "open",
      });
      const res: SecretResponse = { id, name: row.name, target: row.target, mode: row.mode, status: effective(row), ciphertext: row.ciphertext };
      return c.json(res);
    })
    .post("/secrets/:id/delivered", agent, async (c) => {
      await transition(c.var.auth.channel.id, c.req.param("id"), ["provided"], "delivered", { ciphertext: null });
      return c.body(null, 204);
    })
    .post("/secrets/:id/cancel", agent, async (c) => {
      await transition(c.var.auth.channel.id, c.req.param("id"), ["open", "provided"], "cancelled", { ciphertext: null });
      return c.body(null, 204);
    })
    .post("/secrets/:id/fulfil", human, async (c) => {
      const { ciphertext } = parse(FulfilSecretRequest, await c.req.json());
      await transition(c.var.auth.channel.id, c.req.param("id"), ["open"], "provided", { ciphertext });
      return c.body(null, 204);
    })
    .post("/secrets/:id/decline", human, async (c) => {
      await transition(c.var.auth.channel.id, c.req.param("id"), ["open"], "declined");
      return c.body(null, 204);
    });
}

async function setBlockStatus(db: DB, channelId: string, messageId: string, secretId: string, status: Stored) {
  const message = await db.selectFrom("messages").select("body").where("id", "=", messageId).where("channel_id", "=", channelId).executeTakeFirst();
  if (!message) return;
  const body = JSON.parse(message.body);
  for (const block of body.blocks ?? []) if (block.type === "secret" && block.id === secretId) block.status = status;
  await db.updateTable("messages").set({ body: JSON.stringify(body) }).where("id", "=", messageId).execute();
}
