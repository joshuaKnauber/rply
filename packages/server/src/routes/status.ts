import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { PatchStatusRequest, PutStatusRequest, StatusBody } from "@rply/schema";
import { requireAuth } from "../auth.ts";
import { parse, type AppEnv, type Deps } from "../context.ts";
import { loadMessage, recordChanges, selectMessages, toMessage } from "../messages.ts";
import { applyPatch } from "../patch.ts";
import { now, randomId } from "../tokens.ts";

const PIN = "status";

export function statusRoutes(deps: Deps) {
  const { db } = deps;

  const findPinned = (channelId: string) =>
    selectMessages(db).where("messages.channel_id", "=", channelId).where("messages.pin", "=", PIN).executeTakeFirst();

  const save = async (channelId: string, enc: boolean, body: string) => {
    const existing = await findPinned(channelId);
    const id = existing?.id ?? randomId();
    if (existing) {
      await db.updateTable("messages").set({ enc: enc ? 1 : 0, body, updated_at: now() }).where("id", "=", id).execute();
    } else {
      await db
        .insertInto("messages")
        .values({ id, channel_id: channelId, sender: "agent", enc: enc ? 1 : 0, body, reply_to: null, pin: PIN, state: null, created_at: now(), updated_at: null })
        .execute();
    }
    await recordChanges(deps, channelId, [id]);
    return toMessage(await loadMessage(db, channelId, id));
  };

  return new Hono<AppEnv>()
    .get("/status", requireAuth(deps), async (c) => {
      const row = await findPinned(c.var.auth.channel.id);
      return c.json({ status: row ? toMessage(row) : null });
    })
    .put("/status", requireAuth(deps, "agent"), async (c) => {
      const req = parse(PutStatusRequest, await c.req.json());
      const body = req.enc ? req.body : JSON.stringify(parse(StatusBody, req.body));
      return c.json({ status: await save(c.var.auth.channel.id, req.enc, body) });
    })
    .patch("/status", requireAuth(deps, "agent"), async (c) => {
      const { channel } = c.var.auth;
      const { blocks } = parse(PatchStatusRequest, await c.req.json());
      const current = await findPinned(channel.id);
      if (!current) throw new HTTPException(404, { message: "No status page yet, use PUT first" });
      if (current.enc) throw new HTTPException(400, { message: "Encrypted status pages can't be patched, use PUT" });
      const body = JSON.stringify(parse(StatusBody, applyPatch(current.body, { block_patches: blocks })));
      return c.json({ status: await save(channel.id, false, body) });
    });
}
