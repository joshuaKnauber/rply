import { z } from "zod";
import { isInput } from "./helpers.ts";

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
  html: z.object({
    type: z.literal("html"),
    id: elementId.optional(),
    html: z.string(),
    height: z.number().int().positive().max(2000).optional(),
    label: z.string().optional(),
  }),
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
});
export type PinnedBody = z.infer<typeof PinnedBody>;

export const PIN_KEY = /^[a-z0-9_-]{1,32}$/;

export const Answers = z.record(elementId, Json);
export type Answers = z.infer<typeof Answers>;

export const HumanMessageBody = z
  .object({
    text: z.string().optional(),
    answers: Answers.optional(),
  })
  .refine((b) => b.text !== undefined || (b.answers && Object.keys(b.answers).length > 0), "A message needs text or answers");
export type HumanMessageBody = z.infer<typeof HumanMessageBody>;

const Plain = z.object({ enc: z.literal(false).default(false), body: z.unknown() });
const Encrypted = z.object({ enc: z.literal(true), body: z.string().min(1) });
const Payload = z.union([Encrypted, Plain]);

export const BlockPatch = z.looseObject({ id: elementId });

export const CreateChannelRequest = z.object({ name: z.string().min(1).max(100) });
export const ClaimPairingRequest = z.object({ code: z.string().min(1).max(32), label: z.string().max(100).optional() });
export const PostMessageRequest = z.intersection(
  Payload,
  z.object({
    reply_to: z.string().optional(),
    ask: z.object({ expires_at: z.number().int().optional() }).optional(),
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
export const MessageStateRequest = z.object({ state: z.enum(["seen", "working", "done"]) });
export const SyncRequest = z.object({
  tokens: z.array(z.string()).max(200),
  cursor: z.string().optional(),
  wait: z.number().min(0).max(60).optional(),
});

export type Sender = "agent" | "human";
export type AskStatus = "open" | "answered" | "expired" | "cancelled";
export type MessageState = "seen" | "working" | "done";

export type Channel = { id: string; name: string; e2e: boolean; created_at: number };

export type Ask = { status: AskStatus; expires_at: number | null; answer_id: string | null };

export type Message = {
  seq: number;
  id: string;
  channel_id: string;
  sender: Sender;
  reply_to: string | null;
  pin: string | null;
  ask: Ask | null;
  state: MessageState | null;
  created_at: number;
  updated_at: number | null;
  deleted_at: number | null;
} & ({ enc: false; body: AgentMessageBody | HumanMessageBody } | { enc: true; body: string });

export type Pairing = { code: string; expires_at: number };

export type ServerInfo = { server_token_required: boolean };

export type CreateChannelResponse = { channel: Channel; agent_token: string; pairing: Pairing };
export type ClaimPairingResponse = { channel: Channel; token: string };
export type MessagesResponse = { messages: Message[]; cursor: number };
export type AskResponse = { message: Message; answer: Message | null };
export type SyncResponse = { cursor: string; messages: Message[]; revoked: string[] };
export * from "./helpers.ts";
