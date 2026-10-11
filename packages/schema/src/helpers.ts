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

export type EmbedTheme = "light" | "dark";

const embedCss = `:root{color-scheme:light;--rply-fg:#2b2a28;--rply-muted:#76736f;--rply-border:#e6e4e1;--rply-surface:#f4f3f1;--rply-accent:#6f7ef6}
:root[data-theme=dark]{color-scheme:dark;--rply-fg:#f4f3f1;--rply-muted:#a29f9a;--rply-border:rgb(255 255 255/.1);--rply-surface:#2b2a28}
html,body{margin:0;background:transparent;color:var(--rply-fg);font:14px/1.5 system-ui,-apple-system,sans-serif}
body{display:flow-root}
:where(button){font:inherit;color:inherit;background:var(--rply-surface);border:1px solid var(--rply-border);border-radius:6px;padding:4px 10px;cursor:pointer}
:where(input,select,textarea){font:inherit;color:inherit;background:transparent;border:1px solid var(--rply-border);border-radius:6px;padding:4px 8px}
:where(a){color:var(--rply-accent)}
:where(table){border-collapse:collapse}
:where(th,td){padding:4px 8px;border-bottom:1px solid var(--rply-border);text-align:left}`;

const embedPost = {
  parent: `parent.postMessage(m, "*")`,
  native: `window.ReactNativeWebView.postMessage(JSON.stringify(m))`,
};

export function embedDocument(block: { html: string; height?: number }, transport: keyof typeof embedPost, theme: EmbedTheme) {
  return `<!doctype html><html data-theme="${theme === "dark" ? "dark" : "light"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script>
const post = (m) => ${embedPost[transport]};
window.rply = {
  reply: (value) => post({ rply: "reply", value }),
  send: (value, label) => post({ rply: "send", value, label }),
  resize: (height) => post({ rply: "resize", height }),
};
addEventListener("message", (e) => {
  if (e.data && e.data.rply === "theme") document.documentElement.dataset.theme = e.data.theme === "dark" ? "dark" : "light";
});
addEventListener("load", () => {
  const report = () => rply.resize(Math.ceil(Math.max(document.body.scrollHeight, document.body.getBoundingClientRect().height)));
  new ResizeObserver(report).observe(document.body);
  report();
});
</script>
<style>${embedCss}</style>${block.height ? "" : "<style>html,body{overflow:hidden}</style>"}${block.html}`;
}
