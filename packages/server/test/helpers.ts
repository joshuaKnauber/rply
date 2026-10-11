import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db/index.ts";
import { createNotifier } from "../src/notifier.ts";
import type { ClaimPairingResponse, CreateChannelResponse } from "@rply/schema";

export async function setup() {
  const db = await openDatabase(":memory:");
  const app = createApp({ db, notifier: createNotifier() });

  const request = async (method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
    const res = await app.request(`/v1${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(opts.token && { authorization: `Bearer ${opts.token}` }),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    return { status: res.status, json: (text ? JSON.parse(text) : null) as any };
  };

  const pairedChannel = async (name = "test") => {
    const created = (await request("POST", "/channels", { body: { name } })).json as CreateChannelResponse;
    const claimed = (await request("POST", "/pairings/claim", { body: { code: created.pairing.code } })).json as ClaimPairingResponse;
    return { channel: created.channel, agent: created.agent_token, human: claimed.token };
  };

  return { db, request, pairedChannel };
}

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
