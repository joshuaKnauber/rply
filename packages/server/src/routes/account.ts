import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { CreateApiKeyRequest, type ApiKeysResponse, type CreateApiKeyResponse } from "@rply/schema";
import { requireUser } from "../auth.ts";
import { parse, type AppEnv, type Deps } from "../context.ts";
import { createToken, hashToken, now, randomId } from "../tokens.ts";

export function accountRoutes(deps: Deps) {
  const { db } = deps;
  const user = requireUser(deps);

  return new Hono<AppEnv>()
    .get("/api-keys", user, async (c) => {
      const keys = await db.selectFrom("api_keys").select(["id", "label", "created_at"]).where("user_id", "=", c.var.user.id).orderBy("created_at").execute();
      const res: ApiKeysResponse = { keys };
      return c.json(res);
    })
    .post("/api-keys", user, async (c) => {
      const { label } = parse(CreateApiKeyRequest, await c.req.json());
      const token = createToken("k");
      const key = { id: randomId(), label, created_at: now() };
      await db.insertInto("api_keys").values({ ...key, token_hash: hashToken(token), user_id: c.var.user.id }).execute();
      const res: CreateApiKeyResponse = { key, token };
      return c.json(res, 201);
    })
    .delete("/api-keys/:id", user, async (c) => {
      const res = await db.deleteFrom("api_keys").where("id", "=", c.req.param("id")).where("user_id", "=", c.var.user.id).executeTakeFirst();
      if (!Number(res.numDeletedRows)) throw new HTTPException(404, { message: "Not found" });
      return c.body(null, 204);
    });
}
