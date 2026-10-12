import webpush from "web-push";
import type { DB } from "../db/index.ts";

export type PushPayload = { title: string; body: string; url: string; tag: string };
export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushSender = (target: PushTarget, payload: string) => Promise<void>;
export type Push = Awaited<ReturnType<typeof createPush>>;

const SUBJECT = "https://rply.sh";

async function vapidKeys(db: DB, env: NodeJS.ProcessEnv) {
  if (env.RPLY_VAPID_PUBLIC_KEY && env.RPLY_VAPID_PRIVATE_KEY) return { publicKey: env.RPLY_VAPID_PUBLIC_KEY, privateKey: env.RPLY_VAPID_PRIVATE_KEY };
  const stored = await db.selectFrom("settings").select("value").where("key", "=", "vapid").executeTakeFirst();
  if (stored) return JSON.parse(stored.value) as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  await db.insertInto("settings").values({ key: "vapid", value: JSON.stringify(keys) }).execute();
  return keys;
}

export async function createPush(db: DB, opts: { env?: NodeJS.ProcessEnv; send?: PushSender } = {}) {
  const keys = await vapidKeys(db, opts.env ?? {});
  const subject = opts.env?.RPLY_VAPID_SUBJECT ?? SUBJECT;
  const send: PushSender =
    opts.send ??
    (async (target, payload) => {
      await webpush.sendNotification(target, payload, { vapidDetails: { subject, ...keys }, TTL: 3600, urgency: "high" });
    });
  const presence = new Map<string, { channelId: string | null; expires: number }>();

  const targets = async (channelId: string) => {
    const rows = await db
      .selectFrom("push_subscriptions as s")
      .innerJoin("channel_members as m", "m.user_id", "s.user_id")
      .select(["s.endpoint", "s.p256dh", "s.auth"])
      .where("m.channel_id", "=", channelId)
      .execute();
    return [...new Map(rows.map((r) => [r.endpoint, r])).values()];
  };

  const isViewing = (endpoint: string, channelId: string) => {
    const p = presence.get(endpoint);
    return Boolean(p && p.channelId === channelId && p.expires > Date.now());
  };

  return {
    publicKey: keys.publicKey,
    setPresence(endpoint: string, channelId: string | null, ttlMs: number) {
      presence.set(endpoint, { channelId, expires: Date.now() + ttlMs });
    },
    async notify(channelId: string, payload: PushPayload) {
      const body = JSON.stringify(payload);
      for (const t of await targets(channelId)) {
        if (isViewing(t.endpoint, channelId)) continue;
        send({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body).catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await db.deleteFrom("push_subscriptions").where("endpoint", "=", t.endpoint).execute();
          } else console.error("push failed", err.statusCode ?? err);
        });
      }
    },
  };
}
