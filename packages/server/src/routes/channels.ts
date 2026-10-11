import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  ClaimPairingRequest,
  CreateChannelRequest,
  PublicKeyRequest,
  type ClaimPairingResponse,
  type CreateChannelResponse,
  type Pairing,
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

  return new Hono<AppEnv>()
    .get("/info", async (c) => {
      const info: ServerInfo = { server_token_required: await serverTokenRequired(db) };
      return c.json(info);
    })
    .post("/channels", async (c) => {
      await requireServerToken(db, c.req.header("authorization"));
      const { name } = parse(CreateChannelRequest, await c.req.json());

      const agentToken = createToken("a");
      const channel = {
        id: randomId(),
        name,
        agent_token_hash: hashToken(agentToken),
        agent_public_key: null,
        e2e: 0,
        owner_id: null,
        created_at: now(),
      };
      await db.insertInto("channels").values(channel).execute();

      const res: CreateChannelResponse = { channel: toChannel(channel), agent_token: agentToken, pairing: await createPairing(db, channel.id) };
      return c.json(res, 201);
    })
    .get("/channel", requireAuth(deps), (c) => c.json({ channel: toChannel(c.var.auth.channel) }))
    .put("/channel/key", requireAuth(deps, "agent"), async (c) => {
      const { public_key } = parse(PublicKeyRequest, await c.req.json());
      await db.updateTable("channels").set({ agent_public_key: public_key }).where("id", "=", c.var.auth.channel.id).execute();
      return c.json({ channel: toChannel({ ...c.var.auth.channel, agent_public_key: public_key }) });
    })
    .post("/pairings", requireAuth(deps, "agent"), async (c) => c.json(await createPairing(db, c.var.auth.channel.id), 201))
    .post("/pairings/claim", async (c) => {
      const { code, label } = parse(ClaimPairingRequest, await c.req.json());
      const pairing = await db
        .updateTable("pairing_codes")
        .set({ used_at: now() })
        .where("code_hash", "=", hashToken(normalizePairingCode(code)))
        .where("used_at", "is", null)
        .where("expires_at", ">", now())
        .returning("channel_id")
        .executeTakeFirst();
      if (!pairing) throw new HTTPException(404, { message: "Invalid or expired pairing code" });

      const token = createToken("h");
      await db
        .insertInto("human_tokens")
        .values({
          id: randomId(),
          channel_id: pairing.channel_id,
          token_hash: hashToken(token),
          label: label ?? null,
          created_at: now(),
          last_seen_at: null,
          revoked_at: null,
        })
        .execute();

      const channel = await db.selectFrom("channels").selectAll().where("id", "=", pairing.channel_id).executeTakeFirstOrThrow();
      const res: ClaimPairingResponse = { channel: toChannel(channel), token };
      return c.json(res, 201);
    });
}

async function createPairing(db: DB, channelId: string): Promise<Pairing> {
  const code = createPairingCode();
  const expires_at = now() + PAIRING_TTL_MS;
  await db
    .insertInto("pairing_codes")
    .values({ code_hash: hashToken(normalizePairingCode(code)), channel_id: channelId, expires_at, used_at: null })
    .execute();
  return { code, expires_at };
}
