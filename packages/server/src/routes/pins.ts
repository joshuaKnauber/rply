import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { isApp, PatchMessageRequest, PIN_KEY, PinnedBody, PutPinRequest } from "@rply/schema";
import { requireAuth } from "../auth.ts";
import { parse, type AppEnv, type Deps } from "../context.ts";
import { assertOwnMessage, insertMessage, loadMessage, recordChanges, selectLiveMessages, toMessage } from "../messages.ts";
import { checkFiles, deleteFilesOf, linkFiles } from "../files/manage.ts";
import { applyPatch } from "../patch.ts";
import { rejectSecretBlocks } from "./messages.ts";
import { now, randomId } from "../tokens.ts";

export function pinRoutes(deps: Deps) {
  const { db } = deps;
  const agent = requireAuth(deps, "agent");

  const pinKey = (key: string) => {
    if (!PIN_KEY.test(key)) throw new HTTPException(400, { message: "Pin keys are 1-32 lowercase letters, digits, - or _" });
    return key;
  };

  const assertOwnPin = (row: Parameters<typeof assertOwnMessage>[0], agentId: string, key: string) =>
    assertOwnMessage(row, agentId, `The pin "${key}"`, ` Pin under your own key instead, e.g. ${key}-<your name>.`);

  const findPinned = (channelId: string, key: string) =>
    selectLiveMessages(db).where("messages.channel_id", "=", channelId).where("messages.pin", "=", key).executeTakeFirst();

  const save = async (channelId: string, agentId: string, key: string, enc: boolean, body: string) => {
    const existing = await findPinned(channelId, key);
    if (existing) assertOwnPin(existing, agentId, key);
    if (existing) deps.limits.write(channelId);
    else await deps.limits.newMessage(channelId);
    const id = existing?.id ?? randomId();
    const fileIds = enc ? [] : await checkFiles(deps, channelId, JSON.parse(body));
    if (existing) {
      await db.updateTable("messages").set({ agent_id: agentId, enc: enc ? 1 : 0, body, updated_at: now() }).where("id", "=", id).execute();
    } else {
      await insertMessage(db, { id, channel_id: channelId, sender: "agent", agent_id: agentId, enc: enc ? 1 : 0, body, reply_to: null, pin: key, state: null, created_at: now(), updated_at: null, deleted_at: null });
    }
    await linkFiles(deps, fileIds, id);
    await recordChanges(deps, channelId, [id]);
    return toMessage(await loadMessage(db, channelId, id));
  };

  return new Hono<AppEnv>()
    .get("/pins", requireAuth(deps), async (c) => {
      const rows = await selectLiveMessages(db)
        .where("messages.channel_id", "=", c.var.auth.channel.id)
        .where("messages.pin", "is not", null)
        .orderBy("messages.seq", "asc")
        .execute();
      return c.json({ messages: rows.map(toMessage) });
    })
    .put("/pins/:key", agent, async (c) => {
      const key = pinKey(c.req.param("key"));
      const req = parse(PutPinRequest, await c.req.json());
      const parsed = req.enc ? undefined : parse(PinnedBody, req.body);
      rejectSecretBlocks(parsed?.blocks);
      const body = req.enc ? req.body : JSON.stringify(parsed);
      return c.json({ message: await save(c.var.auth.channel.id, c.var.auth.agentId!, key, req.enc, body) });
    })
    .patch("/pins/:key", agent, async (c) => {
      const { channel } = c.var.auth;
      const key = pinKey(c.req.param("key"));
      const current = await findPinned(channel.id, key);
      if (!current) throw new HTTPException(404, { message: `Nothing pinned as "${key}". It was never set or the human unpinned it; use pin set to pin a new one` });
      if (current.enc) throw new HTTPException(400, { message: "Encrypted pins can't be patched, use PUT" });
      deps.limits.write(channel.id);
      const patch = parse(PatchMessageRequest, await c.req.json());
      const body = JSON.stringify(parse(PinnedBody, applyPatch(current.body, patch)));
      rejectSecretBlocks(JSON.parse(body).blocks);
      return c.json({ message: await save(channel.id, c.var.auth.agentId!, key, false, body) });
    })
    .delete("/pins/:key", requireAuth(deps), async (c) => {
      const { channel, sender } = c.var.auth;
      const current = await findPinned(channel.id, pinKey(c.req.param("key")));
      if (!current) throw new HTTPException(404, { message: "Nothing pinned under that key" });
      if (sender === "human" && !isApp(toMessage(current))) throw new HTTPException(403, { message: "Unpin it instead, only apps can be removed" });
      if (sender === "agent") assertOwnPin(current, c.var.auth.agentId!, current.pin!);
      await db.updateTable("messages").set({ deleted_at: now() }).where("id", "=", current.id).execute();
      await deleteFilesOf(deps, current.id);
      await recordChanges(deps, channel.id, [current.id]);
      return c.body(null, 204);
    });
}
