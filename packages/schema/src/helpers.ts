import type { Answers, Ask, AskStatus, Block, BlockOf, Message, SecretStatus } from "./index.ts";

export const COMMAND_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export const INPUT_TYPES = ["choice", "text_input", "number_input", "toggle", "confirm"] as const;

export const isInput = (block: Block) =>
  (INPUT_TYPES as readonly string[]).includes(block.type) || (block.type === "html" && block.question === true && block.id !== undefined);

export const askStatus = (ask: Ask | null): AskStatus | null =>
  ask && (ask.status === "open" && ask.expires_at !== null && ask.expires_at <= Date.now() ? "expired" : ask.status);

export const isAnswer = (message: Message) =>
  !message.enc && message.sender === "human" && "answers" in message.body && message.body.answers !== undefined;

export const isEvent = (message: Message) =>
  !message.enc && message.sender === "human" && "event" in message.body && message.body.event !== undefined;

export const isCall = (message: Message) =>
  !message.enc && message.sender === "human" && "call" in message.body && message.body.call !== undefined;

export const isApp = (message: Message) => !message.enc && message.pin !== null && "view" in message.body && message.body.view === "app";

export const appUrl = (message: Message) => {
  if (message.enc || !isApp(message) || ("text" in message.body && message.body.text)) return null;
  const blocks = messageBlocks(message);
  const only = blocks.length === 1 && blocks[0]!.type === "link" ? (blocks[0] as BlockOf<"link">) : null;
  return only && /^https?:\/\//i.test(only.url) ? only.url : null;
};

export const appTitle = (message: Message) => (!message.enc && "title" in message.body && message.body.title) || message.pin || "App";

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
  if ("call" in body && body.call) return `Called: ${body.call.name}`;
  if ("title" in body && body.title) return body.title;
  if (body.text) return body.text;
  if ("attachments" in body && body.attachments?.length) return `📎 ${body.attachments.map((a) => a.name).join(", ")}`;
  const secret = "blocks" in body ? body.blocks?.find((b) => b.type === "secret") : undefined;
  if (secret) return `Secret requested: ${(secret as BlockOf<"secret">).name}`;
  const titled = "blocks" in body ? body.blocks?.find((b) => (b.type === "heading" || b.type === "markdown") && "text" in b) : undefined;
  if (titled) return (titled as { text: string }).text;
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

export function shortUrl(url: string) {
  try {
    const { host, pathname, search } = new URL(url);
    const path = (pathname === "/" ? "" : pathname) + (search.length > 1 ? search : "");
    const short = host.replace(/^www\./, "") + path;
    if (short.length <= 48) return short;
    const parts = pathname.split("/").filter(Boolean);
    return `${host.replace(/^www\./, "")}/…/${parts.slice(-2).join("/")}`.slice(0, 64);
  } catch {
    return url;
  }
}

export const MAX_LINK_CARDS = 3;

export type TextPart = { type: "text"; text: string } | { type: "url"; url: string };

export function splitUrlLines(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let buffer: string[] = [];
  let fenced = false;
  const flush = () => {
    if (buffer.join("").trim()) parts.push({ type: "text", text: buffer.join("\n") });
    buffer = [];
  };
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (!fenced && /^\s*https?:\/\/\S+\s*$/.test(line) && parts.filter((p) => p.type === "url").length < MAX_LINK_CARDS) {
      flush();
      parts.push({ type: "url", url: line.trim() });
    } else buffer.push(line);
  }
  flush();
  return parts;
}

export const isBareLink = (href: string, text: string) =>
  /^https?:\/\//.test(href) && href.replace(/^https?:\/\//, "") === text.replace(/^https?:\/\//, "");

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export type EmbedTheme = "light" | "dark";

const embedCss = `:root{color-scheme:light;--rply-fg:#2b2a28;--rply-muted:#76736f;--rply-border:#e6e4e1;--rply-surface:#f4f3f1;--rply-bg:#ffffff;--rply-accent:#6f7ef6;--rply-success:#16a34a;--rply-warning:#d97706;--rply-danger:#dc2626}
:root[data-theme=dark]{color-scheme:dark;--rply-fg:#f4f3f1;--rply-muted:#a29f9a;--rply-border:rgb(255 255 255/.1);--rply-surface:#2b2a28;--rply-bg:#1b1a19;--rply-success:#4ade80;--rply-warning:#fbbf24;--rply-danger:#f87171}
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

const scriptJson = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c");

const openLinksInNewTabs = `addEventListener("click", (e) => {
    const link = e.target instanceof Element && e.target.closest("a[href]");
    if (link && /^https?:/.test(link.href)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  }, true);`;

export const stripDocumentTags = (html: string) => html.replace(/^\s*<!doctype[^>]*>/i, "").replace(/<\/?html(\s[^>]*)?>/gi, "");

export type EmbedOptions = { storage?: Record<string, unknown>; fill?: boolean };

export function embedDocument(block: { html: string; height?: number }, transport: keyof typeof embedPost, theme: EmbedTheme, opts: EmbedOptions = {}) {
  return `<!doctype html><html data-theme="${theme === "dark" ? "dark" : "light"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script>
(() => {
  const post = (m) => ${embedPost[transport]};
  const calls = new Map();
  const store = ${scriptJson(opts.storage ?? {})};
  let nextId = 0;
  const request = (name, args, agent) => new Promise((resolve, reject) => {
    const id = ++nextId;
    calls.set(id, { resolve, reject });
    post({ rply: "call", id, name, args, agent });
  });
  window.rply = {
    reply: (value) => post({ rply: "reply", value }),
    send: (value, label) => post({ rply: "send", value, label }),
    resize: (height) => post({ rply: "resize", height }),
    call: (name, args) => request(name, args, false),
    agent: (name, args) => request(name, args, true),
    get theme() { return document.documentElement.dataset.theme; },
    storage: {
      get: (key) => store[key],
      set: (key, value) => {
        if (value === undefined) delete store[key];
        else store[key] = value;
        post({ rply: "storage", key, value });
      },
    },
  };
  window.__rplyReceive = (m) => {
    if (!m || typeof m !== "object") return;
    if (m.rply === "theme") {
      const theme = m.theme === "dark" ? "dark" : "light";
      if (document.documentElement.dataset.theme === theme) return;
      document.documentElement.dataset.theme = theme;
      dispatchEvent(new CustomEvent("rply:theme", { detail: theme }));
    }
    if (m.rply === "result" && calls.has(m.id)) {
      const pending = calls.get(m.id);
      calls.delete(m.id);
      if (m.error === undefined) pending.resolve(m.result);
      else pending.reject(new Error(m.error));
    }
  };
  addEventListener("message", (e) => __rplyReceive(e.data));
  addEventListener("error", (e) => post({ rply: "error", message: String(e.message || e.error || "Unknown error") }));
  addEventListener("unhandledrejection", (e) => post({ rply: "error", message: String((e.reason && e.reason.message) || e.reason) }));
  ${transport === "parent" ? openLinksInNewTabs : ""}
  addEventListener("load", () => {
    const report = () => rply.resize(Math.ceil(Math.max(document.body.scrollHeight, document.body.getBoundingClientRect().height)));
    new ResizeObserver(report).observe(document.body);
    report();
  });
})();
</script>
<style>${embedCss}</style>${block.height || opts.fill ? "" : "<style>html,body{overflow:hidden}</style>"}${stripDocumentTags(block.html)}`;
}
