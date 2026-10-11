import type { Message } from "@rply/schema";

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
  if ("action" in body && body.action) return `Answered: ${formatValue(body.action.value)}`;
  if ("title" in body && body.title) return body.title;
  return body.text ?? "Interactive message";
}

export function formatValue(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).map(([k, v]) => `${k}: ${formatValue(v)}`).join(", ");
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}
