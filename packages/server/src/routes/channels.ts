import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  ClaimPairingRequest,
  CreateChannelRequest,
  CreatePairingRequest,
  PublicKeyRequest,
  RenameAgentRequest,
  type AgentsResponse,
  type ClaimPairingResponse,
  type CreateChannelAsHumanResponse,
  type CreateChannelResponse,
  type DevicesResponse,
  type JoinChannelResponse,
  type Pairing,
  type Sender,
  type ServerInfo,
} from "@rply/schema";
import { requireAuth, requireServerToken, serverTokenRequired } from "../auth.ts";
import { parse, type AppEnv, type Deps } from "../context.ts";
import type { DB } from "../db/index.ts";
import { toChannel } from "../serialize.ts";
import { createPairingCode, createToken, hashToken, normalizePairingCode, now, randomId } from "../tokens.ts";

const PAIRING_TTL_MS = 10 * 60 * 1000;

export function channelRoutes(deps: Deps) {
  const { db } = deps;
  const human = requireAuth(deps, "human");

  return new Hono<AppEnv>()
    .get("/info", async (c) => {
      const info: ServerInfo = {
        server_token_required: await serverTokenRequired(db),
        files: { enabled: Boolean(deps.files), max_size: deps.files?.maxSize ?? 0 },
        push: deps.push ? { public_key: deps.push.publicKey } : null,
      };
      return c.json(info);
    })
    .post("/channels", async (c) => {
      await requireServerToken(db, c.req.header("authorization"));
      const req = parse(CreateChannelRequest, await c.req.json());

      const channel = {
        id: randomId(),
        name: req.name,
        // legacy column, agents live in agent_tokens now
        agent_token_hash: hashToken(createToken("a")),
        agent_public_key: null,
        e2e: 0,
        owner_id: null,
        created_at: now(),
      };
      await db.insertInto("channels").values(channel).execute();

      if (req.as === "human") {
        const res: CreateChannelAsHumanResponse = {
          channel: toChannel(channel),
          token: await addHumanToken(db, channel.id, req.label),
          agent_code: await createPairing(db, channel.id, "agent"),
        };
        return c.json(res, 201);
      }
      const res: CreateChannelResponse = {
        channel: toChannel(channel),
        agent_token: await addAgentToken(db, channel.id, req.label),
        pairing: await createPairing(db, channel.id, "human"),
      };
      return c.json(res, 201);
    })
    .get("/channel", requireAuth(deps), (c) => c.json({ channel: toChannel(c.var.auth.channel) }))
    .get("/devices", requireAuth(deps), async (c) => {
      const rows = await activeTokens(db, "human_tokens", c.var.auth.channel.id);
      const res: DevicesResponse = { devices: rows.map((d) => ({ ...d, current: d.id === c.var.auth.deviceId })) };
      return c.json(res);
    })
    .get("/agents", requireAuth(deps), async (c) => {
      const rows = await activeTokens(db, "agent_tokens", c.var.auth.channel.id);
      const res: AgentsResponse = { agents: rows.map((a) => ({ ...a, current: a.id === c.var.auth.agentId })) };
      return c.json(res);
    })
    .delete("/devices/:id", human, (c) => revoke(db, "human_tokens", c.var.auth.channel.id, c.req.param("id")).then(() => c.body(null, 204)))
    .delete("/agents/:id", human, (c) => revoke(db, "agent_tokens", c.var.auth.channel.id, c.req.param("id")).then(() => c.body(null, 204)))
    .patch("/agent", requireAuth(deps, "agent"), async (c) => {
      const { label } = parse(RenameAgentRequest, await c.req.json());
      await db.updateTable("agent_tokens").set({ label }).where("id", "=", c.var.auth.agentId!).execute();
      return c.json({ label });
    })
    .put("/channel/key", requireAuth(deps, "agent"), async (c) => {
      const { public_key } = parse(PublicKeyRequest, await c.req.json());
      await db.updateTable("agent_tokens").set({ public_key }).where("id", "=", c.var.auth.agentId!).execute();
      await db.updateTable("channels").set({ agent_public_key: public_key }).where("id", "=", c.var.auth.channel.id).execute();
      return c.json({ channel: toChannel({ ...c.var.auth.channel, agent_public_key: public_key }) });
    })
    .post("/pairings", requireAuth(deps), async (c) => {
      const { role } = parse(CreatePairingRequest, await c.req.json().catch(() => ({})));
      if (role === "agent" && c.var.auth.sender !== "human") throw new HTTPException(403, { message: "Only the human can invite agents" });
      return c.json(await createPairing(db, c.var.auth.channel.id, role), 201);
    })
    .post("/pairings/claim", async (c) => {
      const { code, label } = parse(ClaimPairingRequest, await c.req.json());
      const channelId = await usePairing(db, code, "human");
      const token = await addHumanToken(db, channelId, label);
      const res: ClaimPairingResponse = { channel: toChannel(await loadChannel(db, channelId)), token };
      return c.json(res, 201);
    })
    .post("/agents/join", async (c) => {
      const { code, label } = parse(ClaimPairingRequest, await c.req.json());
      const channelId = await usePairing(db, code, "agent");
      const token = await addAgentToken(db, channelId, label);
      const res: JoinChannelResponse = { channel: toChannel(await loadChannel(db, channelId)), agent_token: token };
      return c.json(res, 201);
    });
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
  if (!pairing) throw new HTTPException(404, { message: role === "agent" ? "Invalid or expired agent code" : "Invalid or expired pairing code" });
  return pairing.channel_id;
}

async function addHumanToken(db: DB, channelId: string, label?: string) {
  const token = createToken("h");
  await db
    .insertInto("human_tokens")
    .values({ id: randomId(), channel_id: channelId, token_hash: hashToken(token), label: label ?? null, created_at: now(), last_seen_at: null, revoked_at: null })
    .execute();
  return token;
}

async function addAgentToken(db: DB, channelId: string, label?: string) {
  const token = createToken("a");
  await db
    .insertInto("agent_tokens")
    .values({ id: randomId(), channel_id: channelId, token_hash: hashToken(token), label: label ?? null, public_key: null, created_at: now(), last_seen_at: null, revoked_at: null })
    .execute();
  return token;
}

const activeTokens = (db: DB, table: "human_tokens" | "agent_tokens", channelId: string) =>
  db
    .selectFrom(table)
    .select(["id", "label", "created_at", "last_seen_at"])
    .where("channel_id", "=", channelId)
    .where("revoked_at", "is", null)
    .orderBy("created_at")
    .execute();

async function revoke(db: DB, table: "human_tokens" | "agent_tokens", channelId: string, id: string) {
  const res = await db
    .updateTable(table)
    .set({ revoked_at: now() })
    .where("id", "=", id)
    .where("channel_id", "=", channelId)
    .where("revoked_at", "is", null)
    .executeTakeFirst();
  if (!res.numUpdatedRows) throw new HTTPException(404, { message: "Not found" });
}

const loadChannel = (db: DB, id: string) => db.selectFrom("channels").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
