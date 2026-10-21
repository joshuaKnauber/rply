import { z } from "zod";
import { BIRD_COLORS, BIRD_CRESTS, BIRD_EYES, BIRD_HATS, COMMAND_NAME, isInput } from "./helpers.ts";

const elementId = z.string().min(1).max(64);
const Json = z.json();

const ChoiceOption = z.object({
  label: z.string().min(1),
  value: z.string().optional(),
  description: z.string().optional(),
  danger: z.boolean().optional(),
});

const blockSchemas = {
  markdown: z.object({ type: z.literal("markdown"), id: elementId.optional(), text: z.string() }),
  heading: z.object({ type: z.literal("heading"), id: elementId.optional(), text: z.string() }),
  code: z.object({ type: z.literal("code"), id: elementId.optional(), code: z.string(), language: z.string().optional() }),
  link: z.object({ type: z.literal("link"), id: elementId.optional(), url: z.url(), label: z.string().optional() }),
  progress: z.object({
    type: z.literal("progress"),
    id: elementId.optional(),
    value: z.number(),
    max: z.number().positive().optional(),
    label: z.string().optional(),
  }),
  keyvalue: z.object({
    type: z.literal("keyvalue"),
    id: elementId.optional(),
    items: z.array(z.object({ key: z.string(), value: z.string() })),
  }),
  table: z.object({
    type: z.literal("table"),
    id: elementId.optional(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number()]))),
  }),
  html: z
    .object({
      type: z.literal("html"),
      id: elementId.optional(),
      html: z.string(),
      height: z.number().int().positive().max(2000).optional(),
      label: z.string().optional(),
      question: z.boolean().optional(),
    })
    .refine((b) => !b.question || b.id !== undefined, "An html question needs an id"),
  choice: z.object({
    type: z.literal("choice"),
    id: elementId,
    label: z.string().optional(),
    options: z.array(ChoiceOption).min(1),
    multi: z.boolean().optional(),
    other: z.boolean().optional(),
    required: z.boolean().optional(),
    default: z.union([z.string(), z.array(z.string())]).optional(),
  }),
  text_input: z.object({
    type: z.literal("text_input"),
    id: elementId,
    label: z.string().optional(),
    placeholder: z.string().optional(),
    multiline: z.boolean().optional(),
    required: z.boolean().optional(),
    default: z.string().optional(),
  }),
  number_input: z.object({
    type: z.literal("number_input"),
    id: elementId,
    label: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    required: z.boolean().optional(),
    default: z.number().optional(),
  }),
  toggle: z.object({
    type: z.literal("toggle"),
    id: elementId,
    label: z.string(),
    default: z.boolean().optional(),
  }),
  confirm: z.object({
    type: z.literal("confirm"),
    id: elementId,
    label: z.string(),
    description: z.string().optional(),
    danger: z.boolean().optional(),
  }),
  image: z.object({
    type: z.literal("image"),
    id: elementId.optional(),
    file_id: z.string().min(1).max(64),
    name: z.string().optional(),
    alt: z.string().optional(),
  }),
  file: z.object({
    type: z.literal("file"),
    id: elementId.optional(),
    file_id: z.string().min(1).max(64),
    name: z.string(),
    mime: z.string().optional(),
    size: z.number().int().nonnegative().optional(),
  }),
  secret: z.object({
    type: z.literal("secret"),
    id: elementId,
    name: z.string(),
    target: z.string(),
    mode: z.enum(["env", "file"]),
    reason: z.string().optional(),
    status: z.enum(["open", "provided", "delivered", "declined", "cancelled"]),
    expires_at: z.number().nullable(),
    public_key: z.string(),
  }),
};

type BlockSchemas = typeof blockSchemas;
export type BlockType = keyof BlockSchemas;
export type KnownBlock = { [K in BlockType]: z.infer<BlockSchemas[K]> }[BlockType];
export type BlockOf<T extends BlockType> = z.infer<BlockSchemas[T]>;
export type UnknownBlock = { type: string; id?: string; [key: string]: unknown };
export type Block = KnownBlock | UnknownBlock;

export const isKnownBlock = (block: Block): block is KnownBlock => block.type in blockSchemas;

export const Block = z
  .looseObject({ type: z.string().min(1), id: elementId.optional() })
  .superRefine((block, ctx) => {
    const schema = blockSchemas[block.type as BlockType];
    if (!schema) return;
    const result = schema.safeParse(block);
    if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ ...issue, input: undefined } as never);
  }) as unknown as z.ZodType<Block>;

const uniqueInputIds = (blocks: Block[] | undefined) => {
  const ids = (blocks ?? []).filter(isInput).map((b) => b.id);
  return new Set(ids).size === ids.length;
};

export const AgentMessageBody = z
  .object({
    title: z.string().max(200).optional(),
    text: z.string().optional(),
    blocks: z.array(Block).optional(),
  })
  .refine((b) => b.text !== undefined || (b.blocks?.length ?? 0) > 0, "A message needs text or blocks")
  .refine((b) => uniqueInputIds(b.blocks), "Input ids must be unique within a message");
