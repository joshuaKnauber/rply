import { useSyncExternalStore } from "react";
import type { Channel } from "@rply/schema";

export type StoredChannel = {
  channel: Channel;
  token: string;
  revoked?: boolean;
  lastReadSeq?: number;
};

const KEY = "rply.channels";
const listeners = new Set<() => void>();
let channels: StoredChannel[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");

function update(fn: (current: StoredChannel[]) => StoredChannel[]) {
  channels = fn(channels);
  localStorage.setItem(KEY, JSON.stringify(channels));
  listeners.forEach((l) => l());
}

window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  channels = JSON.parse(e.newValue ?? "[]");
  listeners.forEach((l) => l());
});

export function useChannels() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => channels,
  );
}

export const addChannel = (entry: StoredChannel) =>
  update((all) => [...all.filter((c) => c.channel.id !== entry.channel.id), entry]);

export const removeChannel = (id: string) => update((all) => all.filter((c) => c.channel.id !== id));

export const markRevoked = (tokens: string[]) =>
  update((all) => all.map((c) => (tokens.includes(c.token) ? { ...c, revoked: true } : c)));

export const markRead = (id: string, seq: number) =>
  update((all) => all.map((c) => (c.channel.id === id && (c.lastReadSeq ?? 0) < seq ? { ...c, lastReadSeq: seq } : c)));
