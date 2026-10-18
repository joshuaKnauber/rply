import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  AgentMessageBody,
  hasSecretBlock,
  HumanMessageBody,
  isInput,
  MessageStateRequest,
  PatchMessageRequest,
  PostMessageRequest,
  ReplaceMessageRequest,
  type AskResponse,
  type MessageSender,
  type MessagesResponse,
  type Sender,
} from "@rply/schema";
import { requireAuth } from "../auth.ts";
import { parse, waitParam, type AppEnv, type Deps } from "../context.ts";
import { assertOwnMessage, insertMessage, loadMessage, recordChanges, selectLiveMessages, toMessage } from "../messages.ts";
import { checkFiles, deleteFilesOf, linkFiles } from "../files/manage.ts";
import { longPoll } from "../notifier.ts";
import { notifyAboutMessage } from "../push/notify.ts";
import { applyPatch } from "../patch.ts";
import { now, randomId } from "../tokens.ts";

export function rejectSecretBlocks(blocks: unknown) {
  if (hasSecretBlock(blocks)) throw new HTTPException(400, { message: "Secret requests are created with rply secret request" });
}

export function messageRoutes(deps: Deps) {
  const { db, notifier } = deps;
  const auth = requireAuth(deps);
  const agent = requireAuth(deps, "agent");

  const loadAgentMessage = async (channelId: string, id: string, agentId: string) => {
    const row = await loadMessage(db, channelId, id);
    if (row.sender !== "agent") throw new HTTPException(400, { message: "Only agent messages can be changed" });
    assertOwnMessage(row, agentId);
    return row;
  };

  // a plain reply to an agent's message is meant for that agent, as if it was mentioned
  const repliedAgent = async (channelId: string, sender: Sender, replyTo: string | undefined, body: unknown) => {
    if (sender !== "human" || !replyTo || !body || typeof body !== "object" || "answers" in body || "event" in body) return [];
    const row = await db
      .selectFrom("messages")
      .innerJoin("agent_tokens", "agent_tokens.id", "messages.agent_id")
      .select("agent_tokens.id")
      .where("messages.id", "=", replyTo)
      .where("messages.channel_id", "=", channelId)
      .where("agent_tokens.revoked_at", "is", null)
      .executeTakeFirst();
    return row ? [row.id] : [];
  };

  const checkMentions = async (channelId: string, sender: Sender, ids: string[] = []) => {
    const unique = [...new Set(ids)];
    if (!unique.length) return unique;
    if (sender !== "human") throw new HTTPException(400, { message: "Only the human can mention agents" });
    const agents = await db.selectFrom("agent_tokens").select("id").where("channel_id", "=", channelId).where("revoked_at", "is", null).where("id", "in", unique).execute();
    if (agents.length !== unique.length) throw new HTTPException(400, { message: "Mentions must be agents of this channel" });
    return unique;
  };

  return new Hono<AppEnv>()
    .post("/messages", auth, async (c) => {
      const { channel, sender } = c.var.auth;
      const req = parse(PostMessageRequest, await c.req.json());
      await deps.limits.newMessage(channel.id);
      const body = req.enc ? undefined : parse(sender === "agent" ? AgentMessageBody : HumanMessageBody, req.body);
      if (body && "blocks" in body) rejectSecretBlocks(body.blocks);
      const id = randomId();
      const fileIds = await checkFiles(deps, channel.id, body);
      if (sender === "human" && req.ask) throw new HTTPException(400, { message: "Only the agent can ask" });
      const mentions = await checkMentions(channel.id, sender, [...(req.mentions ?? []), ...(await repliedAgent(channel.id, sender, req.reply_to, body))]);

      const ask = sender === "agent" && (req.ask ?? (body && "blocks" in body && body.blocks?.some(isInput) ? {} : undefined));
      const changed = [id];

      await db.transaction().execute(async (trx) => {
        const isEvent = Boolean(body && "event" in body && body.event);
        if (isEvent && !req.reply_to) throw new HTTPException(400, { message: "An event needs reply_to, the message it came from" });
        if (req.reply_to) {
          const target = await loadMessage(trx, channel.id, req.reply_to);
          if (isEvent && target.sender !== "agent") throw new HTTPException(400, { message: "Events can only come from agent messages" });
          if (sender === "human" && target.ask_status && !isEvent) {
            if (body && !("answers" in body && body.answers)) throw new HTTPException(400, { message: "Answer a question with answers" });
            const result = await trx
              .updateTable("asks")
              .set({ status: "answered", answer_id: id, closed_at: now() })
              .where("message_id", "=", target.id)
              .where("status", "=", "open")
              .where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now())]))
              .executeTakeFirst();
            if (Number(result.numUpdatedRows) === 0) {
              throw new HTTPException(409, { message: `This question is already ${toMessage(target).ask?.status}` });
            }
            changed.push(target.id);
          }
        }

        await insertMessage(trx, {
          id,
          channel_id: channel.id,
          sender,
          agent_id: c.var.auth.agentId ?? null,
          mentions: mentions.length ? JSON.stringify(mentions) : null,
          enc: req.enc ? 1 : 0,
          body: req.enc ? req.body : JSON.stringify(body),
          reply_to: req.reply_to ?? null,
          pin: null,
          state: null,
          created_at: now(),
          updated_at: null,
          deleted_at: null,
        });
        if (ask) {
          await trx
            .insertInto("asks")
            .values({ message_id: id, channel_id: channel.id, status: "open", expires_at: ask.expires_at ?? null, answer_id: null, closed_at: null })
            .execute();
        }
      });

      await linkFiles(deps, fileIds, id);
      await recordChanges(deps, channel.id, changed);
      const message = toMessage(await loadMessage(db, channel.id, id));
      if (sender === "agent" && !req.silent) notifyAboutMessage(deps, channel, message);
      return c.json({ message }, 201);
    })
    .get("/messages", auth, async (c) => {
      const { channel, sender: reader, agentId } = c.var.auth;
      const since = c.req.query("since") === undefined ? undefined : Number(c.req.query("since"));
      // an agent's inbox (reads with since) only gets human messages that mention it or nobody, and no notice about itself;
      // the latest page without since is the full history
      const forReader = (row: { sender: MessageSender; mentions: string | null; agent_id: string | null }) => {
        if (reader !== "agent" || since === undefined) return true;
        if (row.sender === "system") return row.agent_id !== agentId;
        return row.sender !== "human" || !row.mentions || JSON.parse(row.mentions).includes(agentId);
      };
      const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 100), 1), 500);
      const sender = c.req.query("sender") as Sender | undefined;
      if (sender && sender !== "agent" && sender !== "human") throw new HTTPException(400, { message: "sender must be agent or human" });

      const query = () => {
        let q = selectLiveMessages(db).where("messages.channel_id", "=", channel.id).limit(limit);
        q = q.where("messages.pin", "is", null);
        // system messages are addressed to agents, so their inbox (sender=human) includes them
        if (sender === "human" && reader === "agent") q = q.where("messages.sender", "in", ["human", "system"]);
        else if (sender) q = q.where("messages.sender", "=", sender);
        return since === undefined
          ? q.orderBy("messages.seq", "desc").execute().then((rows) => rows.reverse())
          : q.where("messages.seq", ">", since).orderBy("messages.seq", "asc").execute();
      };

      const rows =
        since === undefined
          ? await query()
          : await longPoll({
              notifier,
              client: c.var.auth.agentId ?? c.var.auth.userId!,
              channelIds: [channel.id],
              waitSeconds: waitParam(c.req.query("wait")),
              signal: c.req.raw.signal,
              fetch: query,
              isEmpty: (rows) => !rows.some(forReader),
            });

      const messages = rows.filter(forReader).map(toMessage);
      if (reader === "agent" && c.req.query("peek") !== "1") {
        const unseen = messages.filter((m) => m.sender === "human" && m.state === null);
        if (unseen.length) {
          await db.updateTable("messages").set({ state: "seen" }).where("id", "in", unseen.map((m) => m.id)).execute();
          unseen.forEach((m) => (m.state = "seen"));
          await recordChanges(deps, channel.id, unseen.map((m) => m.id));
        }
      }

      const res: MessagesResponse = { messages, cursor: rows.at(-1)?.seq ?? since ?? 0 };
      return c.json(res);
    })
    .put("/messages/:id", agent, async (c) => {
      const { channel } = c.var.auth;
      deps.limits.write(channel.id);
      const target = await loadAgentMessage(channel.id, c.req.param("id"), c.var.auth.agentId!);
      const req = parse(ReplaceMessageRequest, await c.req.json());
      rejectSecretBlocks(JSON.parse(target.enc ? "{}" : target.body).blocks);
      const parsed = req.enc ? undefined : parse(AgentMessageBody, req.body);
      rejectSecretBlocks(parsed?.blocks);
      await linkFiles(deps, await checkFiles(deps, channel.id, parsed), target.id);
      const body = req.enc ? req.body : JSON.stringify(parsed);
      await db.updateTable("messages").set({ enc: req.enc ? 1 : 0, body, updated_at: now() }).where("id", "=", target.id).execute();
      await recordChanges(deps, channel.id, [target.id]);
      return c.json({ message: toMessage(await loadMessage(db, channel.id, target.id)) });
    })
    .patch("/messages/:id", agent, async (c) => {
      const { channel } = c.var.auth;
      deps.limits.write(channel.id);
      const target = await loadAgentMessage(channel.id, c.req.param("id"), c.var.auth.agentId!);
      if (target.enc) throw new HTTPException(400, { message: "Encrypted messages can't be patched, replace them with PUT" });
      rejectSecretBlocks(JSON.parse(target.body).blocks);
      const patch = parse(PatchMessageRequest, await c.req.json());
      const body = JSON.stringify(parse(AgentMessageBody, applyPatch(target.body, patch)));
      rejectSecretBlocks(JSON.parse(body).blocks);
      await linkFiles(deps, await checkFiles(deps, channel.id, JSON.parse(body)), target.id);
      await db.updateTable("messages").set({ body, updated_at: now() }).where("id", "=", target.id).execute();
      await recordChanges(deps, channel.id, [target.id]);
      return c.json({ message: toMessage(await loadMessage(db, channel.id, target.id)) });
    })
    .delete("/messages/:id", agent, async (c) => {
      const { channel } = c.var.auth;
      const target = await loadAgentMessage(channel.id, c.req.param("id"), c.var.auth.agentId!);
      await db.updateTable("messages").set({ deleted_at: now() }).where("id", "=", target.id).execute();
      await deleteFilesOf(deps, target.id);
      await db.updateTable("asks").set({ status: "cancelled", closed_at: now() }).where("message_id", "=", target.id).where("status", "=", "open").execute();
      await db
        .updateTable("secret_requests")
        .set({ status: "cancelled", ciphertext: null, closed_at: now() })
        .where("message_id", "=", target.id)
        .where("status", "in", ["open", "provided"])
        .execute();
      await recordChanges(deps, channel.id, [target.id]);
      return c.body(null, 204);
    })
    .post("/messages/:id/unpin", auth, async (c) => {
      const { channel } = c.var.auth;
      const target = await loadMessage(db, channel.id, c.req.param("id"));
      if (target.pin === null) throw new HTTPException(400, { message: "This message isn't pinned" });
      await db.updateTable("messages").set({ pin: null }).where("id", "=", target.id).execute();
      await recordChanges(deps, channel.id, [target.id]);
      return c.json({ message: toMessage(await loadMessage(db, channel.id, target.id)) });
    })
    .post("/messages/:id/cancel", agent, async (c) => {
      const { channel } = c.var.auth;
      const target = await loadAgentMessage(channel.id, c.req.param("id"), c.var.auth.agentId!);
      const result = await db
        .updateTable("asks")
        .set({ status: "cancelled", closed_at: now() })
        .where("message_id", "=", target.id)
        .where("status", "=", "open")
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) {
        throw new HTTPException(409, { message: target.ask_status ? `This question is already ${toMessage(target).ask?.status}` : "This message isn't a question" });
      }
      await recordChanges(deps, channel.id, [target.id]);
      return c.json({ message: toMessage(await loadMessage(db, channel.id, target.id)) });
    })
    .post("/messages/:id/state", agent, async (c) => {
      const { channel } = c.var.auth;
      const target = await loadMessage(db, channel.id, c.req.param("id"));
      if (target.sender !== "human") throw new HTTPException(400, { message: "Only messages from the human can be acknowledged" });
      const { state, note } = parse(MessageStateRequest, await c.req.json());
      await db.updateTable("messages").set({ state, state_note: note ?? null, state_agent_id: c.var.auth.agentId ?? null }).where("id", "=", target.id).execute();
      await recordChanges(deps, channel.id, [target.id]);
      return c.json({ message: toMessage(await loadMessage(db, channel.id, target.id)) });
    })
    .get("/asks", agent, async (c) => {
      const rows = await selectLiveMessages(db)
        .where("messages.channel_id", "=", c.var.auth.channel.id)
        .where("asks.status", "=", "open")
        .orderBy("messages.seq", "asc")
        .execute();
      return c.json({ messages: rows.map(toMessage).filter((m) => m.ask?.status === "open") });
    })
    .get("/asks/:id", agent, async (c) => {
      const { channel } = c.var.auth;
      const id = c.req.param("id");
      const first = toMessage(await loadMessage(db, channel.id, id));
      if (!first.ask) throw new HTTPException(400, { message: "This message isn't a question" });

      const untilExpiry = first.ask.expires_at === null ? Infinity : Math.max(0, Math.ceil((first.ask.expires_at - Date.now()) / 1000));
      const message = await longPoll({
        notifier,
        client: c.var.auth.agentId!,
        channelIds: [channel.id],
        waitSeconds: Math.min(waitParam(c.req.query("wait")), untilExpiry),
        signal: c.req.raw.signal,
        fetch: async () => toMessage(await loadMessage(db, channel.id, id)),
        isEmpty: (m) => m.ask?.status === "open",
      });

      const answer = message.ask?.answer_id ? toMessage(await loadMessage(db, channel.id, message.ask.answer_id)) : null;
      const res: AskResponse = { message, answer };
      return c.json(res);
    });
}
