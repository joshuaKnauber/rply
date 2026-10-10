import type { Generated, Selectable } from "kysely";
import type { Sender } from "@rply/schema";

export interface Database {
  channels: ChannelsTable;
  human_tokens: HumanTokensTable;
  pairing_codes: PairingCodesTable;
  api_keys: ApiKeysTable;
  messages: MessagesTable;
  status_pages: StatusPagesTable;
}

interface ChannelsTable {
  id: string;
  name: string;
  agent_token_hash: string;
  agent_public_key: string | null;
  e2e: number;
  owner_id: string | null;
  created_at: number;
}

interface HumanTokensTable {
  id: string;
  channel_id: string;
  token_hash: string;
  label: string | null;
  created_at: number;
  last_seen_at: number | null;
  revoked_at: number | null;
}

interface PairingCodesTable {
  code_hash: string;
  channel_id: string;
  expires_at: number;
  used_at: number | null;
}

interface ApiKeysTable {
  id: string;
  token_hash: string;
  owner_id: string | null;
  label: string | null;
  created_at: number;
}

interface MessagesTable {
  seq: Generated<number>;
  id: string;
  channel_id: string;
  sender: Sender;
  enc: number;
  body: string;
  reply_to: string | null;
  created_at: number;
}

interface StatusPagesTable {
  channel_id: string;
  enc: number;
  body: string;
  updated_at: number;
}

export type ChannelRow = Selectable<ChannelsTable>;
export type MessageRow = Selectable<MessagesTable>;
export type StatusRow = Selectable<StatusPagesTable>;
