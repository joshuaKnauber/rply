import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { PushSubscriptionRequest, PushUnsubscribeRequest } from "@rply/schema";
import { bearer, parse, type AppEnv, type Deps } from "../context.ts";
import { hashToken, now, randomId } from "../tokens.ts";

export function pushRoutes({ db, push }: Deps) {
  const enabled = () => {
    if (!push) throw new HTTPException(404, { message: "Push notifications are not available on this server" });
    return push;
  };

  return new Hono<AppEnv>()
    .put("/push/subscription", async (c) => {
      enabled();
      const { subscription, tokens } = parse(PushSubscriptionRequest, await c.req.json());
      const humans = tokens.length
        ? await db.selectFrom("human_tokens").select("id").where("token_hash", "in", tokens.map(hashToken)).where("revoked_at", "is", null).execute()
        : [];
      const admin = bearer(c.req.header("authorization"));
      const apiKey = admin ? await db.selectFrom("api_keys").select("id").where("token_hash", "=", hashToken(admin)).executeTakeFirst() : undefined;
      if (humans.length === 0 && !apiKey) throw new HTTPException(400, { message: "No valid channel tokens to subscribe with" });

      const base = { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, created_at: now() };
      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom("push_subscriptions").where("endpoint", "=", subscription.endpoint).execute();
        const rows = [
          ...humans.map((h) => ({ ...base, id: randomId(), human_token_id: h.id, api_key_id: null })),
          ...(apiKey ? [{ ...base, id: randomId(), human_token_id: null, api_key_id: apiKey.id }] : []),
        ];
        await trx.insertInto("push_subscriptions").values(rows).execute();
      });
      return c.json({ channels: humans.length, all_channels: Boolean(apiKey) });
    })
    .delete("/push/subscription", async (c) => {
      const { endpoint } = parse(PushUnsubscribeRequest, await c.req.json());
      await db.deleteFrom("push_subscriptions").where("endpoint", "=", endpoint).execute();
      return c.body(null, 204);
    });
}
