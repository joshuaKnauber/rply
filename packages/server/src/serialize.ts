import type { Channel } from "@rply/schema";
import type { ChannelRow } from "./db/schema.ts";

export const toChannel = (row: ChannelRow): Channel => ({
  id: row.id,
  name: row.name,
  e2e: row.e2e === 1,
  created_at: Number(row.created_at),
});
