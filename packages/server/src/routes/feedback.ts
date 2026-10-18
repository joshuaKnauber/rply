import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { FeedbackRequest } from "@rply/schema";
import { parse, type AppEnv, type Deps } from "../context.ts";
import { clientIp } from "../limits.ts";
import { insertMessage, loadMessage, recordChanges, toMessage } from "../messages.ts";
import { notifyAboutMessage } from "../push/notify.ts";
import { now, randomId } from "../tokens.ts";

// Only the server that collects feedback (rply.sh) sets RPLY_FEEDBACK_CHANNEL; CLIs and web apps everywhere post to it.
export function feedbackRoutes(deps: Deps) {
  return new Hono<AppEnv>().post("/feedback", async (c) => {
    const channel = deps.feedbackChannel && (await deps.db.selectFrom("channels").selectAll().where("id", "=", deps.feedbackChannel).executeTakeFirst());
    if (!channel) throw new HTTPException(404, { message: "This server doesn't collect feedback" });
    const req = parse(FeedbackRequest, await c.req.json());
    deps.limits.feedback(clientIp(c));

    const details = [
      ...(req.version ? [{ key: "Version", value: req.version }] : []),
      ...(req.contact ? [{ key: "Contact", value: req.contact }] : []),
    ];
    const body = {
      title: req.from === "agent" ? "Feedback from an agent" : "Feedback from a user",
      text: req.text,
      ...(details.length && { blocks: [{ type: "keyvalue", items: details }] }),
    };
    const id = randomId();
    await insertMessage(deps.db, { id, channel_id: channel.id, sender: "agent", agent_id: null, enc: 0, body: JSON.stringify(body), reply_to: null, pin: null, state: null, created_at: now(), updated_at: null, deleted_at: null });
    await recordChanges(deps, channel.id, [id]);
    notifyAboutMessage(deps, channel, toMessage(await loadMessage(deps.db, channel.id, id)));
    return c.json({ ok: true });
  });
}
