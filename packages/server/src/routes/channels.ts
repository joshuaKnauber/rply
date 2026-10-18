import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  ClaimChannelRequest,
  CreateChannelRequest,
  JoinChannelRequest,
  PublicKeyRequest,
  ReadRequest,
  RenameAgentRequest,
  UpdateAgentRequest,
  type AgentsResponse,
  type ChannelsResponse,
  type ClaimChannelResponse,
  type CreateChannelResponse,
  type CreateOwnedChannelResponse,
  type JoinChannelResponse,
  type Pairing,
  type Sender,
  type ServerInfo,
} from "@rply/schema";
import { requireAuth, requireUser } from "../auth.ts";
import { parse, type AppEnv, type Deps } from "../context.ts";
import { clientIp, GUARDS } from "../limits.ts";
import type { Serves } from "../serves.ts";
import type { DB } from "../db/index.ts";
import { toChannel, toChannelEntry } from "../serialize.ts";
import { createAgentToken, createPairingCode, hashToken, normalizePairingCode, now, randomId } from "../tokens.ts";

const PAIRING_TTL_MS = 60 * 60 * 1000;

export const userKey = (userId: string) => `user:${userId}`;

export function channelRoutes(deps: Deps, serves: Serves) {
  const { db, accounts } = deps;
  const user = requireUser(deps);
  const owner = requireAuth(deps, "owner");
  const { limits } = deps;

  const memberChannels = (userId: string) =>
    db
      .selectFrom("channel_members as m")
      .innerJoin("channels", "channels.id", "m.channel_id")
      .selectAll("channels")
      .select(["m.role", "m.read_seq"])
      .where("m.user_id", "=", userId)
      .orderBy("channels.created_at", "asc");

  const addMember = async (channelId: string, userId: string) => {
    await db.insertInto("channel_members").values({ channel_id: channelId, user_id: userId, role: "owner", created_at: now() }).execute();
    deps.notifier.notify(userKey(userId));
    return toChannelEntry((await memberChannels(userId).where("channels.id", "=", channelId).executeTakeFirstOrThrow()));
  };

  const createChannel = async (name: string) => {
    const channel = { id: randomId(), name, e2e: 0, created_at: now() };
    await db.insertInto("channels").values(channel).execute();
    return channel;
  };

  return new Hono<AppEnv>()
    .get("/info", async (c) => {
      const info: ServerInfo = {
        needs_setup: !(await accounts.hasUsers()),
        ...accounts.info,
        files: { enabled: Boolean(deps.files), max_size: deps.files?.maxSize ?? 0 },
        push: deps.push ? { public_key: deps.push.publicKey } : null,
      };
      return c.json(info);
    })
    .get("/channels", user, async (c) => {
      const res: ChannelsResponse = { channels: (await memberChannels(c.var.user.id).execute()).map(toChannelEntry) };
      return c.json(res);
    })
    .post("/channels", async (c) => {
      const req = parse(CreateChannelRequest, await c.req.json());
      const signedIn = await accounts.user(c.req.raw.headers);

      if (signedIn) {
        await limits.canOwnAnother(signedIn.id);
        const channel = await createChannel(req.name);
        const res: CreateOwnedChannelResponse = { channel: await addMember(channel.id, signedIn.id), agent_code: await createPairing(db, channel.id, "agent") };
        return c.json(res, 201);
      }
      limits.anonymousChannel(clientIp(c));
      const channel = await createChannel(req.name);
      const res: CreateChannelResponse = {
        channel: toChannel(channel),
        agent_token: await addAgentToken(db, channel.id, req.label),
        claim: await createPairing(db, channel.id, "human"),
      };
      return c.json(res, 201);
    })
    .post("/channels/claim", user, async (c) => {
      const { code } = parse(ClaimChannelRequest, await c.req.json());
      await limits.canOwnAnother(c.var.user.id);
      const channelId = await limits.code(clientIp(c), () => usePairing(db, code, "human"));
      if (await isClaimed(db, channelId)) throw new HTTPException(409, { message: "This channel already belongs to an account" });
      const res: ClaimChannelResponse = { channel: await addMember(channelId, c.var.user.id) };
      return c.json(res, 201);
    })
    .get("/channel", requireAuth(deps), (c) => c.json({ channel: toChannel(c.var.auth.channel) }))
    .delete("/channel", owner, async (c) => {
      await deleteChannel(deps, c.var.auth.channel.id);
      return c.body(null, 204);
    })
    .put("/channel/read", requireAuth(deps, "human"), async (c) => {
      const { seq } = parse(ReadRequest, await c.req.json());
      await db
        .updateTable("channel_members")
        .set({ read_seq: seq })
        .where("channel_id", "=", c.var.auth.channel.id)
        .where("user_id", "=", c.var.auth.userId!)
        .where("read_seq", "<", seq)
        .execute();
      return c.body(null, 204);
    })
    .get("/agents", requireAuth(deps), async (c) => {
      const rows = await db
        .selectFrom("agent_tokens")
        .select(["id", "label", "avatar", "created_at", "last_seen_at"])
        .where("channel_id", "=", c.var.auth.channel.id)
        .where("revoked_at", "is", null)
        .orderBy("created_at")
        .execute();
      const res: AgentsResponse = {
        agents: rows.map((a) => {
          const serve = serves.online(a.id);
          return {
            ...a,
            avatar: a.avatar ? JSON.parse(a.avatar) : null,
            current: a.id === c.var.auth.agentId,
            serve: serve ? { commands: [...serve.commands], wakes: serve.wakes } : null,
          };
        }),
      };
      return c.json(res);
    })
    // the human renames an agent or dresses up its bird
    .patch("/agents/:id", requireAuth(deps, "human"), async (c) => {
      const { label, avatar } = parse(UpdateAgentRequest, await c.req.json());
      const res = await db
        .updateTable("agent_tokens")
        .set({ ...(label !== undefined && { label }), ...(avatar !== undefined && { avatar: avatar && JSON.stringify(avatar) }) })
        .where("id", "=", c.req.param("id"))
        .where("channel_id", "=", c.var.auth.channel.id)
        .where("revoked_at", "is", null)
        .executeTakeFirst();
      if (!res.numUpdatedRows) throw new HTTPException(404, { message: "Not found" });
      return c.body(null, 204);
    })
    .delete("/agents/:id", owner, async (c) => {
      const res = await db
        .updateTable("agent_tokens")
        .set({ revoked_at: now() })
        .where("id", "=", c.req.param("id"))
        .where("channel_id", "=", c.var.auth.channel.id)
        .where("revoked_at", "is", null)
        .executeTakeFirst();
      if (!res.numUpdatedRows) throw new HTTPException(404, { message: "Not found" });
      return c.body(null, 204);
    })
    .patch("/agent", requireAuth(deps, "agent"), async (c) => {
      const { label } = parse(RenameAgentRequest, await c.req.json());
      await db.updateTable("agent_tokens").set({ label }).where("id", "=", c.var.auth.agentId!).execute();
      return c.json({ label });
    })
    .put("/channel/key", requireAuth(deps, "agent"), async (c) => {
      const { public_key } = parse(PublicKeyRequest, await c.req.json());
      await db.updateTable("agent_tokens").set({ public_key }).where("id", "=", c.var.auth.agentId!).execute();
      return c.json({ channel: toChannel(c.var.auth.channel) });
    })
    // agents get a new claim link while their channel has no owner, owners get an agent code
    .post("/pairings", requireAuth(deps), async (c) => {
      const { channel, sender, role } = c.var.auth;
      if (sender === "agent") {
        if (await isClaimed(db, channel.id)) throw new HTTPException(409, { message: "This channel already belongs to an account" });
        return c.json(await createPairing(db, channel.id, "human"), 201);
      }
      if (role !== "owner") throw new HTTPException(403, { message: "Only the channel's owner can add agents" });
      return c.json(await createPairing(db, channel.id, "agent"), 201);
    })
    .post("/agents/join", async (c) => {
      const { code, label } = parse(JoinChannelRequest, await c.req.json());
      const channelId = await limits.code(clientIp(c), () => usePairing(db, code, "agent"));
      await limits.agentSlot(channelId);
      const token = await addAgentToken(db, channelId, label);
      const res: JoinChannelResponse = { channel: toChannel(await db.selectFrom("channels").selectAll().where("id", "=", channelId).executeTakeFirstOrThrow()), agent_token: token };
      return c.json(res, 201);
    });
}

