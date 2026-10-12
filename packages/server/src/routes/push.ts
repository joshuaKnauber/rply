import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { PushSubscriptionRequest, PushUnsubscribeRequest } from "@rply/schema";
import { requireUser } from "../auth.ts";
import { parse, type AppEnv, type Deps } from "../context.ts";
import { now, randomId } from "../tokens.ts";

export function pushRoutes(deps: Deps) {
  const { db, push } = deps;
  const enabled = () => {
    if (!push) throw new HTTPException(404, { message: "Push notifications are not available on this server" });
    return push;
  };

  return new Hono<AppEnv>()
    .put("/push/subscription", requireUser(deps), async (c) => {
      enabled();
      const { subscription } = parse(PushSubscriptionRequest, await c.req.json());
      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom("push_subscriptions").where("endpoint", "=", subscription.endpoint).execute();
        await trx
          .insertInto("push_subscriptions")
          .values({
            id: randomId(),
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            user_id: c.var.user.id,
            created_at: now(),
          })
          .execute();
      });
      return c.body(null, 204);
    })
    .delete("/push/subscription", async (c) => {
      const { endpoint } = parse(PushUnsubscribeRequest, await c.req.json());
      await db.deleteFrom("push_subscriptions").where("endpoint", "=", endpoint).execute();
      return c.body(null, 204);
    });
}
