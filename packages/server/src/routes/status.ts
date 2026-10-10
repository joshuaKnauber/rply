import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { PatchStatusRequest, PutStatusRequest, StatusBody } from "@rply/schema";
import { requireAuth } from "../auth.ts";
import { parse, type AppEnv, type Deps } from "../context.ts";
import { toStatus } from "../serialize.ts";
import { now } from "../tokens.ts";

export function statusRoutes(deps: Deps) {
  const { db, notifier } = deps;

  const save = async (channelId: string, enc: boolean, body: string) => {
    const row = { channel_id: channelId, enc: enc ? 1 : 0, body, updated_at: now() };
    await db
      .insertInto("status_pages")
      .values(row)
      .onConflict((oc) => oc.column("channel_id").doUpdateSet({ enc: row.enc, body: row.body, updated_at: row.updated_at }))
      .execute();
    notifier.notify(channelId);
    return toStatus(row);
  };

  return new Hono<AppEnv>()
    .get("/status", requireAuth(deps), async (c) => {
      const row = await db.selectFrom("status_pages").selectAll().where("channel_id", "=", c.var.auth.channel.id).executeTakeFirst();
      return c.json({ status: row ? toStatus(row) : null });
    })
    .put("/status", requireAuth(deps, "agent"), async (c) => {
      const req = parse(PutStatusRequest, await c.req.json());
      const body = req.enc ? req.body : JSON.stringify(parse(StatusBody, req.body));
      return c.json({ status: await save(c.var.auth.channel.id, req.enc, body) });
    })
    .patch("/status", requireAuth(deps, "agent"), async (c) => {
      const { channel } = c.var.auth;
      const { blocks: patches } = parse(PatchStatusRequest, await c.req.json());
      const current = await db.selectFrom("status_pages").selectAll().where("channel_id", "=", channel.id).executeTakeFirst();
      if (!current) throw new HTTPException(404, { message: "No status page yet, use PUT first" });
      if (current.enc) throw new HTTPException(400, { message: "Encrypted status pages can't be patched, use PUT" });

      const blocks: Record<string, unknown>[] = JSON.parse(current.body).blocks;
      for (const patch of patches) {
        const block = blocks.find((b) => b.id === patch.id);
        if (!block) throw new HTTPException(400, { message: `No block with id "${patch.id}"` });
        Object.assign(block, patch);
      }
      const body = JSON.stringify(parse(StatusBody, { blocks }));
      return c.json({ status: await save(channel.id, false, body) });
    });
}
