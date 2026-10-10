import { z } from "zod";

const elementId = z.string().min(1).max(64);

const FormField = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["text", "textarea"]),
    name: elementId,
    label: z.string(),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("number"),
    name: elementId,
    label: z.string(),
    required: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("select"),
    name: elementId,
    label: z.string(),
    options: z.array(z.string()).min(1),
    required: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("toggle"),
    name: elementId,
    label: z.string(),
  }),
]);

export const Block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("markdown"), id: elementId.optional(), text: z.string() }),
  z.object({ type: z.literal("heading"), id: elementId.optional(), text: z.string() }),
  z.object({
    type: z.literal("buttons"),
    id: elementId,
    options: z.array(z.object({ label: z.string(), value: z.string() })).min(1),
  }),
  z.object({
    type: z.literal("form"),
    id: elementId,
    fields: z.array(FormField).min(1),
    submit_label: z.string().optional(),
  }),
  z.object({
    type: z.literal("progress"),
    id: elementId.optional(),
    value: z.number(),
    max: z.number().positive().optional(),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal("keyvalue"),
    id: elementId.optional(),
    items: z.array(z.object({ key: z.string(), value: z.string() })),
  }),
  z.object({
    type: z.literal("table"),
    id: elementId.optional(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number()]))),
  }),
  z.object({ type: z.literal("code"), id: elementId.optional(), code: z.string(), language: z.string().optional() }),
  z.object({ type: z.literal("link"), id: elementId.optional(), url: z.url(), label: z.string().optional() }),
]);
export type Block = z.infer<typeof Block>;

export const AgentMessageBody = z
  .object({
    title: z.string().max(200).optional(),
    text: z.string().optional(),
    blocks: z.array(Block).optional(),
  })
  .refine((b) => b.text !== undefined || (b.blocks?.length ?? 0) > 0, "A message needs text or blocks");
export type AgentMessageBody = z.infer<typeof AgentMessageBody>;

export const Action = z.object({ element_id: elementId, value: z.json() });
export type Action = z.infer<typeof Action>;

export const HumanMessageBody = z
  .object({
    text: z.string().optional(),
    action: Action.optional(),
  })
  .refine((b) => b.text !== undefined || b.action !== undefined, "A message needs text or an action");
export type HumanMessageBody = z.infer<typeof HumanMessageBody>;

export const StatusBody = z.object({ blocks: z.array(Block) });
export type StatusBody = z.infer<typeof StatusBody>;

const Plain = z.object({ enc: z.literal(false).default(false), body: z.unknown() });
const Encrypted = z.object({ enc: z.literal(true), body: z.string().min(1) });
const Payload = z.union([Encrypted, Plain]);

export const CreateChannelRequest = z.object({ name: z.string().min(1).max(100) });
export const ClaimPairingRequest = z.object({ code: z.string().min(1).max(32), label: z.string().max(100).optional() });
export const PostMessageRequest = z.intersection(Payload, z.object({ reply_to: z.string().optional() }));
export const PutStatusRequest = Payload;
export const PatchStatusRequest = z.object({
  blocks: z.array(z.object({ id: elementId }).catchall(z.unknown())).min(1),
});
export const SyncRequest = z.object({
  tokens: z.array(z.string()).max(200),
  cursor: z.string().optional(),
  wait: z.number().min(0).max(60).optional(),
});

export type Sender = "agent" | "human";

export type Channel = { id: string; name: string; e2e: boolean; created_at: number };

export type Message = {
  seq: number;
  id: string;
  channel_id: string;
  sender: Sender;
  reply_to: string | null;
  created_at: number;
} & ({ enc: false; body: AgentMessageBody | HumanMessageBody } | { enc: true; body: string });

export type Status = {
  channel_id: string;
  updated_at: number;
} & ({ enc: false; body: StatusBody } | { enc: true; body: string });

export type Pairing = { code: string; expires_at: number };

export type ServerInfo = { server_token_required: boolean };

export type CreateChannelResponse = { channel: Channel; agent_token: string; pairing: Pairing };
export type ClaimPairingResponse = { channel: Channel; token: string };
export type MessagesResponse = { messages: Message[]; cursor: number };
export type SyncResponse = { cursor: string; messages: Message[]; statuses: Status[]; revoked: string[] };
