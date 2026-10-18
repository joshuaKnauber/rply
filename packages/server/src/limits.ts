import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AccountUsage } from "@rply/schema";
import type { DB } from "./db/index.ts";
import { parseRetention, parseSize } from "./files/config.ts";

// Per-account quotas, counted over the channels a user owns. Off unless set: rply.sh sets them, self-hosted servers usually don't.
export type Quotas = {
  channels: number | null;
  messagesPerDay: number | null;
  storage: number | null;
  messageRetentionMs: number | null;
};

export const noQuotas: Quotas = { channels: null, messagesPerDay: null, storage: null, messageRetentionMs: null };

// Always on: they protect the server itself and are loose enough that normal use never meets them.
export const GUARDS = {
  writesPerChannelPerMinute: 120,
  callsPerChannelPerMinute: 120,
  unfurlsPerChannelPerMinute: 30,
  failedCodesPerIp: 10,
  failedCodesWindowMs: 15 * 60 * 1000,
  agentsPerChannel: 20,
  unclaimedMessages: 100,
  unclaimedLifetimeMs: 24 * 60 * 60 * 1000,
  anonymousChannelsPerIpPerHour: 20,
  feedbackPerIpPerHour: 5,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseCount(input: string | undefined, name: string) {
  if (!input) return null;
  const value = Number(input);
  if (!Number.isInteger(value) || value < 1) throw new Error(`Invalid ${name} "${input}", use a whole number`);
  return value;
}

export function quotasFromEnv(env: NodeJS.ProcessEnv): Quotas {
  return {
    channels: parseCount(env.RPLY_LIMIT_CHANNELS, "RPLY_LIMIT_CHANNELS"),
    messagesPerDay: parseCount(env.RPLY_LIMIT_MESSAGES_PER_DAY, "RPLY_LIMIT_MESSAGES_PER_DAY"),
    storage: env.RPLY_LIMIT_STORAGE ? parseSize(env.RPLY_LIMIT_STORAGE, 0) : null,
    messageRetentionMs: parseRetention(env.RPLY_MESSAGE_RETENTION, "RPLY_MESSAGE_RETENTION"),
  };
}

// sliding window per key, in memory (one server instance)
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  const recent = (key: string) => (hits.get(key) ?? []).filter((t) => t > Date.now() - windowMs);
  const record = (key: string) => {
    const times = recent(key);
    hits.delete(key);
    hits.set(key, [...times, Date.now()]);
    if (hits.size > 10_000) hits.delete(hits.keys().next().value!);
  };
  return {
    blocked: (key: string) => recent(key).length >= max,
    record,
    take(key: string) {
      if (recent(key).length >= max) return false;
      record(key);
      return true;
    },
  };
}

export type Limits = ReturnType<typeof createLimits>;

