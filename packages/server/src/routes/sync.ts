import { Hono } from "hono";
import { SyncRequest, type SyncResponse } from "@rply/schema";
import { requireUser } from "../auth.ts";
import { parse, type AppEnv, type Deps } from "../context.ts";
import { selectMessages, toMessage } from "../messages.ts";
import { longPoll } from "../notifier.ts";
import { userKey } from "./channels.ts";

const BATCH = 1000;

export function syncRoutes(deps: Deps) {
  const { db, notifier, push } = deps;
  return new Hono<AppEnv>().post("/sync", requireUser(deps), async (c) => {
    const req = parse(SyncRequest, await c.req.json());
    const userId = c.var.user.id;
    const memberOf = async () => (await db.selectFrom("channel_members").select("channel_id").where("user_id", "=", userId).execute()).map((m) => m.channel_id);
    const channelIds = await memberOf();

    const cursor = req.cursor ? Number(req.cursor) || 0 : await maxChange();
    const wait = req.wait ?? 0;
    if (push && req.push_endpoint) push.setPresence(req.push_endpoint, req.viewing ?? null, (wait + 15) * 1000);

    const result = await longPoll({
      notifier,
      channelIds: [...channelIds, userKey(userId)],
      waitSeconds: wait,
      signal: c.req.raw.signal,
      fetch: async () => ({
        changes:
          channelIds.length === 0
            ? []
            : await db
                .selectFrom("changes")
                .select(["seq", "message_id"])
                .where("channel_id", "in", channelIds)
                .where("seq", ">", cursor)
                .orderBy("seq", "asc")
                .limit(BATCH)
                .execute(),
        channels: await memberOf(),
      }),
      isEmpty: (r) => r.changes.length === 0 && r.channels.length === channelIds.length && r.channels.every((id) => channelIds.includes(id)),
    });
    const { changes, channels } = result;

    const ids = [...new Set(changes.map((ch) => ch.message_id))];
    const rows = ids.length ? await selectMessages(db).where("messages.id", "in", ids).orderBy("messages.seq", "asc").execute() : [];
    const res: SyncResponse = { cursor: String(changes.at(-1)?.seq ?? cursor), messages: rows.map(toMessage), channels };
    return c.json(res);
  });

  async function maxChange() {
    const row = await db.selectFrom("changes").select((eb) => eb.fn.max("seq").as("seq")).executeTakeFirst();
    return Number(row?.seq ?? 0);
  }
}
