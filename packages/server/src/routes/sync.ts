import { Hono } from "hono";
import { SyncRequest, type SyncResponse } from "@rply/schema";
import { isServerToken } from "../auth.ts";
import { bearer, parse, type AppEnv, type Deps } from "../context.ts";
import { longPoll } from "../notifier.ts";
import { toMessage, toStatus } from "../serialize.ts";
import { hashToken, now } from "../tokens.ts";

const BATCH = 500;

export function syncRoutes({ db, notifier }: Deps) {
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

    const cursor = req.cursor ? decodeCursor(req.cursor) : { seq: await maxSeq(), statusAt: 0 };

    const fetch = async () => {
      if (channelIds.length === 0) return { messages: [], statuses: [] };
      const [messages, statuses] = await Promise.all([
        db
          .selectFrom("messages")
          .selectAll()
          .where("channel_id", "in", channelIds)
          .where("seq", ">", cursor.seq)
          .orderBy("seq", "asc")
          .limit(BATCH)
          .execute(),
        db.selectFrom("status_pages").selectAll().where("channel_id", "in", channelIds).where("updated_at", ">", cursor.statusAt).execute(),
      ]);
      return { messages, statuses };
    };

    const result = await longPoll({
      notifier,
      channelIds,
      waitSeconds: req.wait ?? 0,
      signal: c.req.raw.signal,
      fetch,
      isEmpty: (r) => r.messages.length === 0 && r.statuses.length === 0,
    });

    const next = {
      seq: result.messages.at(-1)?.seq ?? cursor.seq,
      statusAt: Math.max(cursor.statusAt, ...result.statuses.map((s) => Number(s.updated_at))),
    };
    const res: SyncResponse = {
      cursor: `${next.seq}.${next.statusAt}`,
      messages: result.messages.map(toMessage),
      statuses: result.statuses.map(toStatus),
      revoked,
    };
    return c.json(res);
  });

  async function maxSeq() {
    const row = await db.selectFrom("messages").select((eb) => eb.fn.max("seq").as("seq")).executeTakeFirst();
    return Number(row?.seq ?? 0);
  }
}

function decodeCursor(cursor: string) {
  const [seq, statusAt] = cursor.split(".").map(Number);
  return { seq: seq || 0, statusAt: statusAt || 0 };
}
