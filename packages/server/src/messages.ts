import { HTTPException } from "hono/http-exception";
import type { Message } from "@rply/schema";
import type { Deps } from "./context.ts";
import type { Insertable } from "kysely";
import { inSeqOrder } from "./db/dialect.ts";
import type { DB } from "./db/index.ts";
import type { Database } from "./db/schema.ts";
import { now } from "./tokens.ts";

export const selectMessages = (db: DB) =>
  db
    .selectFrom("messages")
    .leftJoin("asks", "asks.message_id", "messages.id")
    .leftJoin("agent_tokens", "agent_tokens.id", "messages.agent_id")
    .selectAll("messages")
    .select(["asks.status as ask_status", "asks.expires_at as ask_expires_at", "asks.answer_id as ask_answer_id", "agent_tokens.label as agent_label"]);

type JoinedRow = Awaited<ReturnType<ReturnType<typeof selectMessages>["execute"]>>[number];

export function toMessage(row: JoinedRow): Message {
  const expired = row.ask_status === "open" && row.ask_expires_at !== null && Number(row.ask_expires_at) <= Date.now();
  return {
    seq: row.seq,
    id: row.id,
    channel_id: row.channel_id,
    sender: row.sender,
    agent: row.agent_id ? { id: row.agent_id, label: row.agent_label } : null,
    mentions: row.mentions ? JSON.parse(row.mentions) : [],
    reply_to: row.reply_to,
    pin: row.pin,
    state: row.state,
    state_note: row.state_note,
    state_agent_id: row.state_agent_id,
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

export const insertMessage = (db: DB, values: Insertable<Database["messages"]>) =>
  inSeqOrder(db, async (trx) => {
    await trx.insertInto("messages").values(values).execute();
  });

export async function recordChanges({ db, notifier }: Deps, channelId: string, messageIds: string[]) {
  if (messageIds.length === 0) return;
  const created_at = now();
  await inSeqOrder(db, async (trx) => {
    await trx
      .insertInto("changes")
      .values(messageIds.map((message_id) => ({ channel_id: channelId, message_id, created_at })))
      .execute();
  });
  notifier.notify(channelId);
}

// RPLY_MESSAGE_RETENTION: unpinned messages (and their files) older than that are deleted for good
export async function sweepOldMessages(deps: Deps) {
  const deleted = { messages: 0, files: 0 };
  const retention = deps.limits.quotas.messageRetentionMs;
  if (retention === null) return deleted;
  const cutoff = now() - retention;
  while (true) {
    const rows = await deps.db.selectFrom("messages").select("id").where("pin", "is", null).where("created_at", "<", cutoff).limit(500).execute();
    if (rows.length === 0) return deleted;
    const ids = rows.map((r) => r.id);
    const files = await deps.db.selectFrom("files").select("id").where("message_id", "in", ids).where("deleted_at", "is", null).execute();
    await Promise.all(files.map((f) => deps.files?.store.remove(f.id)));
    await deps.db.deleteFrom("files").where("message_id", "in", ids).execute();
    await deps.db.deleteFrom("changes").where("message_id", "in", ids).execute();
    await deps.db.deleteFrom("messages").where("id", "in", ids).execute();
    deleted.messages += ids.length;
    deleted.files += files.length;
  }
}
