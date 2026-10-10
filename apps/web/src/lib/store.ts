import { useSyncExternalStore } from "react";

export function createStore<T>(key: string, initial: T) {
  const listeners = new Set<() => void>();
  const parse = (raw: string | null): T => (raw === null ? initial : JSON.parse(raw));
  let value = parse(localStorage.getItem(key));
  const emit = () => listeners.forEach((l) => l());

  window.addEventListener("storage", (e) => {
    if (e.key !== key) return;
    value = parse(e.newValue);
    emit();
  });

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    use: () => useSyncExternalStore(subscribe, () => value),
    get: () => value,
    update(fn: (current: T) => T) {
      value = fn(value);
      if (value === undefined || value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
      emit();
    },
  };
}
