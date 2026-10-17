import type { Generated, Selectable } from "kysely";
import type { AskStatus, ChannelRole, MessageState, Sender } from "@rply/schema";

export interface Database {
  channels: ChannelsTable;
  agent_tokens: AgentTokensTable;
  pairing_codes: PairingCodesTable;
  messages: MessagesTable;
  asks: AsksTable;
  changes: ChangesTable;
  secret_requests: SecretRequestsTable;
  files: FilesTable;
  settings: SettingsTable;
  push_subscriptions: PushSubscriptionsTable;
  user: UserTable;
  channel_members: ChannelMembersTable;
  app_storage: AppStorageTable;
}

interface UserTable {
  id: string;
  name: string;
  email: string;
}

interface ChannelMembersTable {
  channel_id: string;
  user_id: string;
  role: ChannelRole;
  read_seq: Generated<number>;
  created_at: number;
}

interface AppStorageTable {
  user_id: string;
  channel_id: string;
  app_key: string;
  value: string;
  updated_at: number;
}

interface ChannelsTable {
  id: string;
  name: string;
  e2e: number;
  created_at: number;
}

interface AgentTokensTable {
  id: string;
  channel_id: string;
  token_hash: string;
  label: string | null;
  public_key: string | null;
  created_at: number;
  last_seen_at: number | null;
  revoked_at: number | null;
}

interface PairingCodesTable {
  code_hash: string;
  channel_id: string;
  role: Sender;
  expires_at: number;
  used_at: number | null;
}

interface MessagesTable {
  seq: Generated<number>;
  id: string;
  channel_id: string;
  sender: Sender;
  agent_id: string | null;
  enc: number;
  body: string;
  reply_to: string | null;
  pin: string | null;
  state: MessageState | null;
  state_note: string | null;
  state_agent_id: string | null;
  created_at: number;
  updated_at: number | null;
  deleted_at: number | null;
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

interface SecretRequestsTable {
  id: string;
  channel_id: string;
  message_id: string;
  name: string;
  target: string;
  mode: "env" | "file";
  status: "open" | "provided" | "delivered" | "declined" | "cancelled";
  ciphertext: string | null;
  public_key: string;
  expires_at: number | null;
  created_at: number;
  closed_at: number | null;
}

interface FilesTable {
  id: string;
  channel_id: string;
  message_id: string | null;
  uploader: Sender;
  name: string;
  mime: string;
  size: number;
  created_at: number;
  deleted_at: number | null;
}

interface SettingsTable {
  key: string;
  value: string;
}

interface PushSubscriptionsTable {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
  created_at: number;
}

export type ChannelRow = Selectable<ChannelsTable>;
export type MessageRow = Selectable<MessagesTable>;
export type AskRow = Selectable<AsksTable>;
