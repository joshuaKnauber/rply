export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = { method?: string; token?: string; channel?: string; body?: unknown; signal?: AbortSignal };

export async function api<T>(server: string, path: string, opts: Options = {}): Promise<T> {
  const res = await fetch(`${server}/v1${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: {
      ...(opts.body !== undefined && { "content-type": "application/json" }),
      ...(opts.token && { authorization: `Bearer ${opts.token}` }),
      ...(opts.channel && { "x-rply-channel": opts.channel }),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status);
  return json as T;
}

export function normalizeServer(input: string) {
  const trimmed = input.trim();
  const url = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  return url.replace(/\/+$/, "");
}
