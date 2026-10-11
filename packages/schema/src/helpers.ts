import type { Answers, Ask, AskStatus, Block, BlockOf, Message, SecretStatus } from "./index.ts";

export const INPUT_TYPES = ["choice", "text_input", "number_input", "toggle", "confirm"] as const;

export const isInput = (block: Block) =>
  (INPUT_TYPES as readonly string[]).includes(block.type) || (block.type === "html" && block.question === true && block.id !== undefined);

export const askStatus = (ask: Ask | null): AskStatus | null =>
  ask && (ask.status === "open" && ask.expires_at !== null && ask.expires_at <= Date.now() ? "expired" : ask.status);

export const isAnswer = (message: Message) =>
  !message.enc && message.sender === "human" && "answers" in message.body && message.body.answers !== undefined;

export const isEvent = (message: Message) =>
  !message.enc && message.sender === "human" && "event" in message.body && message.body.event !== undefined;

export const secretStatus = (block: BlockOf<"secret">): SecretStatus =>
  block.status === "open" && block.expires_at !== null && block.expires_at <= Date.now() ? "expired" : block.status;

export const hasSecretBlock = (blocks: unknown) => Array.isArray(blocks) && blocks.some((b) => b && typeof b === "object" && b.type === "secret");

export const isWaiting = (message: Message) =>
  askStatus(message.ask) === "open" || messageBlocks(message).some((b) => b.type === "secret" && secretStatus(b as BlockOf<"secret">) === "open");

export const messageBlocks = (message: Message): Block[] => (!message.enc && "blocks" in message.body ? (message.body.blocks ?? []) : []);

export const inputsOf = (blocks: Block[]) => blocks.filter(isInput);

export const isSimpleInput = (block: Block) =>
  (block.type === "choice" && !block.multi) || block.type === "confirm" || block.type === "html";

export const submitsOnTap = (inputs: Block[]) => inputs.length === 1 && isSimpleInput(inputs[0]!);

export const inputDefaults = (inputs: Block[]): Record<string, unknown> =>
  Object.fromEntries(inputs.flatMap((b) => ("default" in b && b.default !== undefined ? [[b.id!, b.default]] : [])));

const isEmpty = (value: unknown) => value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

export const missingInputs = (inputs: Block[], values: Record<string, unknown>) =>
  inputs.filter((b) => "required" in b && b.required && isEmpty(values[b.id!]));

export const answeredCount = (inputs: Block[], values: Record<string, unknown>) => inputs.filter((b) => !isEmpty(values[b.id!])).length;

export function collectAnswers(inputs: Block[], values: Record<string, unknown>): Answers {
  const entries = inputs.map((b) => [b.id!, values[b.id!] ?? (b.type === "toggle" ? ("default" in b && b.default) || false : undefined)] as const);
  return Object.fromEntries(entries.filter(([, v]) => !isEmpty(v))) as Answers;
}

export function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function preview(message: Message) {
  if (message.enc) return "Encrypted message";
  const body = message.body;
  if ("answers" in body && body.answers) return "Answered";
  if ("event" in body && body.event) return `Sent: ${eventLabel(body.event)}`;
  if ("title" in body && body.title) return body.title;
  if (body.text) return body.text;
  if ("attachments" in body && body.attachments?.length) return `📎 ${body.attachments.map((a) => a.name).join(", ")}`;
  const secret = "blocks" in body ? body.blocks?.find((b) => b.type === "secret") : undefined;
  if (secret) return `Secret requested: ${(secret as BlockOf<"secret">).name}`;
  return message.ask ? "Question" : "Message";
}

export const eventLabel = (event: { value: unknown; label?: string }) => event.label ?? formatValue(event.value);

export const fileIdsOf = (body: unknown): string[] => {
  if (!body || typeof body !== "object") return [];
  const b = body as { blocks?: { type?: string; file_id?: string }[]; attachments?: { file_id: string }[] };
  return [
    ...(b.blocks ?? []).filter((x) => (x.type === "image" || x.type === "file") && typeof x.file_id === "string").map((x) => x.file_id!),
    ...(b.attachments ?? []).map((a) => a.file_id),
  ];
};

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
