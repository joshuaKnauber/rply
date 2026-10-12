import { HTTPException } from "hono/http-exception";

type Listener = () => void;

// open long-polls per agent or user; more than this is a client gone wrong or someone tying up connections
export const MAX_WAITS_PER_CLIENT = 10;

export type Notifier = ReturnType<typeof createNotifier>;

export function createNotifier() {
  const listeners = new Map<string, Set<Listener>>();
  const waits = new Map<string, number>();

  return {
    enter(client: string) {
      const open = waits.get(client) ?? 0;
      if (open >= MAX_WAITS_PER_CLIENT) throw new HTTPException(429, { message: `Too many open waits (max ${MAX_WAITS_PER_CLIENT}), close some first` });
      waits.set(client, open + 1);
      return () => {
        const left = (waits.get(client) ?? 1) - 1;
        if (left > 0) waits.set(client, left);
        else waits.delete(client);
      };
    },
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
  client: string;
  channelIds: string[];
  waitSeconds: number;
  signal: AbortSignal;
  fetch: () => Promise<T>;
  isEmpty: (result: T) => boolean;
}): Promise<T> {
  if (opts.waitSeconds <= 0) return opts.fetch();
  const leave = opts.notifier.enter(opts.client);
  try {
    return await waitFor(opts);
  } finally {
    leave();
  }
}

async function waitFor<T>(opts: Parameters<typeof longPoll<T>>[0]): Promise<T> {
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