export type AgentMessageBody = z.infer<typeof AgentMessageBody>;

export const PinnedBody = z.object({
  title: z.string().max(200).optional(),
  text: z.string().optional(),
  blocks: z.array(Block).optional(),
  view: z.literal("app").optional(),
});
export type PinnedBody = z.infer<typeof PinnedBody>;

export const PIN_KEY = /^[a-z0-9_-]{1,32}$/;

export const Answers = z.record(elementId, Json);
export type Answers = z.infer<typeof Answers>;

export const MessageEvent = z.object({ block_id: elementId.nullable(), value: Json, label: z.string().max(200).optional() });
export type MessageEvent = z.infer<typeof MessageEvent>;

export const FileRef = z.object({
  file_id: z.string().min(1).max(64),
  name: z.string().max(255),
  mime: z.string().max(255),
  size: z.number().int().nonnegative(),
});
export type FileRef = z.infer<typeof FileRef>;

export const HumanMessageBody = z
  .object({
    text: z.string().optional(),
    answers: Answers.optional(),
    event: MessageEvent.optional(),
    attachments: z.array(FileRef).max(20).optional(),
  })
  .refine(
    (b) =>
      b.text !== undefined ||
      b.event !== undefined ||
      (b.attachments?.length ?? 0) > 0 ||
      (b.answers && Object.keys(b.answers).length > 0),
    "A message needs text, answers, attachments or an event",
  );
export type Call = { name: string; block_id: string | null; args: z.infer<typeof Json>; result?: z.infer<typeof Json>; error?: string };
export type HumanMessageBody = z.infer<typeof HumanMessageBody> & { call?: Call };

const Plain = z.object({ enc: z.literal(false).default(false), body: z.unknown() });
const Encrypted = z.object({ enc: z.literal(true), body: z.string().min(1) });
const Payload = z.union([Encrypted, Plain]);

export const BlockPatch = z.looseObject({ id: elementId });

export const CreateChannelRequest = z.object({
  name: z.string().min(1).max(100),
  label: z.string().max(100).optional(),
});
export const RenameAgentRequest = z.object({ label: z.string().trim().min(1).max(100) });
const part = (options: readonly unknown[]) => z.number().int().min(0).max(options.length - 1);
export const BirdLook = z.object({
  color: part(BIRD_COLORS),
  crest: part(BIRD_CRESTS),
  eyes: part(BIRD_EYES),
  hat: part(BIRD_HATS),
  accent: part(BIRD_COLORS),
  cheeks: z.boolean(),
  belly: z.boolean(),
});
export type BirdLook = z.infer<typeof BirdLook>;
export const UpdateAgentRequest = z
  .object({ label: z.string().trim().min(1).max(100).optional(), avatar: BirdLook.nullable().optional() })
  .refine((r) => r.label !== undefined || r.avatar !== undefined, "Send a label or an avatar");
