import type { Message } from "@rply/schema";
import { preview } from "@rply/schema/helpers";
import type { Deps } from "../context.ts";
import type { ChannelRow } from "../db/schema.ts";

export function notifyAboutMessage({ push }: Deps, channel: ChannelRow, message: Message) {
  if (!push) return;
  const text = preview(message);
  const body = message.ask ? `❓ ${text}` : text;
  push
    .notify(channel.id, { title: channel.name, body: body.length > 180 ? `${body.slice(0, 177)}…` : body, url: `/c/${channel.id}`, tag: channel.id })
    .catch((err) => console.error("push notify failed", err));
}
