type Listener = () => void;

export type Notifier = ReturnType<typeof createNotifier>;

export function createNotifier() {
  const listeners = new Map<string, Set<Listener>>();

  return {
    notify(channelId: string) {
      for (const listener of listeners.get(channelId) ?? []) listener();
    },
    subscribe(channelIds: string[], listener: Listener) {
      for (const id of channelIds) {
        if (!listeners.has(id)) listeners.set(id, new Set());
        listeners.get(id)!.add(listener);
      }
      return () => {
        for (const id of channelIds) {
          const set = listeners.get(id);
          set?.delete(listener);
          if (set?.size === 0) listeners.delete(id);
        }
      };
    },
  };
}

export async function longPoll<T>(opts: {
  notifier: Notifier;
  channelIds: string[];
  waitSeconds: number;
  signal: AbortSignal;
  fetch: () => Promise<T>;
  isEmpty: (result: T) => boolean;
}): Promise<T> {
  const deadline = Date.now() + opts.waitSeconds * 1000;
  while (true) {
    const { promise: woken, resolve: wake } = Promise.withResolvers<void>();
    const unsubscribe = opts.notifier.subscribe(opts.channelIds, wake);
    try {
      const result = await opts.fetch();
      const remaining = deadline - Date.now();
      if (!opts.isEmpty(result) || remaining <= 0 || opts.signal.aborted) return result;
      await waitUntil(woken, remaining, opts.signal);
    } finally {
      unsubscribe();
    }
  }
}

function waitUntil(promise: Promise<void>, ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
    promise.then(done);
  });
}
