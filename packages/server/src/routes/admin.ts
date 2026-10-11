import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Channel } from "@rply/schema";
import { requireServerTokenAuth } from "../auth.ts";
import type { AppEnv, Deps } from "../context.ts";
import { toChannel } from "../serialize.ts";

export function adminRoutes(deps: Deps) {
  const { db } = deps;
  return new Hono<AppEnv>()
    .get("/admin/channels", requireServerTokenAuth(deps), async (c) => {
      const rows = await db.selectFrom("channels").selectAll().orderBy("created_at", "asc").execute();
      const channels: Channel[] = rows.map(toChannel);
      return c.json({ channels });
    })
    .delete("/admin/channels/:id", requireServerTokenAuth(deps), async (c) => {
      const id = c.req.param("id");
      const files = await db.selectFrom("files").select("id").where("channel_id", "=", id).where("deleted_at", "is", null).execute();
      await Promise.all(files.map((f) => deps.files?.store.remove(f.id)));
      const result = await db.deleteFrom("channels").where("id", "=", id).executeTakeFirst();
      if (Number(result.numDeletedRows) === 0) throw new HTTPException(404, { message: "Channel not found" });
      deps.notifier.notify(id);
      return c.body(null, 204);
    });
}
