import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { AgentMessageBody, HumanMessageBody, PostMessageRequest, type MessagesResponse, type Sender } from "@rply/schema";
import { requireAuth } from "../auth.ts";
import { parse, waitParam, type AppEnv, type Deps } from "../context.ts";
import { longPoll } from "../notifier.ts";
import { toMessage } from "../serialize.ts";
import { now, randomId } from "../tokens.ts";

export function messageRoutes(deps: Deps) {
  const { db, notifier } = deps;

  const auth = requireAuth(deps);

  return new Hono<AppEnv>()
    .post("/messages", auth, async (c) => {
      const { channel, sender } = c.var.auth;
      const req = parse(PostMessageRequest, await c.req.json());
      const body = req.enc ? req.body : JSON.stringify(parse(sender === "agent" ? AgentMessageBody : HumanMessageBody, req.body));

      if (req.reply_to) {
        const target = await db
          .selectFrom("messages")
          .select("sender")
          .where("id", "=", req.reply_to)
          .where("channel_id", "=", channel.id)
          .executeTakeFirst();
        if (!target) throw new HTTPException(400, { message: "reply_to: message not found" });
      }

      const row = await db
        .insertInto("messages")
        .values({
          id: randomId(),
          channel_id: channel.id,
          sender,
          enc: req.enc ? 1 : 0,
          body,
          reply_to: req.reply_to ?? null,
          created_at: now(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      notifier.notify(channel.id);
      return c.json({ message: toMessage(row) }, 201);
    })
    .get("/messages", auth, async (c) => {
      const { channel } = c.var.auth;
      const since = c.req.query("since") === undefined ? undefined : Number(c.req.query("since"));
      const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 100), 1), 500);
      const sender = c.req.query("sender") as Sender | undefined;
      if (sender && sender !== "agent" && sender !== "human") throw new HTTPException(400, { message: "sender must be agent or human" });

      const query = () => {
        let q = db.selectFrom("messages").selectAll().where("channel_id", "=", channel.id).limit(limit);
        if (sender) q = q.where("sender", "=", sender);
        return since === undefined
          ? q.orderBy("seq", "desc").execute().then((rows) => rows.reverse())
          : q.where("seq", ">", since).orderBy("seq", "asc").execute();
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

      const res: MessagesResponse = { messages: rows.map(toMessage), cursor: rows.at(-1)?.seq ?? since ?? 0 };
      return c.json(res);
    })
    .get("/messages/:id/replies", auth, async (c) => {
      const { channel } = c.var.auth;
      const id = c.req.param("id");
      const exists = await db.selectFrom("messages").select("id").where("id", "=", id).where("channel_id", "=", channel.id).executeTakeFirst();
      if (!exists) throw new HTTPException(404, { message: "Message not found" });

      const rows = await longPoll({
        notifier,
        channelIds: [channel.id],
        waitSeconds: waitParam(c.req.query("wait")),
        signal: c.req.raw.signal,
        fetch: () =>
          db
            .selectFrom("messages")
            .selectAll()
            .where("channel_id", "=", channel.id)
            .where("reply_to", "=", id)
            .where("sender", "=", "human")
            .orderBy("seq", "asc")
            .execute(),
        isEmpty: (rows) => rows.length === 0,
      });
      return c.json({ replies: rows.map(toMessage) });
    });
}
