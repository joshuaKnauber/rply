import { Hono } from "hono";
import type { Channel } from "@rply/schema";
import { requireServerTokenAuth } from "../auth.ts";
import type { AppEnv, Deps } from "../context.ts";
import { toChannel } from "../serialize.ts";

export function adminRoutes(deps: Deps) {
  return new Hono<AppEnv>().get("/admin/channels", requireServerTokenAuth(deps), async (c) => {
    const rows = await deps.db.selectFrom("channels").selectAll().orderBy("created_at", "asc").execute();
    const channels: Channel[] = rows.map(toChannel);
    return c.json({ channels });
  });
}
