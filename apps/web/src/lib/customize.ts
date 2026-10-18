import { useSyncExternalStore } from "react";
import type { ChannelEntry } from "@rply/schema";

// which agent the bird creator is open for
type Target = { entry: ChannelEntry; agentId: string } | null;

let target: Target = null;
const listeners = new Set<() => void>();
const set = (next: Target) => {
  target = next;
  listeners.forEach((l) => l());
};

export const openCustomizer = (entry: ChannelEntry, agentId: string) => set({ entry, agentId });
export const closeCustomizer = () => set(null);
export const useCustomizer = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => target,
  );
