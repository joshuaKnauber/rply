import { HTTPException } from "hono/http-exception";
import type { Message } from "@rply/schema";
import type { Deps } from "./context.ts";
import type { DB } from "./db/index.ts";
import { now } from "./tokens.ts";

export const selectMessages = (db: DB) =>
  db
    .selectFrom("messages")
    .leftJoin("asks", "asks.message_id", "messages.id")
    .selectAll("messages")
    .select(["asks.status as ask_status", "asks.expires_at as ask_expires_at", "asks.answer_id as ask_answer_id"]);

type JoinedRow = Awaited<ReturnType<ReturnType<typeof selectMessages>["execute"]>>[number];

export function toMessage(row: JoinedRow): Message {
  const expired = row.ask_status === "open" && row.ask_expires_at !== null && Number(row.ask_expires_at) <= Date.now();
  return {
    seq: row.seq,
    id: row.id,
    channel_id: row.channel_id,
    sender: row.sender,
    reply_to: row.reply_to,
    pin: row.pin,
    state: row.state,
    created_at: Number(row.created_at),
    updated_at: row.updated_at === null ? null : Number(row.updated_at),
    deleted_at: row.deleted_at === null ? null : Number(row.deleted_at),
    ask: row.ask_status
      ? {
          status: expired ? "expired" : row.ask_status,
          expires_at: row.ask_expires_at === null ? null : Number(row.ask_expires_at),
          answer_id: row.ask_answer_id,
        }
      : null,
    ...(row.deleted_at !== null
      ? { enc: false as const, body: {} }
      : row.enc
        ? { enc: true as const, body: row.body }
        : { enc: false as const, body: JSON.parse(row.body) }),
  };
}

export const selectLiveMessages = (db: DB) => selectMessages(db).where("messages.deleted_at", "is", null);

export async function loadMessage(db: DB, channelId: string, id: string) {
  const row = await selectLiveMessages(db).where("messages.id", "=", id).where("messages.channel_id", "=", channelId).executeTakeFirst();
  if (!row) throw new HTTPException(404, { message: "Message not found" });
  return row;
}

export async function recordChanges({ db, notifier }: Deps, channelId: string, messageIds: string[]) {
  if (messageIds.length === 0) return;
  const created_at = now();
  await db
    .insertInto("changes")
    .values(messageIds.map((message_id) => ({ channel_id: channelId, message_id, created_at })))
    .execute();
  notifier.notify(channelId);
}
