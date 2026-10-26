import type { Message } from "@rply/schema";
import { preview } from "@rply/schema/helpers";
import type { Deps } from "../context.ts";
import type { ChannelRow } from "../db/schema.ts";

export function notifyAboutMessage({ db, push }: Deps, channel: ChannelRow, message: Message) {
  if (!push) return;
  const text = preview(message);
  const body = message.ask ? `❓ ${text}` : text;
  title(db, channel, message)
    .then((title) => push.notify(channel.id, { title, body: body.length > 180 ? `${body.slice(0, 177)}…` : body, url: `/c/${channel.id}`, tag: channel.id }))
    .catch((err) => console.error("push notify failed", { channel: channel.id, error: err }));
}

async function title(db: Deps["db"], channel: ChannelRow, message: Message) {
  if (!message.agent?.label) return channel.name;
  const { count } = await db
    .selectFrom("agent_tokens")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("channel_id", "=", channel.id)
    .where("revoked_at", "is", null)
    .executeTakeFirstOrThrow();
  return Number(count) > 1 ? `${channel.name} · ${message.agent.label}` : channel.name;
}
