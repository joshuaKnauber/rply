import type { Channel, ChannelEntry, ChannelRole } from "@rply/schema";
import type { ChannelRow } from "./db/schema.ts";

export const toChannel = (row: ChannelRow): Channel => ({
  id: row.id,
  name: row.name,
  e2e: row.e2e === 1,
  created_at: Number(row.created_at),
});

export const toChannelEntry = (row: ChannelRow & { role: ChannelRole; read_seq: number }): ChannelEntry => ({
  ...toChannel(row),
  role: row.role,
  read_seq: Number(row.read_seq),
});
