export { askStatus, formatValue, isAnswer, isEvent, preview } from "@rply/schema";

export function formatTime(ts: number) {
  const date = new Date(ts);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}
