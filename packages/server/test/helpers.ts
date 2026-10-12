import pg from "pg";
import { createAccounts, type AccountsOptions } from "../src/accounts.ts";
import { createApp } from "../src/app.ts";
import { openDatabase } from "../src/db/index.ts";
import { randomId } from "../src/tokens.ts";
import { createNotifier } from "../src/notifier.ts";
import type { FilesConfig } from "../src/files/config.ts";
import { createPush, type PushSender } from "../src/push/index.ts";
import type { CreateOwnedChannelResponse, JoinChannelResponse } from "@rply/schema";

export async function setup(opts: { files?: FilesConfig; pushSend?: PushSender; accounts?: AccountsOptions } = {}) {
  const db = await openDatabase(await testDatabase());
  const push = opts.pushSend ? await createPush(db, { send: opts.pushSend }) : null;
  const accounts = await createAccounts(db, { registration: "open", ...opts.accounts });
  const deps = { db, notifier: createNotifier(), accounts, files: opts.files ?? null, push };
  const app = createApp(deps);
  // session tokens act on one channel through X-Rply-Channel, like the apps do; tests set it per token
  const channelOf = new Map<string, string>();

  const authHeaders = (token: string): Record<string, string> => ({
    authorization: `Bearer ${token}`,
    ...(channelOf.has(token) && { "x-rply-channel": channelOf.get(token)! }),
  });

  const request = async (method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
    const res = await app.request(`/v1${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(opts.token && authHeaders(opts.token)),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    return { status: res.status, json: (text ? JSON.parse(text) : null) as any };
  };

  let users = 0;
  const signUp = async (email = `user${++users}@example.com`) => {
    const res = await app.request("/v1/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correct horse", name: email.split("@")[0] }),
    });
    return { status: res.status, token: res.headers.get("set-auth-token"), json: (await res.json()) as any };
  };

  // a channel owned by `human` (a new user unless given) with one joined agent
  const ownedChannel = async (name = "test", human?: string) => {
    human ??= (await signUp()).token!;
    const created = (await request("POST", "/channels", { token: human, body: { name } })).json as CreateOwnedChannelResponse;
    const joined = (await request("POST", "/agents/join", { body: { code: created.agent_code.code } })).json as JoinChannelResponse;
    channelOf.set(human, created.channel.id);
    return { channel: created.channel, agent: joined.agent_token, human };
  };

  const upload = async (token: string, name: string, bytes: Uint8Array | string, mime = "application/octet-stream") => {
    const res = await app.request(`/v1/files?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": mime },
      body: (typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes) as Uint8Array<ArrayBuffer>,
    });
    return { status: res.status, json: (await res.json()) as any };
  };
  const download = (token: string, id: string) => app.request(`/v1/files/${id}`, { headers: authHeaders(token) });

  return { db, deps, app, request, signUp, ownedChannel, upload, download, channelOf };
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
