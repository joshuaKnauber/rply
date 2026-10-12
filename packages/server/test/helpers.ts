import pg from "pg";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db/index.ts";
import { randomId } from "../src/tokens.ts";
import { createNotifier } from "../src/notifier.ts";
import type { FilesConfig } from "../src/files/config.ts";
import { createPush, type PushSender } from "../src/push/index.ts";
import type { ClaimPairingResponse, CreateChannelResponse } from "@rply/schema";

export async function setup(opts: { files?: FilesConfig; pushSend?: PushSender } = {}) {
  const db = await openDatabase(await testDatabase());
  const push = opts.pushSend ? await createPush(db, { send: opts.pushSend }) : null;
  const deps = { db, notifier: createNotifier(), files: opts.files ?? null, push };
  const app = createApp(deps);

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

  const upload = async (token: string, name: string, bytes: Uint8Array | string, mime = "application/octet-stream") => {
    const res = await app.request(`/v1/files?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": mime },
      body: (typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes) as Uint8Array<ArrayBuffer>,
    });
    return { status: res.status, json: (await res.json()) as any };
  };
  const download = (token: string, id: string) => app.request(`/v1/files/${id}`, { headers: { authorization: `Bearer ${token}` } });

  return { db, deps, app, request, pairedChannel, upload, download };
}

// RPLY_TEST_DATABASE_URL=postgres://... runs every test in a fresh schema of that database
async function testDatabase() {
  const url = process.env.RPLY_TEST_DATABASE_URL;
  if (!url) return ":memory:";
  const schema = `test_${randomId()}`;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query(`create schema ${schema}`);
  await client.end();
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  return scoped.toString();
}

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