const isClaimed = async (db: DB, channelId: string) =>
  Boolean(await db.selectFrom("channel_members").select("user_id").where("channel_id", "=", channelId).limit(1).executeTakeFirst());

export async function deleteChannel(deps: Deps, channelId: string) {
  const { db } = deps;
  const members = await db.selectFrom("channel_members").select("user_id").where("channel_id", "=", channelId).execute();
  const files = await db.selectFrom("files").select("id").where("channel_id", "=", channelId).where("deleted_at", "is", null).execute();
  await Promise.all(files.map((f) => deps.files?.store.remove(f.id)));
  await db.deleteFrom("channels").where("id", "=", channelId).execute();
  deps.notifier.notify(channelId);
  for (const m of members) deps.notifier.notify(userKey(m.user_id));
}

export async function deleteOwnedChannels(deps: Deps, userId: string) {
  const owned = await deps.db.selectFrom("channel_members").select("channel_id").where("user_id", "=", userId).where("role", "=", "owner").execute();
  for (const { channel_id } of owned) await deleteChannel(deps, channel_id);
}

// channels created by `rply init` disappear when nobody claimed them before their last claim code expired,
// and after a day at most, however often `rply pair` renewed the code
export async function sweepUnclaimed(deps: Deps) {
  const rows = await deps.db
    .selectFrom("channels")
    .select("id")
    .where("created_at", "<", now() - PAIRING_TTL_MS)
    .where((eb) =>
      eb.and([
        eb.not(eb.exists(eb.selectFrom("channel_members").select("user_id").whereRef("channel_members.channel_id", "=", "channels.id"))),
        eb.or([
          eb("created_at", "<", now() - GUARDS.unclaimedLifetimeMs),
          eb.not(
            eb.exists(
              eb
                .selectFrom("pairing_codes")
                .select("code_hash")
                .whereRef("pairing_codes.channel_id", "=", "channels.id")
                .where("pairing_codes.role", "=", "human")
                .where("pairing_codes.used_at", "is", null)
                .where("pairing_codes.expires_at", ">", now()),
            ),
          ),
        ]),
      ]),
    )
    .execute();
  for (const row of rows) await deleteChannel(deps, row.id);
  return rows.length;
}

