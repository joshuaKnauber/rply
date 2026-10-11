export class CliError extends Error {
  exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

class TransientError extends Error {}

export type Client = ReturnType<typeof createClient>;

export function createClient(server: string, token?: string) {
  async function once<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${server}/v1${path}`, {
        method,
        headers: {
          ...(body !== undefined && { "content-type": "application/json" }),
          ...(token && { authorization: `Bearer ${token}` }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new TransientError(`Can't reach ${server}: ${(err as Error).cause ?? (err as Error).message}`);
    }
    const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (res.status >= 500) throw new TransientError(json.error ?? `Server error (${res.status})`);
    const hint = res.status === 400 && /^\/(messages|pins)/.test(path) ? " (see `rply guide blocks`)" : "";
    if (!res.ok) throw new CliError((json.error ?? `Request failed (${res.status})`) + hint);
    return json as T;
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await once<T>(method, path, body);
      } catch (err) {
        if (!(err instanceof TransientError)) throw err;
        if (attempt >= 3) throw new CliError(err.message);
        await sleep(1000 * attempt);
      }
    }
  }

  async function poll<T>(deadline: number | undefined, fetchOnce: (waitSeconds: number) => Promise<T | undefined>): Promise<T | undefined> {
    while (true) {
      const remaining = deadline === undefined ? Infinity : deadline - Date.now();
      if (remaining <= 0) return undefined;
      try {
        const result = await fetchOnce(Math.min(55, Math.ceil(remaining / 1000)));
        if (result !== undefined) return result;
      } catch (err) {
        if (!(err instanceof TransientError)) throw err;
        await sleep(2000);
      }
    }
  }

  return { request, once, poll };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
