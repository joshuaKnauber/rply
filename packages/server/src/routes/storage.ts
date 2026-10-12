import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { StorageRequest, type StorageListResponse, type StorageResponse } from "@rply/schema";
import { requireAuth } from "../auth.ts";
import { parse, type AppEnv, type Deps } from "../context.ts";
import { now } from "../tokens.ts";

const MAX_VALUE = 256 * 1024;

// rply.storage for apps and html blocks, per user, keyed by pin key or message id
export function storageRoutes(deps: Deps) {
  const { db } = deps;
  const human = requireAuth(deps, "human");
  const appKey = (key: string) => {
    if (key.length > 64) throw new HTTPException(400, { message: "Storage keys are at most 64 characters" });
    return key;
  };

  return new Hono<AppEnv>()
    .get("/storage", human, async (c) => {
      const rows = await db.selectFrom("app_storage").select(["app_key", "value"]).where("user_id", "=", c.var.auth.userId!).where("channel_id", "=", c.var.auth.channel.id).execute();
      const res: StorageListResponse = { values: Object.fromEntries(rows.map((r) => [r.app_key, JSON.parse(r.value)])) };
      return c.json(res);
    })
    .get("/storage/:key", human, async (c) => {
      const row = await db
        .selectFrom("app_storage")
        .select("value")
        .where("user_id", "=", c.var.auth.userId!)
        .where("channel_id", "=", c.var.auth.channel.id)
        .where("app_key", "=", appKey(c.req.param("key")))
        .executeTakeFirst();
      const res: StorageResponse = { value: row ? JSON.parse(row.value) : null };
      return c.json(res);
    })
    .put("/storage/:key", human, async (c) => {
      const { value } = parse(StorageRequest, await c.req.json());
      const json = JSON.stringify(value);
      if (json.length > MAX_VALUE) throw new HTTPException(413, { message: "App storage is limited to 256 KB" });
      const row = { user_id: c.var.auth.userId!, channel_id: c.var.auth.channel.id, app_key: appKey(c.req.param("key")), value: json, updated_at: now() };
      await db
        .insertInto("app_storage")
        .values(row)
        .onConflict((oc) => oc.columns(["user_id", "channel_id", "app_key"]).doUpdateSet({ value: row.value, updated_at: row.updated_at }))
        .execute();
      return c.body(null, 204);
    });
}
