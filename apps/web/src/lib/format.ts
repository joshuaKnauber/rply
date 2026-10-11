export { askStatus, formatValue, isAnswer, isEvent, preview } from "@rply/schema";

export function formatTime(ts: number) {
  const date = new Date(ts);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatAgo(ts: number) {
  const minutes = Math.round((Date.now() - ts) / 60_000);
  if (minutes < 2) return "Active now";
  if (minutes < 60) return `Seen ${minutes} min ago`;
  if (minutes < 60 * 24) return `Seen ${Math.round(minutes / 60)} h ago`;
  return `Seen ${formatTime(ts)}`;
}