export function createLimits(db: DB, quotas: Quotas = noQuotas) {
  const writes = createRateLimiter(GUARDS.writesPerChannelPerMinute, 60_000);
  const calls = createRateLimiter(GUARDS.callsPerChannelPerMinute, 60_000);
  const unfurls = createRateLimiter(GUARDS.unfurlsPerChannelPerMinute, 60_000);
  const failedCodes = createRateLimiter(GUARDS.failedCodesPerIp, GUARDS.failedCodesWindowMs);
  const anonymousChannels = createRateLimiter(GUARDS.anonymousChannelsPerIpPerHour, 60 * 60 * 1000);
  const feedback = createRateLimiter(GUARDS.feedbackPerIpPerHour, 60 * 60 * 1000);
  const tooMany = (message: string) => new HTTPException(429, { message });

  const ownerOf = async (channelId: string) =>
    (await db.selectFrom("channel_members").select("user_id").where("channel_id", "=", channelId).where("role", "=", "owner").executeTakeFirst())?.user_id;

  const ownedChannels = (userId: string) =>
    db.selectFrom("channel_members").select("channel_id").where("user_id", "=", userId).where("role", "=", "owner");

  const channelsOwned = async (userId: string) =>
    Number((await db.selectFrom("channel_members").select((eb) => eb.fn.countAll<number>().as("n")).where("user_id", "=", userId).where("role", "=", "owner").executeTakeFirstOrThrow()).n);

  const messagesToday = async (userId: string) =>
    Number(
      (
        await db
          .selectFrom("messages")
          .select((eb) => eb.fn.countAll<number>().as("n"))
          .where("channel_id", "in", ownedChannels(userId))
          .where("created_at", ">", Date.now() - DAY_MS)
          .executeTakeFirstOrThrow()
      ).n,
    );

  const storageUsed = async (userId: string) =>
    Number(
      (
        await db
          .selectFrom("files")
          .select((eb) => eb.fn.coalesce(eb.fn.sum<number>("size"), eb.lit(0)).as("used"))
          .where("channel_id", "in", ownedChannels(userId))
          .where("deleted_at", "is", null)
          .executeTakeFirstOrThrow()
      ).used,
    );

  return {
    quotas,

    // only the quotas this server sets, with what the user uses of them
    async usage(userId: string): Promise<AccountUsage> {
      return {
        channels: quotas.channels === null ? null : { used: await channelsOwned(userId), limit: quotas.channels },
        messages_per_day: quotas.messagesPerDay === null ? null : { used: await messagesToday(userId), limit: quotas.messagesPerDay },
        storage: quotas.storage === null ? null : { used: await storageUsed(userId), limit: quotas.storage },
        message_retention_days: quotas.messageRetentionMs === null ? null : Math.round(quotas.messageRetentionMs / DAY_MS),
      };
    },

    async canOwnAnother(userId: string) {
      if (quotas.channels === null) return;
      if ((await channelsOwned(userId)) >= quotas.channels) throw new HTTPException(403, { message: `Your account can own at most ${quotas.channels} channels. Delete one to make room.` });
    },

    write(channelId: string) {
      if (!writes.take(channelId)) throw tooMany("Too many writes to this channel, slow down (max 120 a minute)");
    },

    // a new message: burst guard, then the owner's daily quota (or the cap for unclaimed channels)
    async newMessage(channelId: string) {
      if (!writes.take(channelId)) throw tooMany("Too many writes to this channel, slow down (max 120 a minute)");
      const owner = await ownerOf(channelId);
      if (!owner) {
        const { n } = await db.selectFrom("messages").select((eb) => eb.fn.countAll<number>().as("n")).where("channel_id", "=", channelId).executeTakeFirstOrThrow();
        if (Number(n) >= GUARDS.unclaimedMessages) throw new HTTPException(403, { message: `Unclaimed channels hold at most ${GUARDS.unclaimedMessages} messages. Open the claim link (rply pair prints a new one).` });
        return;
      }
      if (quotas.messagesPerDay === null) return;
      if ((await messagesToday(owner)) >= quotas.messagesPerDay) throw tooMany(`This account reached its ${quotas.messagesPerDay} messages per day. Older messages free up over the next 24 hours.`);
    },

    async upload(channelId: string, size: number) {
      const owner = await ownerOf(channelId);
      if (!owner) throw new HTTPException(403, { message: "Files need a claimed channel. Open the claim link first (rply pair prints a new one)." });
      if (quotas.storage === null) return;
      if ((await storageUsed(owner)) + size > quotas.storage) throw new HTTPException(507, { message: `This account's file storage is full (${Math.round(quotas.storage / 1024 / 1024)} MB). Delete messages with files to free some.` });
    },

    call(channelId: string) {
      if (!calls.take(channelId)) throw tooMany("Too many calls from this channel's apps, slow down (max 120 a minute)");
    },

    unfurl(channelId: string) {
      if (!unfurls.take(channelId)) throw tooMany("Too many link previews, try again in a minute");
    },

    async agentSlot(channelId: string) {
      const { n } = await db.selectFrom("agent_tokens").select((eb) => eb.fn.countAll<number>().as("n")).where("channel_id", "=", channelId).where("revoked_at", "is", null).executeTakeFirstOrThrow();
      if (Number(n) >= GUARDS.agentsPerChannel) throw new HTTPException(403, { message: `A channel can have at most ${GUARDS.agentsPerChannel} agents. Revoke one first.` });
    },

    anonymousChannel(ip: string) {
      if (!anonymousChannels.take(ip)) throw tooMany("Too many new channels from here, try again later");
    },

    feedback(ip: string) {
      if (!feedback.take(ip)) throw tooMany("Thanks, that's enough feedback for now. Try again in an hour.");
    },

    // codes are short, so guessing is limited per IP; only failures count
    async code<T>(ip: string, use: () => Promise<T>) {
      if (failedCodes.blocked(ip)) throw tooMany("Too many wrong codes, try again in 15 minutes");
      try {
        return await use();
      } catch (err) {
        if (err instanceof HTTPException && err.status === 404) failedCodes.record(ip);
        throw err;
      }
    },
  };
}

// The proxy in front (Railway, Fly, Caddy) appends the address it saw, so the last entry is the one a client can't fake.
export function clientIp(c: Context) {
  const forwarded = c.req.header("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.at(-1) ?? "direct";
}
