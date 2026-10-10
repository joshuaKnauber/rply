import type { Channel, Message, Status } from "@rply/schema";
import type { ChannelRow, MessageRow, StatusRow } from "./db/schema.ts";

export const toChannel = (row: ChannelRow): Channel => ({
  id: row.id,
  name: row.name,
  e2e: row.e2e === 1,
  created_at: Number(row.created_at),
});

export const toMessage = (row: MessageRow): Message => ({
  seq: row.seq,
  id: row.id,
  channel_id: row.channel_id,
  sender: row.sender,
  reply_to: row.reply_to,
  created_at: Number(row.created_at),
  ...payload(row),
});

export const toStatus = (row: StatusRow): Status => ({
  channel_id: row.channel_id,
  updated_at: Number(row.updated_at),
  ...payload(row),
});

const payload = (row: { enc: number; body: string }) =>
  row.enc ? { enc: true as const, body: row.body } : { enc: false as const, body: JSON.parse(row.body) };
