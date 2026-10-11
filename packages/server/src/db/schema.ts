import type { Generated, Selectable } from "kysely";
import type { AskStatus, MessageState, Sender } from "@rply/schema";

export interface Database {
  channels: ChannelsTable;
  human_tokens: HumanTokensTable;
  pairing_codes: PairingCodesTable;
  api_keys: ApiKeysTable;
  messages: MessagesTable;
  asks: AsksTable;
  changes: ChangesTable;
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
  pin: string | null;
  state: MessageState | null;
  created_at: number;
  updated_at: number | null;
}

interface AsksTable {
  message_id: string;
  channel_id: string;
  status: AskStatus;
  expires_at: number | null;
  answer_id: string | null;
  closed_at: number | null;
}

interface ChangesTable {
  seq: Generated<number>;
  channel_id: string;
  message_id: string;
  created_at: number;
}

export type ChannelRow = Selectable<ChannelsTable>;
export type MessageRow = Selectable<MessagesTable>;
export type AskRow = Selectable<AsksTable>;
