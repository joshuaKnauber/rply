import { preview as schemaPreview, type Message } from "@rply/schema";

export { askStatus, formatValue, isAnswer, isEvent } from "@rply/schema";

export const preview = (message: Message) => schemaPreview(message).replace(/[*`#>]/g, "");

export function formatTime(ts: number) {
  const date = new Date(ts);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export const formatClock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function formatDay(ts: number) {
  const date = new Date(ts);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function formatAgo(ts: number) {
  const minutes = Math.round((Date.now() - ts) / 60_000);
  if (minutes < 2) return "Active now";
  if (minutes < 60) return `Seen ${minutes} min ago`;
  if (minutes < 60 * 24) return `Seen ${Math.round(minutes / 60)} h ago`;
  return `Seen ${formatTime(ts)}`;
}
