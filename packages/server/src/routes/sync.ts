import { Hono } from "hono";
import { SyncRequest, type SyncResponse } from "@rply/schema";
import { isServerToken } from "../auth.ts";
import { bearer, parse, type AppEnv, type Deps } from "../context.ts";
import { selectMessages, toMessage } from "../messages.ts";
import { longPoll } from "../notifier.ts";
import { hashToken, now } from "../tokens.ts";

const BATCH = 1000;

export function syncRoutes({ db, notifier, push }: Deps) {
  return new Hono<AppEnv>().post("/sync", async (c) => {
    const req = parse(SyncRequest, await c.req.json());

    const hashes = new Map(req.tokens.map((t) => [hashToken(t), t]));
    const humans = hashes.size
      ? await db
          .updateTable("human_tokens")
          .set({ last_seen_at: now() })
          .where("token_hash", "in", [...hashes.keys()])
          .where("revoked_at", "is", null)
          .returning(["token_hash", "channel_id"])
          .execute()
      : [];
    const isAdmin = await isServerToken(db, bearer(c.req.header("authorization")));
    const channelIds = isAdmin
      ? (await db.selectFrom("channels").select("id").execute()).map((ch) => ch.id)
      : humans.map((h) => h.channel_id);
    const valid = new Set(humans.map((h) => h.token_hash));
    const revoked = [...hashes].filter(([hash]) => !valid.has(hash)).map(([, token]) => token);

    const cursor = req.cursor ? Number(req.cursor) || 0 : await maxChange();
    const wait = req.wait ?? 0;
    if (push && req.push_endpoint) push.setPresence(req.push_endpoint, req.viewing ?? null, (wait + 15) * 1000);

    const changes = await longPoll({
      notifier,
      channelIds,
      waitSeconds: wait,
      signal: c.req.raw.signal,
      fetch: () =>
        channelIds.length === 0
          ? Promise.resolve([])
          : db
              .selectFrom("changes")
              .select(["seq", "message_id"])
              .where("channel_id", "in", channelIds)
              .where("seq", ">", cursor)
              .orderBy("seq", "asc")
              .limit(BATCH)
              .execute(),
      isEmpty: (rows) => rows.length === 0,
    });

    const ids = [...new Set(changes.map((ch) => ch.message_id))];
    const rows = ids.length ? await selectMessages(db).where("messages.id", "in", ids).orderBy("messages.seq", "asc").execute() : [];
    const res: SyncResponse = { cursor: String(changes.at(-1)?.seq ?? cursor), messages: rows.map(toMessage), revoked };
    return c.json(res);
  });

  async function maxChange() {
    const row = await db.selectFrom("changes").select((eb) => eb.fn.max("seq").as("seq")).executeTakeFirst();
    return Number(row?.seq ?? 0);
  }
}