export const CreatePairingRequest = z.object({ role: z.enum(["agent", "human"]).default("human") });
export const JoinChannelRequest = z.object({ code: z.string().min(1).max(32), label: z.string().max(100).optional() });
export const ClaimChannelRequest = z.object({ code: z.string().min(1).max(32) });
export const ReadRequest = z.object({ seq: z.number().int().min(0) });
export const StorageRequest = z.object({ value: Json });
export const PostMessageRequest = z.intersection(
  Payload,
  z.object({
    reply_to: z.string().optional(),
    ask: z.object({ expires_at: z.number().int().optional() }).optional(),
    silent: z.boolean().optional(),
    mentions: z.array(z.string().max(64)).max(20).optional(),
  }),
);
export const ReplaceMessageRequest = Payload;
export const PutPinRequest = Payload;
export const PatchMessageRequest = z.object({
  title: z.string().max(200).optional(),
  text: z.string().optional(),
  blocks: z.array(Block).optional(),
  block_patches: z.array(BlockPatch).optional(),
});
export const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const PublicKeyRequest = z.object({ public_key: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Expected a base64url X25519 public key") });
export const CreateSecretRequest = z
  .object({
    name: z.string().min(1).max(100),
    target: z.string().min(1).max(500),
    mode: z.enum(["env", "file"]),
    reason: z.string().max(500).optional(),
    expires_at: z.number().int().optional(),
  })
  .refine((r) => r.mode !== "env" || ENV_NAME.test(r.name), "Environment variable names may only use letters, digits and _");
export const FulfilSecretRequest = z.object({ ciphertext: z.string().min(1).max(200_000) });

const commandName = z.string().regex(COMMAND_NAME, "Command names are 1-64 letters, digits, - or _");
export const CallRequest = z.object({
  message_id: z.string().min(1).max(64),
  block_id: elementId.nullable().default(null),
  name: commandName,
  args: Json.default(null),
  agent: z.boolean().default(false),
  wait: z.number().min(0).max(60).optional(),
});
export const CallResultRequest = z.union([z.object({ error: z.string().max(2000) }), z.object({ result: Json })]);

export const MessageStateRequest = z.object({ state: z.enum(["seen", "working", "done"]), note: z.string().max(200).optional() });
export const SyncRequest = z.object({
  cursor: z.string().optional(),
  wait: z.number().min(0).max(60).optional(),
  viewing: z.string().max(64).nullable().optional(),
  push_endpoint: z.string().max(2000).nullable().optional(),
});

export const PushSubscriptionRequest = z.object({
  subscription: z.object({
    endpoint: z.url().max(2000),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  }),
});
export const PushUnsubscribeRequest = z.object({ endpoint: z.string().max(2000) });
export const FeedbackRequest = z.object({
  text: z.string().trim().min(1).max(4000),
  from: z.enum(["agent", "human"]),
  version: z.string().max(50).optional(),
  contact: z.string().trim().max(200).optional(),
});

export type Sender = "agent" | "human";
// system messages are written by the server, e.g. "Deploy bot joined the channel."
export type MessageSender = Sender | "system";
export type AskStatus = "open" | "answered" | "expired" | "cancelled";
export type MessageState = "seen" | "working" | "done";

export type Channel = { id: string; name: string; e2e: boolean; created_at: number };

export type Ask = { status: AskStatus; expires_at: number | null; answer_id: string | null };

export type Message = {
  seq: number;
  id: string;
  channel_id: string;
  sender: MessageSender;
  agent: { id: string; label: string | null } | null;
  mentions: string[];
  reply_to: string | null;
  pin: string | null;
  ask: Ask | null;
  state: MessageState | null;
  state_note: string | null;
  state_agent_id: string | null;
  created_at: number;
  updated_at: number | null;
  deleted_at: number | null;
} & ({ enc: false; body: AgentMessageBody | HumanMessageBody } | { enc: true; body: string });

export type Pairing = { code: string; expires_at: number };

export type Participant = { id: string; label: string | null; created_at: number; last_seen_at: number | null; current: boolean };

export type Registration = "open" | "invite" | "closed";

export type OAuthProvider = "github" | "google";

export type ServerInfo = {
  needs_setup: boolean;
  registration: Registration;
  email: boolean;
  passkeys: boolean;
  oauth: OAuthProvider[];
  files: { enabled: boolean; max_size: number };
  push: { public_key: string } | null;
};

export type FileInfo = FileRef & { created_at: number };


export type ChannelRole = "owner" | "member";
export type ChannelEntry = Channel & { role: ChannelRole; read_seq: number };
export type ChannelsResponse = { channels: ChannelEntry[] };
export type CreateChannelResponse = { channel: Channel; agent_token: string; claim: Pairing };
export type ClaimChannelResponse = { channel: ChannelEntry };
export type StorageResponse = { value: unknown };
export type StorageListResponse = { values: Record<string, unknown> };
export type Usage = { used: number; limit: number };
export type AccountUsage = { channels: Usage | null; messages_per_day: Usage | null; storage: Usage | null; message_retention_days: number | null };
export type AccountExport = {
  exported_at: number;
  user: { id: string; email: string; name: string };
  channels: (Channel & {
    role: ChannelRole;
    agents: { label: string | null; created_at: number; last_seen_at: number | null; revoked_at: number | null }[];
    messages: Message[];
    files: { id: string; name: string; mime: string; size: number; message_id: string | null; created_at: number }[];
    app_storage: Record<string, unknown>;
  })[];
};
export type AgentParticipant = Participant & { avatar: BirdLook | null; serve: { commands: string[]; wakes: boolean } | null };
export type AgentsResponse = { agents: AgentParticipant[] };
export type CreateOwnedChannelResponse = { channel: ChannelEntry; agent_code: Pairing };
export type JoinChannelResponse = { channel: Channel; agent_token: string };
export type MessagesResponse = { messages: Message[]; cursor: number };
export type AskResponse = { message: Message; answer: Message | null };
export type SecretStatus = "open" | "provided" | "delivered" | "declined" | "cancelled" | "expired";
export type SecretResponse = { id: string; name: string; target: string; mode: "env" | "file"; status: SecretStatus; ciphertext: string | null };
export type PendingCall = { id: string; name: string; args: unknown; block_id: string | null; message_id: string };
export type CallsResponse = { calls: PendingCall[] };
export type CallResponse =
  | { id: string; status: "done"; result: unknown }
  | { id: string; status: "error"; error: string }
  | { id: string; status: "pending" };
export type LinkPreview = { url: string; title: string | null; description: string | null; image: string | null; icon: string | null; icon_dark: string | null; site: string | null };
export type SyncResponse = { cursor: string; messages: Message[]; channels: string[] };
export * from "./helpers.ts";
