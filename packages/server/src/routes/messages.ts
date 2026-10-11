import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  AgentMessageBody,
  HumanMessageBody,
  isInput,
  MessageStateRequest,
  PatchMessageRequest,
  PostMessageRequest,
  ReplaceMessageRequest,
  type AskResponse,
  type MessagesResponse,
  type Sender,
} from "@rply/schema";
import { requireAuth } from "../auth.ts";
import { parse, waitParam, type AppEnv, type Deps } from "../context.ts";
import { loadMessage, recordChanges, selectLiveMessages, toMessage } from "../messages.ts";
import { longPoll } from "../notifier.ts";
import { applyPatch } from "../patch.ts";
import { now, randomId } from "../tokens.ts";

export function messageRoutes(deps: Deps) {
  const { db, notifier } = deps;
  const auth = requireAuth(deps);
  const agent = requireAuth(deps, "agent");

  const loadAgentMessage = async (channelId: string, id: string) => {
    const row = await loadMessage(db, channelId, id);
    if (row.sender !== "agent") throw new HTTPException(400, { message: "Only agent messages can be changed" });
    return row;
  };

  return new Hono<AppEnv>()
    .post("/messages", auth, async (c) => {
      const { channel, sender } = c.var.auth;
      const req = parse(PostMessageRequest, await c.req.json());
      const body = req.enc ? undefined : parse(sender === "agent" ? AgentMessageBody : HumanMessageBody, req.body);
      if (sender === "human" && req.ask) throw new HTTPException(400, { message: "Only the agent can ask" });

      const id = randomId();
      const ask = sender === "agent" && (req.ask ?? (body && "blocks" in body && body.blocks?.some(isInput) ? {} : undefined));
      const changed = [id];

      await db.transaction().execute(async (trx) => {
        if (req.reply_to) {
          const target = await loadMessage(trx, channel.id, req.reply_to);
          if (sender === "human" && target.ask_status) {
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

        await trx
          .insertInto("messages")
          .values({
            id,
            channel_id: channel.id,
            sender,
            enc: req.enc ? 1 : 0,
            body: req.enc ? req.body : JSON.stringify(body),
            reply_to: req.reply_to ?? null,
            pin: null,
            state: null,
            created_at: now(),
            updated_at: null,
            deleted_at: null,
          })
          .execute();
        if (ask) {
          await trx
            .insertInto("asks")
            .values({ message_id: id, channel_id: channel.id, status: "open", expires_at: ask.expires_at ?? null, answer_id: null, closed_at: null })
            .execute();
        }
      });

      await recordChanges(deps, channel.id, changed);
      return c.json({ message: toMessage(await loadMessage(db, channel.id, id)) }, 201);
    })
    .get("/messages", auth, async (c) => {
      const { channel, sender: reader } = c.var.auth;
      const since = c.req.query("since") === undefined ? undefined : Number(c.req.query("since"));
      const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 100), 1), 500);
      const sender = c.req.query("sender") as Sender | undefined;
      if (sender && sender !== "agent" && sender !== "human") throw new HTTPException(400, { message: "sender must be agent or human" });

      const query = () => {
        let q = selectLiveMessages(db).where("messages.channel_id", "=", channel.id).limit(limit);
        q = q.where("messages.pin", "is", null);
        if (sender) q = q.where("messages.sender", "=", sender);
        return since === undefined
          ? q.orderBy("messages.seq", "desc").execute().then((rows) => rows.reverse())
          : q.where("messages.seq", ">", since).orderBy("messages.seq", "asc").execute();
      };

      const rows =
        since === undefined
          ? await query()
          : await longPoll({
              notifier,
              channelIds: [channel.id],
              waitSeconds: waitParam(c.req.query("wait")),
              signal: c.req.raw.signal,
              fetch: query,
              isEmpty: (rows) => rows.length === 0,
            });

      const messages = rows.map(toMessage);
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
      const target = await loadAgentMessage(channel.id, c.req.param("id"));
      const req = parse(ReplaceMessageRequest, await c.req.json());
      const body = req.enc ? req.body : JSON.stringify(parse(AgentMessageBody, req.body));
      await db.updateTable("messages").set({ enc: req.enc ? 1 : 0, body, updated_at: now() }).where("id", "=", target.id).execute();
      await recordChanges(deps, channel.id, [target.id]);
      return c.json({ message: toMessage(await loadMessage(db, channel.id, target.id)) });
    })
    .patch("/messages/:id", agent, async (c) => {
      const { channel } = c.var.auth;
      const target = await loadAgentMessage(channel.id, c.req.param("id"));
      if (target.enc) throw new HTTPException(400, { message: "Encrypted messages can't be patched, replace them with PUT" });
      const patch = parse(PatchMessageRequest, await c.req.json());
      const body = JSON.stringify(parse(AgentMessageBody, applyPatch(target.body, patch)));
      await db.updateTable("messages").set({ body, updated_at: now() }).where("id", "=", target.id).execute();
      await recordChanges(deps, channel.id, [target.id]);
      return c.json({ message: toMessage(await loadMessage(db, channel.id, target.id)) });
    })
    .delete("/messages/:id", agent, async (c) => {
      const { channel } = c.var.auth;
      const target = await loadAgentMessage(channel.id, c.req.param("id"));
      await db.updateTable("messages").set({ deleted_at: now() }).where("id", "=", target.id).execute();
      await db.updateTable("asks").set({ status: "cancelled", closed_at: now() }).where("message_id", "=", target.id).where("status", "=", "open").execute();
      await recordChanges(deps, channel.id, [target.id]);
      return c.body(null, 204);
    })
    .post("/messages/:id/cancel", agent, async (c) => {
      const { channel } = c.var.auth;
      const target = await loadAgentMessage(channel.id, c.req.param("id"));
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
      const { state } = parse(MessageStateRequest, await c.req.json());
      await db.updateTable("messages").set({ state }).where("id", "=", target.id).execute();
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
