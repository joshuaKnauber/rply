import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const storage =
  Platform.OS === "web"
    ? { getItemAsync: async (k: string) => localStorage.getItem(k), setItemAsync: async (k: string, v: string) => localStorage.setItem(k, v) }
    : SecureStore;

export function createStore<T>(key: string, initial: T) {
  const listeners = new Set<() => void>();
  let value = initial;

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    async load() {
      const raw = await storage.getItemAsync(key);
      if (raw !== null) value = JSON.parse(raw);
    },
    use: () => useSyncExternalStore(subscribe, () => value),
    get: () => value,
    update(fn: (current: T) => T) {
      value = fn(value);
      storage.setItemAsync(key, JSON.stringify(value));
      listeners.forEach((l) => l());
    },
  };
}