async function createPairing(db: DB, channelId: string, role: Sender): Promise<Pairing> {
  const code = createPairingCode();
  const expires_at = now() + PAIRING_TTL_MS;
  await db
    .insertInto("pairing_codes")
    .values({ code_hash: hashToken(normalizePairingCode(code)), channel_id: channelId, role, expires_at, used_at: null })
    .execute();
  return { code, expires_at };
}

async function usePairing(db: DB, code: string, role: Sender) {
  const pairing = await db
    .updateTable("pairing_codes")
    .set({ used_at: now() })
    .where("code_hash", "=", hashToken(normalizePairingCode(code)))
    .where("role", "=", role)
    .where("used_at", "is", null)
    .where("expires_at", ">", now())
    .returning("channel_id")
    .executeTakeFirst();
  if (!pairing) throw new HTTPException(404, { message: role === "agent" ? "Invalid or expired agent code" : "Invalid or expired claim code" });
  return pairing.channel_id;
}

async function addAgentToken(db: DB, channelId: string, label?: string) {
  const token = createAgentToken();
  await db
    .insertInto("agent_tokens")
    .values({ id: randomId(), channel_id: channelId, token_hash: hashToken(token), label: label ?? null, public_key: null, created_at: now(), last_seen_at: null, revoked_at: null })
    .execute();
  return token;
}
