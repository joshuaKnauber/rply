import type { Ask, AskStatus, Message } from "@rply/schema";

export function formatTime(ts: number) {
  const date = new Date(ts);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function preview(message: Message) {
  if (message.enc) return "Encrypted message";
  const body = message.body;
  if ("answers" in body && body.answers) return "Answered";
  if ("title" in body && body.title) return body.title;
  if (body.text) return body.text;
  return message.ask ? "Question" : "Message";
}

export function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export const askStatus = (ask: Ask | null): AskStatus | null =>
  ask && (ask.status === "open" && ask.expires_at !== null && ask.expires_at <= Date.now() ? "expired" : ask.status);

export const isAnswer = (message: Message) => !message.enc && message.sender === "human" && "answers" in message.body && message.body.answers !== undefined;
