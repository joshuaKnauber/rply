import assert from "node:assert/strict";
import { test } from "node:test";
import { sweepOldMessages } from "../src/messages.ts";
import { sweepUnclaimed } from "../src/routes/channels.ts";
import { delay, setup } from "./helpers.ts";

const choice = (id = "choice") => ({ type: "choice", id, options: [{ label: "Yes" }, { label: "No" }] });

test("the first user sets the server up, then registration follows the server's mode", async () => {
  const { request, signUp } = await setup({ accounts: { registration: "invite" } });
  assert.equal((await request("GET", "/info")).json.needs_setup, true);
  const first = await signUp("owner@example.com");
  assert.equal(first.status, 200);
  assert.ok(first.token);
  const info = (await request("GET", "/info")).json;
  assert.equal(info.needs_setup, false);
  assert.equal(info.registration, "invite");
  assert.equal(info.email, false);
  assert.equal((await signUp("someone@example.com")).status, 403);
  assert.equal((await request("GET", "/channels")).status, 401);
  assert.deepEqual((await request("GET", "/channels", { token: first.token! })).json.channels, []);
});

test("cookie sessions only accept writes from the server's own origin", async () => {
  const { app } = await setup();
  const signUp = await app.request("http://rply.test/v1/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://rply.test" },
    body: JSON.stringify({ email: "me@example.com", password: "correct horse", name: "me" }),
  });
  const cookie = signUp.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  assert.match(cookie, /rply\.session_token=/);
  const create = (origin?: string) =>
    app.request("http://rply.test/v1/channels", { method: "POST", headers: { cookie, "content-type": "text/plain", ...(origin && { origin }) }, body: JSON.stringify({ name: "x" }) });
  assert.equal((await create("https://evil.example")).status, 403);
  assert.equal((await create("null")).status, 403);
  assert.equal((await create("http://rply.test")).status, 201);
  assert.equal((await app.request("http://rply.test/v1/channels", { headers: { cookie } })).status, 200);
});

test("a channel created by an agent is claimed once, with sloppy input, and then belongs to the account", async () => {
  const { request, signUp } = await setup();
  const { json } = await request("POST", "/channels", { body: { name: "seo", label: "box-1" } });
  assert.match(json.agent_token, /^rply_a_/);
  const agent = json.agent_token;
  assert.equal((await request("POST", "/messages", { token: agent, body: { body: { text: "before the claim" } } })).status, 201);

  const again = await request("POST", "/pairings", { token: agent });
  assert.equal(again.status, 201);
  const user = (await signUp()).token!;
  assert.equal((await request("POST", "/channels/claim", { body: { code: again.json.code } })).status, 401);
  const sloppy = json.claim.code.toLowerCase().replace("-", " ");
  const claimed = await request("POST", "/channels/claim", { token: user, body: { code: sloppy } });
  assert.equal(claimed.status, 201);
  assert.equal(claimed.json.channel.role, "owner");
  assert.equal((await request("POST", "/channels/claim", { token: user, body: { code: again.json.code } })).status, 409);
  assert.equal((await request("POST", "/pairings", { token: agent })).status, 409);

  const listed = (await request("GET", "/channels", { token: user })).json.channels;
  assert.deepEqual(listed.map((c: any) => [c.name, c.role, c.read_seq]), [["seo", "owner", 0]]);
  const thread = await request("GET", "/messages", { token: user, headers: { "x-rply-channel": json.channel.id } });
  assert.deepEqual(thread.json.messages.map((m: any) => m.body.text), ["before the claim"]);
});

test("unclaimed channels are removed once their claim codes expire, and after a day at most", async () => {
  const { request, deps, db } = await setup();
  const { json } = await request("POST", "/channels", { body: { name: "seo" } });
  const alive = () => request("GET", "/channel", { token: json.agent_token }).then((r) => r.status === 200);
  await db.updateTable("channels").set({ created_at: Date.now() - 2 * 60 * 60 * 1000 }).execute();
  await sweepUnclaimed(deps);
  assert.equal(await alive(), true);
  await db.updateTable("channels").set({ created_at: Date.now() - 25 * 60 * 60 * 1000 }).execute();
  await sweepUnclaimed(deps);
  assert.equal(await alive(), false);

  const other = (await request("POST", "/channels", { body: { name: "other" } })).json;
  await db.updateTable("channels").set({ created_at: Date.now() - 2 * 60 * 60 * 1000 }).execute();
  await db.updateTable("pairing_codes").set({ expires_at: 0 }).execute();
  await sweepUnclaimed(deps);
  assert.equal((await request("GET", "/channel", { token: other.agent_token })).status, 401);
});
test("anonymous channel creation is rate limited", async () => {
  const { request } = await setup();
  const ip = { "x-forwarded-for": "203.0.113.7" };
  for (let i = 0; i < 20; i++) assert.equal((await request("POST", "/channels", { body: { name: `c${i}` }, headers: ip })).status, 201);
  assert.equal((await request("POST", "/channels", { body: { name: "one too many" }, headers: ip })).status, 429);
  assert.equal((await request("POST", "/channels", { body: { name: "elsewhere" }, headers: { "x-forwarded-for": "203.0.113.8" } })).status, 201);
});
test("account quotas: owned channels, messages per day and file storage", async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createDirectoryStore } = await import("../src/files/store.ts");
  const dir = await mkdtemp(join(tmpdir(), "rply-files-"));
  const files = { store: createDirectoryStore(dir), maxSize: 1024, totalLimit: 1024 * 1024, retentionMs: null };
  const { request, ownedChannel, signUp, upload } = await setup({ files, quotas: { channels: 2, messagesPerDay: 3, storage: 10, messageRetentionMs: null } });
  const user = (await signUp()).token!;
  const a = await ownedChannel("a", user);
  await ownedChannel("b", user);
  assert.equal((await request("POST", "/channels", { token: user, body: { name: "c" } })).status, 403);
  const unclaimed = (await request("POST", "/channels", { body: { name: "d" } })).json;
  assert.equal((await request("POST", "/channels/claim", { token: user, body: { code: unclaimed.claim.code } })).status, 403);

  for (let i = 0; i < 3; i++) assert.equal((await request("POST", "/messages", { token: a.agent, body: { body: { text: `m${i}` } } })).status, 201);
  assert.equal((await request("POST", "/messages", { token: a.agent, body: { body: { text: "one too many" } } })).status, 429);
  assert.equal((await request("PUT", "/pins/status", { token: a.agent, body: { body: { text: "pinned" } } })).status, 429);

  assert.equal((await upload(a.agent, "a.txt", "123456")).status, 201);
  assert.equal((await upload(a.agent, "b.txt", "123456")).status, 507);

  assert.deepEqual((await request("GET", "/account/usage", { token: user })).json, {
    channels: { used: 2, limit: 2 },
    messages_per_day: { used: 3, limit: 3 },
    storage: { used: 6, limit: 10 },
    message_retention_days: null,
  });
});

test("unclaimed channels can't upload files and hold at most 100 messages", async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createDirectoryStore } = await import("../src/files/store.ts");
  const dir = await mkdtemp(join(tmpdir(), "rply-files-"));
  const { request, upload } = await setup({ files: { store: createDirectoryStore(dir), maxSize: 1024, totalLimit: 1024 * 1024, retentionMs: null } });
  const { agent_token: agent } = (await request("POST", "/channels", { body: { name: "seo" } })).json;
  assert.equal((await upload(agent, "a.txt", "hi")).status, 403);
  for (let i = 0; i < 100; i++) await request("POST", "/messages", { token: agent, body: { body: { text: `m${i}` } } });
  assert.equal((await request("POST", "/messages", { token: agent, body: { body: { text: "101" } } })).status, 403);
});

test("guards: guessing codes, agents per channel, write bursts and open waits", async () => {
  const { request, ownedChannel, signUp } = await setup();
  const user = (await signUp()).token!;
  const ip = { "x-forwarded-for": "spoofed, 198.51.100.4" };
  for (let i = 0; i < 10; i++) assert.equal((await request("POST", "/agents/join", { body: { code: `WRNG-${String(i).padStart(4, "0")}` }, headers: ip })).status, 404);
  const { channel, human, agent } = await ownedChannel("seo", user);
  const code = (await request("POST", "/pairings", { token: human })).json.code;
  assert.equal((await request("POST", "/agents/join", { body: { code }, headers: ip })).status, 429);
  assert.equal((await request("POST", "/agents/join", { body: { code }, headers: { "x-forwarded-for": "spoofed, 198.51.100.5" } })).status, 201);

  for (let i = 0; i < 18; i++) {
    const next = (await request("POST", "/pairings", { token: human })).json.code;
    assert.equal((await request("POST", "/agents/join", { body: { code: next } })).status, 201);
  }
  const extra = (await request("POST", "/pairings", { token: human })).json.code;
  assert.equal((await request("POST", "/agents/join", { body: { code: extra } })).status, 403);

  const writes = await Promise.all(Array.from({ length: 121 }, (_, i) => request("POST", "/messages", { token: agent, body: { body: { text: `w${i}` } } })));
  assert.equal(writes.filter((r) => r.status === 429).length, 1);

  const waits = await Promise.all(Array.from({ length: 11 }, () => request("GET", "/messages?since=999999&wait=1", { token: agent })));
  assert.deepEqual(waits.map((r) => r.status).sort(), [...Array(10).fill(200), 429]);
  assert.ok(channel.id);
});

test("usage reports nothing on a server without quotas", async () => {
  const { request, ownedChannel } = await setup();
  const { human } = await ownedChannel();
  assert.deepEqual((await request("GET", "/account/usage", { token: human })).json, { channels: null, messages_per_day: null, storage: null, message_retention_days: null });
});

test("message retention deletes old unpinned messages", async () => {
  const { request, ownedChannel, db, deps } = await setup({ quotas: { channels: null, messagesPerDay: null, storage: null, messageRetentionMs: 60_000 } });
  const { agent, human } = await ownedChannel();
  await request("POST", "/messages", { token: agent, body: { body: { text: "old" } } });
  await request("PUT", "/pins/status", { token: agent, body: { body: { text: "pinned" } } });
  await db.updateTable("messages").set({ created_at: 0 }).execute();
  await request("POST", "/messages", { token: agent, body: { body: { text: "new" } } });
  await sweepOldMessages(deps);
  assert.deepEqual((await request("GET", "/messages", { token: human })).json.messages.map((m: any) => m.body.text), ["new"]);
  assert.equal((await request("GET", "/pins", { token: human })).json.messages.length, 1);
});

test("a channel created in the app gets its agent through a single-use agent code", async () => {
  const { request, signUp } = await setup();
  const user = (await signUp()).token!;
  const created = await request("POST", "/channels", { token: user, body: { name: "Web" } });
  assert.equal(created.status, 201);
  assert.equal(created.json.channel.role, "owner");
  const { agent_code } = created.json;

  assert.equal((await request("POST", "/channels/claim", { token: user, body: { code: agent_code.code } })).status, 404);
  const joined = await request("POST", "/agents/join", { body: { code: agent_code.code, label: "box-1" } });
  assert.equal(joined.status, 201);
  assert.equal(joined.json.channel.id, created.json.channel.id);
  assert.equal((await request("POST", "/agents/join", { body: { code: agent_code.code } })).status, 404);

  const agent = joined.json.agent_token;
  assert.equal((await request("POST", "/messages", { token: agent, body: { body: { text: "hi" } } })).status, 201);
  const { json } = await request("GET", "/agents", { token: user, headers: { "x-rply-channel": created.json.channel.id } });
  assert.deepEqual(json.agents.map((a: any) => [a.label, a.current]), [["box-1", false]]);
});

test("human requests need a channel the user belongs to", async () => {
  const { request, ownedChannel, signUp } = await setup();
  const { channel, human } = await ownedChannel();
  const stranger = (await signUp()).token!;
  assert.equal((await request("GET", "/messages", { token: human, headers: { "x-rply-channel": "" } })).status, 400);
  assert.equal((await request("GET", "/messages", { token: stranger, headers: { "x-rply-channel": channel.id } })).status, 404);
  assert.equal((await request("GET", "/messages", { token: "nonsense", headers: { "x-rply-channel": channel.id } })).status, 401);
});

test("read positions only move forward", async () => {
  const { request, ownedChannel } = await setup();
  const { human } = await ownedChannel();
  assert.equal((await request("PUT", "/channel/read", { token: human, body: { seq: 7 } })).status, 204);
  assert.equal((await request("PUT", "/channel/read", { token: human, body: { seq: 3 } })).status, 204);
  assert.equal((await request("GET", "/channels", { token: human })).json.channels[0].read_seq, 7);
});

test("app storage is kept per user and channel", async () => {
  const { request, ownedChannel, signUp } = await setup();
  const { human, agent } = await ownedChannel();
  assert.deepEqual((await request("GET", "/storage/dash", { token: human })).json, { value: null });
  assert.equal((await request("PUT", "/storage/dash", { token: human, body: { value: { tab: "logs" } } })).status, 204);
  assert.equal((await request("PUT", "/storage/dash", { token: human, body: { value: { tab: "runs" } } })).status, 204);
  assert.deepEqual((await request("GET", "/storage/dash", { token: human })).json, { value: { tab: "runs" } });
  await request("PUT", "/storage/msg1", { token: human, body: { value: [1, 2] } });
  assert.deepEqual((await request("GET", "/storage", { token: human })).json, { values: { dash: { tab: "runs" }, msg1: [1, 2] } });
  assert.equal((await request("GET", "/storage/dash", { token: agent })).status, 403);
  assert.equal((await request("PUT", "/storage/dash", { token: human, body: { value: "x".repeat(300_000) } })).status, 413);

  const other = await ownedChannel("other", (await signUp()).token!);
  assert.deepEqual((await request("GET", "/storage/dash", { token: other.human })).json, { value: null });
});

test("the owner can add more agents and revoke them", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();

  const code = (await request("POST", "/pairings", { token: human })).json.code;
  const second = (await request("POST", "/agents/join", { body: { code } })).json.agent_token;

  assert.equal((await request("PATCH", "/agent", { token: human, body: { label: "x" } })).status, 403);
  assert.equal((await request("PATCH", "/agent", { token: second, body: { label: " " } })).status, 400);
  assert.equal((await request("PATCH", "/agent", { token: second, body: { label: "Deploy runner" } })).status, 200);
  const agents = (await request("GET", "/agents", { token: second })).json.agents;
  assert.equal(agents[1].label, "Deploy runner");
  assert.equal(agents.length, 2);
  assert.deepEqual(agents.map((a: any) => a.current), [false, true]);

  assert.equal((await request("DELETE", `/agents/${agents[0].id}`, { token: agent })).status, 403);
  assert.equal((await request("DELETE", `/agents/${agents[0].id}`, { token: human })).status, 204);
  assert.equal((await request("GET", "/channel", { token: agent })).status, 401);
  assert.equal((await request("GET", "/channel", { token: second })).status, 200);
});

test("messages and pins carry the agent that sent them, with its current label", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const code = (await request("POST", "/pairings", { token: human })).json.code;
  const second = (await request("POST", "/agents/join", { body: { code } })).json.agent_token;
  await request("PATCH", "/agent", { token: second, body: { label: "Deploy runner" } });

  const first = (await request("POST", "/messages", { token: agent, body: { body: { text: "a" } } })).json.message;
  const other = (await request("POST", "/messages", { token: second, body: { body: { text: "b" } } })).json.message;
  const reply = (await request("POST", "/messages", { token: human, body: { body: { text: "c" } } })).json.message;
  assert.notEqual(first.agent.id, other.agent.id);
  assert.equal(other.agent.label, "Deploy runner");
  assert.equal(reply.agent, null);

  await request("PATCH", "/agent", { token: second, body: { label: "Renamed" } });
  const messages = (await request("GET", "/messages", { token: human })).json.messages;
  assert.equal(messages.find((m: any) => m.id === other.id).agent.label, "Renamed");

  const pin = (await request("PUT", "/pins/status", { token: second, body: { body: { text: "x" } } })).json.message;
  assert.equal(pin.agent.id, other.agent.id);
});

test("agents only change their own messages and pins, and a plain reply reaches the agent it replies to", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const code = (await request("POST", "/pairings", { token: human })).json.code;
  const second = (await request("POST", "/agents/join", { body: { code, label: "Deploy bot" } })).json.agent_token;

  const mine = (await request("POST", "/messages", { token: agent, body: { body: { text: "mine" } } })).json.message;
  const edit = await request("PATCH", `/messages/${mine.id}`, { token: second, body: { text: "hijacked" } });
  assert.equal(edit.status, 403);
  assert.match(edit.json.error ?? edit.json.message ?? JSON.stringify(edit.json), /belongs to/);
  assert.equal((await request("DELETE", `/messages/${mine.id}`, { token: second })).status, 403);
  assert.equal((await request("PATCH", `/messages/${mine.id}`, { token: agent, body: { text: "edited" } })).status, 200);

  await request("PUT", "/pins/status", { token: agent, body: { body: { text: "first" } } });
  assert.equal((await request("PUT", "/pins/status", { token: second, body: { body: { text: "second" } } })).status, 403);
  assert.equal((await request("PATCH", "/pins/status", { token: second, body: { text: "second" } })).status, 403);
  assert.equal((await request("DELETE", "/pins/status", { token: second })).status, 403);
  assert.equal((await request("PUT", "/pins/status-deploy", { token: second, body: { body: { text: "own key" } } })).status, 200);

  const reply = (await request("POST", "/messages", { token: human, body: { body: { text: "for you" }, reply_to: mine.id } })).json.message;
  assert.deepEqual(reply.mentions, [mine.agent.id]);
  const inbox = async (token: string) => (await request("GET", "/messages?sender=human&since=0", { token })).json.messages.map((m: any) => m.body.text);
  assert.ok((await inbox(agent)).includes("for you"));
  assert.ok(!(await inbox(second)).includes("for you"));
  const history = (await request("GET", "/messages", { token: second })).json.messages.map((m: any) => m.body.text);
  assert.ok(history.includes("for you"));
});

test("agents already in a channel are told when another one joins", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const code = (await request("POST", "/pairings", { token: human })).json.code;
  const second = (await request("POST", "/agents/join", { body: { code, label: "Deploy bot" } })).json.agent_token;

  const inbox = async (token: string) => (await request("GET", "/messages?sender=human&since=0", { token })).json.messages;
  const notice = (await inbox(agent)).find((m: any) => m.sender === "system");
  assert.equal(notice?.body.text, "Deploy bot joined the channel.");
  assert.equal((await inbox(second)).length, 0);
  assert.ok((await request("GET", "/messages", { token: human })).json.messages.some((m: any) => m.sender === "system"));
});

test("a human message that mentions agents only reaches those agents", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const code = (await request("POST", "/pairings", { token: human })).json.code;
  const second = (await request("POST", "/agents/join", { body: { code } })).json.agent_token;
  const agents = (await request("GET", "/agents", { token: human })).json.agents;
  const secondId = agents.find((a: any) => a.id !== (agents[0].id)).id;

  assert.equal((await request("POST", "/messages", { token: human, body: { body: { text: "@x" }, mentions: ["nope"] } })).status, 400);
  assert.equal((await request("POST", "/messages", { token: agent, body: { body: { text: "hi" }, mentions: [secondId] } })).status, 400);

  const all = (await request("POST", "/messages", { token: human, body: { body: { text: "everyone" } } })).json.message;
  const targeted = (await request("POST", "/messages", { token: human, body: { body: { text: "@Deploy only you" }, mentions: [secondId, secondId] } })).json.message;
  assert.deepEqual(targeted.mentions, [secondId]);
  assert.deepEqual(all.mentions, []);

  const inbox = async (token: string) => {
    const res = (await request("GET", "/messages?sender=human&since=0", { token })).json;
    return { ...res, messages: res.messages.filter((m: any) => m.sender === "human") };
  };
  const first = await inbox(agent);
  assert.deepEqual(first.messages.map((m: any) => m.body.text), ["everyone"]);
  assert.equal(first.cursor, targeted.seq);
  assert.deepEqual((await inbox(second)).messages.map((m: any) => m.body.text), ["everyone", "@Deploy only you"]);

  const state = (await request("GET", "/messages", { token: human })).json.messages.find((m: any) => m.id === targeted.id).state;
  assert.equal(state, "seen");
});

test("a question is answered once and the agent's wait returns the answer", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();

  const ask = await request("POST", "/messages", { token: agent, body: { body: { text: "Publish?", blocks: [choice()] } } });
  assert.deepEqual(ask.json.message.ask, { status: "open", expires_at: null, answer_id: null });
  const id = ask.json.message.id;

  const waiting = request("GET", `/asks/${id}?wait=5`, { token: agent });
  await delay(50);
  const answer = await request("POST", "/messages", { token: human, body: { reply_to: id, body: { answers: { choice: "Yes" } } } });
  assert.equal(answer.status, 201);

  const { json } = await waiting;
  assert.equal(json.message.ask.status, "answered");
  assert.deepEqual(json.answer.body.answers, { choice: "Yes" });

  const second = await request("POST", "/messages", { token: human, body: { reply_to: id, body: { answers: { choice: "No" } } } });
  assert.equal(second.status, 409);
  assert.match(second.json.error, /already answered/);
});

test("several questions in one message are answered together", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const blocks = [choice("publish"), { type: "text_input", id: "slug", label: "Slug" }, { type: "toggle", id: "blog", label: "Blog?" }];
  const ask = await request("POST", "/messages", { token: agent, body: { body: { text: "New page", blocks } } });

  await request("POST", "/messages", {
    token: human,
    body: { reply_to: ask.json.message.id, body: { answers: { publish: "Yes", slug: "pricing", blog: true } } },
  });
  const { json } = await request("GET", `/asks/${ask.json.message.id}`, { token: agent });
  assert.deepEqual(json.answer.body.answers, { publish: "Yes", slug: "pricing", blog: true });
});

test("questions expire and can be cancelled", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();

  const expiring = await request("POST", "/messages", {
    token: agent,
    body: { body: { text: "Quick?", blocks: [choice()] }, ask: { expires_at: Date.now() + 150 } },
  });
  const started = Date.now();
  const waited = await request("GET", `/asks/${expiring.json.message.id}?wait=30`, { token: agent });
  assert.equal(waited.json.message.ask.status, "expired");
  assert.ok(Date.now() - started < 3000, "the wait stops when the question expires");
  const late = await request("POST", "/messages", { token: human, body: { reply_to: expiring.json.message.id, body: { answers: { choice: "Yes" } } } });
  assert.equal(late.status, 409);
  assert.match(late.json.error, /already expired/);

  const open = await request("POST", "/messages", { token: agent, body: { body: { text: "Later?", blocks: [choice()] } } });
  assert.deepEqual((await request("GET", "/asks", { token: agent })).json.messages.map((m: any) => m.id), [open.json.message.id]);
  assert.equal((await request("POST", `/messages/${open.json.message.id}/cancel`, { token: agent })).json.message.ask.status, "cancelled");
  assert.equal((await request("POST", "/messages", { token: human, body: { reply_to: open.json.message.id, body: { answers: { choice: "No" } } } })).status, 409);
  assert.equal((await request("GET", "/asks", { token: agent })).json.messages.length, 0);
});

test("blocks: unknown types pass, invalid known types and duplicate input ids fail", async () => {
  const { request, ownedChannel } = await setup();
  const { agent } = await ownedChannel();
  const post = (body: unknown) => request("POST", "/messages", { token: agent, body: { body } });

  const unknown = await post({ blocks: [{ type: "hologram", id: "h", depth: 3 }] });
  assert.equal(unknown.status, 201);
  assert.equal(unknown.json.message.ask, null);
  assert.equal((await post({ blocks: [{ type: "progress", value: "lots" }] })).status, 400);
  assert.equal((await post({ blocks: [{ type: "choice", options: [] }] })).status, 400);
  assert.equal((await post({ blocks: [choice("a"), choice("a")] })).status, 400);
  assert.equal((await post({ text: "plain" })).json.message.ask, null);
  assert.notEqual((await post({ blocks: [{ type: "html", id: "chart", question: true, html: "<b>hi</b>" }] })).json.message.ask, null);
  assert.equal((await post({ blocks: [{ type: "html", id: "chart", html: "<b>hi</b>" }] })).json.message.ask, null);
});

test("inbox marks messages seen, the agent can acknowledge progress", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const sent = await request("POST", "/messages", { token: human, body: { body: { text: "add project X" } } });
  assert.equal(sent.json.message.state, null);

  const peek = await request("GET", "/messages?since=0&sender=human&peek=1", { token: agent });
  assert.equal(peek.json.messages[0].state, null);
  const read = await request("GET", "/messages?since=0&sender=human", { token: agent });
  assert.equal(read.json.messages[0].state, "seen");

  const id = sent.json.message.id;
  assert.equal((await request("POST", `/messages/${id}/state`, { token: agent, body: { state: "working" } })).json.message.state, "working");
  const noted = (await request("POST", `/messages/${id}/state`, { token: agent, body: { state: "working", note: "running tests" } })).json.message;
  assert.equal(noted.state_note, "running tests");
  assert.equal((await request("POST", `/messages/${id}/state`, { token: agent, body: { state: "working" } })).json.message.state_note, null);
  assert.equal((await request("POST", `/messages/${id}/state`, { token: human, body: { state: "done" } })).status, 403);
  const own = await request("POST", "/messages", { token: agent, body: { body: { text: "hi" } } });
  assert.equal(noted.state_agent_id, own.json.message.agent.id);
  assert.equal((await request("POST", `/messages/${own.json.message.id}/state`, { token: agent, body: { state: "done" } })).status, 400);
  const fromHuman = await request("GET", "/messages", { token: human });
  assert.equal(fromHuman.json.messages[0].state, "working");
});

test("agents edit their messages and edits reach sync", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const msg = await request("POST", "/messages", {
    token: agent,
    body: { body: { text: "Deploying", blocks: [{ type: "progress", id: "p", value: 1, max: 10 }] } },
  });
  const id = msg.json.message.id;
  const initial = await request("POST", "/sync", { token: human, body: {} });

  const waiting = request("POST", "/sync", { token: human, body: { cursor: initial.json.cursor, wait: 5 } });
  await delay(50);
  const patched = await request("PATCH", `/messages/${id}`, { token: agent, body: { text: "Deploying…", block_patches: [{ id: "p", value: 7 }] } });
  assert.equal(patched.json.message.body.blocks[0].value, 7);
  assert.ok(patched.json.message.updated_at);

  const synced = (await waiting).json;
  assert.equal(synced.messages.length, 1);
  assert.equal(synced.messages[0].body.text, "Deploying…");

  const replaced = await request("PUT", `/messages/${id}`, { token: agent, body: { body: { text: "Done" } } });
  assert.deepEqual(replaced.json.message.body, { text: "Done" });
  assert.equal((await request("PATCH", `/messages/${id}`, { token: human, body: { text: "x" } })).status, 403);
  assert.equal((await request("PATCH", `/messages/${id}`, { token: agent, body: { block_patches: [{ id: "nope" }] } })).status, 400);
});

test("pinned messages are managed by key, kept out of the thread and removable", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();

  await request("PUT", "/pins/status", {
    token: agent,
    body: { body: { title: "SEO", blocks: [{ type: "progress", id: "pages", value: 10 }] } },
  });
  await request("PUT", "/pins/todo", { token: agent, body: { body: { text: "- ship v2" } } });
  assert.equal((await request("PATCH", "/pins/status", { token: agent, body: { block_patches: [{ id: "pages", value: 42 }] } })).status, 200);
  assert.equal((await request("PATCH", "/pins/status", { token: agent, body: { block_patches: [{ id: "pages", value: "lots" }] } })).status, 400);
  assert.equal((await request("PUT", "/pins/Bad Key", { token: agent, body: { body: { text: "x" } } })).status, 400);
  assert.equal((await request("PUT", "/pins/status", { token: human, body: { body: { text: "x" } } })).status, 403);

  const pins = (await request("GET", "/pins", { token: human })).json.messages;
  assert.deepEqual(pins.map((m: any) => m.pin), ["status", "todo"]);
  assert.equal(pins[0].body.blocks[0].value, 42);
  assert.equal((await request("GET", "/messages", { token: human })).json.messages.length, 0);

  const initial = await request("POST", "/sync", { token: human, body: {} });
  assert.equal((await request("DELETE", "/pins/todo", { token: agent })).status, 204);
  const synced = await request("POST", "/sync", { token: human, body: { cursor: initial.json.cursor } });
  assert.equal(synced.json.messages[0].pin, "todo");
  assert.ok(synced.json.messages[0].deleted_at);
  assert.deepEqual((await request("GET", "/pins", { token: human })).json.messages.map((m: any) => m.pin), ["status"]);
});

test("agents delete their own messages, which also withdraws questions", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const ask = await request("POST", "/messages", { token: agent, body: { body: { text: "Oops", blocks: [choice()] } } });
  const id = ask.json.message.id;
  const mine = await request("POST", "/messages", { token: human, body: { body: { text: "hi" } } });

  assert.equal((await request("DELETE", `/messages/${mine.json.message.id}`, { token: agent })).status, 400);
  assert.equal((await request("DELETE", `/messages/${id}`, { token: human })).status, 403);
  assert.equal((await request("DELETE", `/messages/${id}`, { token: agent })).status, 204);
  assert.deepEqual((await request("GET", "/messages", { token: human })).json.messages.map((m: any) => m.body.text), ["hi"]);
  assert.equal((await request("POST", "/messages", { token: human, body: { reply_to: id, body: { answers: { choice: "Yes" } } } })).status, 404);
  assert.equal((await request("GET", "/asks", { token: agent })).json.messages.length, 0);
});

test("sync covers all of the user's channels and wakes when the channel list changes", async () => {
  const { request, ownedChannel } = await setup();
  const a = await ownedChannel("a");
  const b = await ownedChannel("b", a.human);

  const initial = await request("POST", "/sync", { token: a.human, body: {} });
  assert.equal(initial.json.messages.length, 0);
  assert.deepEqual(initial.json.channels.sort(), [a.channel.id, b.channel.id].sort());

  const waiting = request("POST", "/sync", { token: a.human, body: { cursor: initial.json.cursor, wait: 5 } });
  await delay(50);
  await request("POST", "/messages", { token: b.agent, body: { body: { text: "from b" } } });
  assert.deepEqual((await waiting).json.messages.map((m: any) => m.body.text), ["from b"]);

  const cursor = (await request("POST", "/sync", { token: a.human, body: {} })).json.cursor;
  const listChange = request("POST", "/sync", { token: a.human, body: { cursor, wait: 5 } });
  await delay(50);
  const started = Date.now();
  await request("POST", "/channels", { token: a.human, body: { name: "c" } });
  const changed = await listChange;
  assert.ok(Date.now() - started < 1000);
  assert.equal(changed.json.channels.length, 3);
});

test("the account export has every channel with its messages, agents and storage", async () => {
  const { request, ownedChannel } = await setup();
  const { human, agent } = await ownedChannel("seo");
  await request("POST", "/messages", { token: agent, body: { body: { text: "hello" } } });
  await request("POST", "/messages", { token: human, body: { body: { text: "hi back" } } });
  await request("PUT", "/storage/dash", { token: human, body: { value: { tab: "runs" } } });
  assert.equal((await request("GET", "/account/export")).status, 401);
  const res = await request("GET", "/account/export", { token: human });
  assert.equal(res.status, 200);
  const [channel] = res.json.channels;
  assert.equal(res.json.user.email, "user1@example.com");
  assert.equal(channel.name, "seo");
  assert.equal(channel.role, "owner");
  assert.deepEqual(channel.messages.map((m: any) => m.body.text), ["hello", "hi back"]);
  assert.equal(channel.agents.length, 1);
  assert.equal(JSON.stringify(res.json).includes("token_hash"), false);
  assert.deepEqual(channel.app_storage, { dash: { tab: "runs" } });
});

test("deleting an account deletes the channels it owns and leaves the others", async () => {
  const { mkdtemp, readdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createDirectoryStore } = await import("../src/files/store.ts");
  const dir = await mkdtemp(join(tmpdir(), "rply-files-"));
  const { db, request, ownedChannel, signUp, upload } = await setup({ files: { store: createDirectoryStore(dir), maxSize: 1024, totalLimit: 4096, retentionMs: null } });
  const mine = await ownedChannel("mine");
  const theirs = await ownedChannel("theirs");
  const me = (await request("GET", "/channels", { token: mine.human })).json.channels[0];
  const myUserId = (await db.selectFrom("channel_members").select("user_id").where("channel_id", "=", me.id).executeTakeFirstOrThrow()).user_id;
  await db.insertInto("channel_members").values({ channel_id: theirs.channel.id, user_id: myUserId, role: "member", created_at: Date.now() }).execute();
  await upload(mine.agent, "a.txt", "hello");

  const del = (body: unknown) => request("POST", "/auth/delete-user", { token: mine.human, body });
  assert.equal((await del({ password: "wrong password" })).status, 400);
  assert.equal((await del({ password: "correct horse" })).status, 200);

  assert.equal((await request("GET", "/channel", { token: mine.agent })).status, 401);
  assert.equal((await request("GET", "/channel", { token: theirs.agent })).status, 200);
  assert.deepEqual((await db.selectFrom("channel_members").select("user_id").where("channel_id", "=", theirs.channel.id).execute()).length, 1);
  assert.equal((await db.selectFrom("files").select("id").execute()).length, 0);
  assert.deepEqual(await readdir(dir), []);
  assert.equal((await request("GET", "/channels", { token: mine.human })).status, 401);
  assert.equal((await signUp("user1@example.com")).status, 200);
});

test("only the owner deletes a channel, which removes it for everyone", async () => {
  const { db, request, ownedChannel, signUp } = await setup();
  const { channel, agent, human } = await ownedChannel();
  await request("POST", "/messages", { token: agent, body: { body: { text: "hi" } } });
  const member = await signUp();
  await db.insertInto("channel_members").values({ channel_id: channel.id, user_id: member.json.user.id, role: "member", created_at: Date.now() }).execute();
  const asMember = { token: member.token!, headers: { "x-rply-channel": channel.id } };
  assert.equal((await request("GET", "/messages", asMember)).status, 200);
  assert.equal((await request("DELETE", "/channel", asMember)).status, 403);
  assert.equal((await request("POST", "/pairings", asMember)).status, 403);

  assert.equal((await request("DELETE", "/channel", { token: agent })).status, 403);
  assert.equal((await request("DELETE", "/channel", { token: human })).status, 204);
  assert.equal((await request("DELETE", "/channel", { token: human })).status, 404);
  assert.equal((await request("GET", "/messages", { token: agent })).status, 401);
  assert.deepEqual((await request("POST", "/sync", { token: member.token!, body: {} })).json.channels, []);
  const { count } = await db.selectFrom("messages").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow();
  assert.equal(Number(count), 0);
});

test("embeds send events that reach the agent's inbox without being answers", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const dashboard = await request("POST", "/messages", {
    token: agent,
    body: { body: { blocks: [{ type: "html", id: "dash", html: "<button onclick=\"rply.send('x')\">x</button>" }] } },
  });
  assert.equal(dashboard.json.message.ask, null);
  const id = dashboard.json.message.id;

  const event = (body: unknown) => request("POST", "/messages", { token: human, body });
  assert.equal((await event({ reply_to: id, body: { event: { block_id: "dash", value: { page: "/pricing" } } } })).status, 201);
  assert.equal((await event({ reply_to: id, body: { event: { block_id: "dash", value: { page: "/about" } } } })).status, 201);
  assert.equal((await event({ body: { event: { block_id: "dash", value: 1 } } })).status, 400);

  const inbox = await request("GET", "/messages?since=0&sender=human", { token: agent });
  assert.deepEqual(inbox.json.messages.map((m: any) => m.body.event.value.page), ["/pricing", "/about"]);

  const ask = await request("POST", "/messages", { token: agent, body: { body: { text: "Pick", blocks: [{ type: "html", id: "q", question: true, html: "<b>q</b>" }] } } });
  assert.equal(ask.json.message.ask.status, "open");
  await event({ reply_to: ask.json.message.id, body: { event: { block_id: "q", value: "hover" } } });
  assert.equal((await request("GET", `/asks/${ask.json.message.id}`, { token: agent })).json.message.ask.status, "open");
  assert.equal((await request("POST", "/messages", { token: agent, body: { body: { blocks: [{ type: "html", question: true, html: "x" }] } } })).status, 400);
});

test("the human can unpin a message, which moves it into the thread", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const pinned = await request("PUT", "/pins/status", { token: agent, body: { body: { text: "Overview" } } });
  const id = pinned.json.message.id;

  const initial = await request("POST", "/sync", { token: human, body: {} });
  const unpinned = await request("POST", `/messages/${id}/unpin`, { token: human });
  assert.equal(unpinned.json.message.pin, null);
  assert.equal((await request("POST", `/messages/${id}/unpin`, { token: human })).status, 400);

  assert.equal((await request("GET", "/pins", { token: human })).json.messages.length, 0);
  assert.deepEqual((await request("GET", "/messages", { token: human })).json.messages.map((m: any) => m.body.text), ["Overview"]);
  const synced = await request("POST", "/sync", { token: human, body: { cursor: initial.json.cursor } });
  assert.equal(synced.json.messages[0].pin, null);

  const patch = await request("PATCH", "/pins/status", { token: agent, body: { text: "x" } });
  assert.equal(patch.status, 404);
  assert.match(patch.json.error, /unpinned/);
  assert.notEqual((await request("PUT", "/pins/status", { token: agent, body: { body: { text: "New" } } })).json.message.id, id);
});

test("secrets travel sealed to the agent's key and are deleted after delivery", async () => {
  const { generateKeyPair, open, seal } = await import("@rply/schema/crypto");
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const keys = generateKeyPair();

  const request_ = { name: "OPENAI_API_KEY", target: "/srv/app/.env", mode: "env", reason: "keyword research" };
  assert.equal((await request("POST", "/secrets", { token: agent, body: request_ })).status, 400);
  assert.equal((await request("PUT", "/channel/key", { token: agent, body: { public_key: "nope" } })).status, 400);
  await request("PUT", "/channel/key", { token: agent, body: { public_key: keys.publicKey } });
  assert.equal((await request("POST", "/secrets", { token: agent, body: { ...request_, name: "BAD-NAME" } })).status, 400);

  const created = await request("POST", "/secrets", { token: agent, body: request_ });
  assert.equal(created.status, 201);
  const id = created.json.id;
  assert.equal(created.json.message.body.blocks[0].status, "open");

  const publicKey = created.json.message.body.blocks[0].public_key;
  assert.equal(publicKey, keys.publicKey);

  const waiting = request("GET", `/secrets/${id}?wait=5`, { token: agent });
  await delay(50);
  assert.equal((await request("POST", `/secrets/${id}/fulfil`, { token: agent, body: { ciphertext: "x" } })).status, 403);
  assert.equal((await request("POST", `/secrets/${id}/fulfil`, { token: human, body: { ciphertext: seal("sk-123", publicKey) } })).status, 204);
  const got = (await waiting).json;
  assert.equal(got.status, "provided");
  assert.equal(open(got.ciphertext, keys.secretKey), "sk-123");

  assert.equal((await request("POST", `/secrets/${id}/fulfil`, { token: human, body: { ciphertext: "again" } })).status, 409);
  assert.equal((await request("POST", `/secrets/${id}/delivered`, { token: agent })).status, 204);
  const after = (await request("GET", `/secrets/${id}`, { token: agent })).json;
  assert.equal(after.status, "delivered");
  assert.equal(after.ciphertext, null);
  const shown = (await request("GET", "/messages", { token: human })).json.messages[0];
  assert.equal(shown.body.blocks[0].status, "delivered");
  assert.equal(JSON.stringify(shown).includes("sk-123"), false);
});

test("each secret request carries the key of the agent that asked", async () => {
  const { generateKeyPair } = await import("@rply/schema/crypto");
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const code = (await request("POST", "/pairings", { token: human, body: { role: "agent" } })).json.code;
  const second = (await request("POST", "/agents/join", { body: { code } })).json.agent_token;
  const [a, b] = [generateKeyPair().publicKey, generateKeyPair().publicKey];
  await request("PUT", "/channel/key", { token: agent, body: { public_key: a } });
  await request("PUT", "/channel/key", { token: second, body: { public_key: b } });

  const body = { name: "TOKEN", target: "/tmp/.env", mode: "env" };
  const first = await request("POST", "/secrets", { token: agent, body });
  const other = await request("POST", "/secrets", { token: second, body });
  assert.equal(first.json.message.body.blocks[0].public_key, a);
  assert.equal(other.json.message.body.blocks[0].public_key, b);
});

test("secret requests can be declined, cancelled, expire, and can't be faked", async () => {
  const { generateKeyPair } = await import("@rply/schema/crypto");
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  await request("PUT", "/channel/key", { token: agent, body: { public_key: generateKeyPair().publicKey } });
  const create = (extra = {}) => request("POST", "/secrets", { token: agent, body: { name: "TOKEN", target: "/tmp/.env", mode: "env", ...extra } }).then((r) => r.json);

  const declined = await create();
  assert.equal((await request("POST", `/secrets/${declined.id}/decline`, { token: human })).status, 204);
  assert.equal((await request("GET", `/secrets/${declined.id}`, { token: agent })).json.status, "declined");

  const cancelled = await create();
  assert.equal((await request("POST", `/secrets/${cancelled.id}/cancel`, { token: agent })).status, 204);
  assert.equal((await request("POST", `/secrets/${cancelled.id}/fulfil`, { token: human, body: { ciphertext: "x" } })).status, 409);

  const expiring = await create({ expires_at: Date.now() + 100 });
  const waited = await request("GET", `/secrets/${expiring.id}?wait=30`, { token: agent });
  assert.equal(waited.json.status, "expired");
  assert.equal((await request("POST", `/secrets/${expiring.id}/fulfil`, { token: human, body: { ciphertext: "x" } })).status, 409);

  const deleted = await create();
  await request("DELETE", `/messages/${deleted.message.id}`, { token: agent });
  assert.equal((await request("GET", `/secrets/${deleted.id}`, { token: agent })).json.status, "cancelled");

  const fake = { type: "secret", id: "s", name: "X", target: "/x", mode: "env", status: "open", expires_at: null };
  assert.equal((await request("POST", "/messages", { token: agent, body: { body: { blocks: [fake] } } })).status, 400);
  assert.equal((await request("PUT", "/pins/x", { token: agent, body: { body: { blocks: [fake] } } })).status, 400);
  assert.equal((await request("PATCH", `/messages/${declined.message.id}`, { token: agent, body: { text: "edit" } })).status, 400);
});

test("files: upload, attach, download with auth and safe headers, delete with the message", async () => {
  const { mkdtemp, readdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createDirectoryStore } = await import("../src/files/store.ts");
  const dir = await mkdtemp(join(tmpdir(), "rply-files-"));
  const files = { store: createDirectoryStore(dir), maxSize: 1024, totalLimit: 2500, retentionMs: null };
  const { request, ownedChannel, upload, download, deps } = await setup({ files });
  const a = await ownedChannel("a");
  const b = await ownedChannel("b");

  assert.deepEqual((await request("GET", "/info")).json.files, { enabled: true, max_size: 1024 });
  const png = await upload(a.agent, "chart.png", new Uint8Array([137, 80, 78, 71]), "image/png");
  assert.equal(png.status, 201);
  const svg = await upload(a.agent, "evil.svg", "<svg onload=alert(1)>", "image/svg+xml");
  assert.equal((await upload(a.agent, "big.bin", new Uint8Array(2000))).status, 413);

  const msg = await request("POST", "/messages", {
    token: a.agent,
    body: { body: { text: "Report", blocks: [{ type: "image", file_id: png.json.file.file_id }, { type: "file", file_id: svg.json.file.file_id, name: "evil.svg" }] } },
  });
  assert.equal(msg.status, 201);
  assert.equal((await request("POST", "/messages", { token: a.agent, body: { body: { blocks: [{ type: "image", file_id: "nope" }] } } })).status, 400);
  const foreign = await upload(b.agent, "b.txt", "b");
  assert.equal((await request("POST", "/messages", { token: a.agent, body: { body: { blocks: [{ type: "file", file_id: foreign.json.file.file_id, name: "b" }] } } })).status, 400);

  const image = await download(a.human, png.json.file.file_id);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.match(image.headers.get("content-disposition")!, /^inline/);
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [137, 80, 78, 71]);
  const clip = await upload(a.agent, "demo.mp4", new Uint8Array([0, 0, 0, 24]), "video/mp4");
  const video = await download(a.human, clip.json.file.file_id);
  assert.equal(video.headers.get("content-type"), "video/mp4");
  assert.match(video.headers.get("content-disposition")!, /^inline/);
  const unsafe = await download(a.human, svg.json.file.file_id);
  assert.equal(unsafe.headers.get("content-type"), "application/octet-stream");
  assert.match(unsafe.headers.get("content-disposition")!, /^attachment/);
  assert.equal(unsafe.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await download(b.human, png.json.file.file_id)).status, 404);
  assert.equal((await download("nope", png.json.file.file_id)).status, 401);

  const fromHuman = await upload(a.human, "brief.pdf", "%PDF", "application/pdf");
  const attachment = { file_id: fromHuman.json.file.file_id, name: "brief.pdf", mime: "application/pdf", size: 4 };
  assert.equal((await request("POST", "/messages", { token: a.human, body: { body: { attachments: [attachment] } } })).status, 201);
  assert.equal((await download(a.agent, attachment.file_id)).status, 200);

  await upload(a.agent, "x", new Uint8Array(1000));
  await upload(a.agent, "y", new Uint8Array(1000));
  assert.equal((await upload(a.agent, "z", new Uint8Array(1000))).status, 507);

  assert.equal((await request("DELETE", `/messages/${msg.json.message.id}`, { token: a.agent })).status, 204);
  assert.equal((await download(a.human, png.json.file.file_id)).status, 410);
  assert.equal((await readdir(dir)).includes(png.json.file.file_id), false);

  const { sweepFiles } = await import("../src/files/manage.ts");
  await deps.db.updateTable("files").set({ created_at: 0 }).where("message_id", "is", null).execute();
  assert.ok((await sweepFiles(deps))! >= 2);
});

test("files are refused when the server has them turned off", async () => {
  const { request, ownedChannel, upload } = await setup();
  const { agent } = await ownedChannel();
  assert.deepEqual((await request("GET", "/info")).json.files, { enabled: false, max_size: 0 });
  assert.equal((await upload(agent, "a.txt", "a")).status, 404);
  assert.equal((await request("POST", "/messages", { token: agent, body: { body: { blocks: [{ type: "image", file_id: "x" }] } } })).status, 400);
});

test("web push: agent messages notify subscribed browsers, with suppression and cleanup", async () => {
  const sent: { endpoint: string; payload: any }[] = [];
  let failWith: number | null = null;
  const pushSend = async (target: { endpoint: string }, payload: string) => {
    if (failWith) throw Object.assign(new Error("gone"), { statusCode: failWith });
    sent.push({ endpoint: target.endpoint, payload: JSON.parse(payload) });
  };
  const { db, request, ownedChannel } = await setup({ pushSend });
  const a = await ownedChannel("SEO bot");
  const b = await ownedChannel("Shop agent");
  const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "BKey", auth: "auth" } });
  const flush = () => delay(20);

  assert.ok((await request("GET", "/info")).json.push.public_key);
  assert.equal((await request("PUT", "/push/subscription", { body: { subscription: sub("https://push.example/none") } })).status, 401);
  assert.equal((await request("PUT", "/push/subscription", { token: a.human, body: { subscription: sub("https://push.example/1") } })).status, 204);

  await request("POST", "/messages", { token: a.agent, body: { body: { text: "Publish?", blocks: [choice()] } } });
  await request("POST", "/messages", { token: a.agent, body: { body: { text: "quiet" }, silent: true } });
  await request("POST", "/messages", { token: a.human, body: { body: { text: "from me" } } });
  await request("POST", "/messages", { token: b.agent, body: { body: { text: "other channel" } } });
  await flush();
  assert.deepEqual(sent.map((s) => s.payload), [{ title: "SEO bot", body: "❓ Publish?", url: `/c/${a.channel.id}`, tag: a.channel.id }]);

  sent.length = 0;
  await request("POST", "/sync", { token: a.human, body: { viewing: a.channel.id, push_endpoint: "https://push.example/1" } });
  await request("POST", "/messages", { token: a.agent, body: { body: { text: "while viewing" } } });
  await flush();
  assert.equal(sent.length, 0);
  await request("POST", "/sync", { token: a.human, body: { viewing: null, push_endpoint: "https://push.example/1" } });
  await request("POST", "/messages", { token: a.agent, body: { body: { text: "tab hidden" } } });
  await flush();
  assert.equal(sent[0]?.payload.body, "tab hidden");

  await request("PUT", "/push/subscription", { token: b.human, body: { subscription: sub("https://push.example/b") } });
  sent.length = 0;
  await request("POST", "/messages", { token: b.agent, body: { body: { text: "for b's owner" } } });
  await flush();
  assert.deepEqual(sent.map((s) => s.endpoint), ["https://push.example/b"]);

  const code = (await request("POST", "/pairings", { token: b.human })).json.code;
  const second = (await request("POST", "/agents/join", { body: { code } })).json.agent_token;
  await request("PATCH", "/agent", { token: second, body: { label: "Deploy bot" } });
  sent.length = 0;
  await request("POST", "/messages", { token: second, body: { body: { text: "deployed" } } });
  await flush();
  assert.equal(sent[0]?.payload.title, "Shop agent · Deploy bot");

  failWith = 410;
  await request("POST", "/messages", { token: a.agent, body: { body: { text: "gone" } } });
  await flush();
  assert.deepEqual((await db.selectFrom("push_subscriptions").select("endpoint").execute()).map((r) => r.endpoint), ["https://push.example/b"]);
});

test("web push: only the signed-in owner can delete their subscription", async () => {
  const { db, request, ownedChannel } = await setup({ pushSend: async () => {} });
  const a = await ownedChannel("SEO bot");
  const b = await ownedChannel("Shop agent");
  const endpoint = "https://push.example/owner";
  const sub = (e: string) => ({ endpoint: e, keys: { p256dh: "BKey", auth: "auth" } });
  const endpoints = async () => (await db.selectFrom("push_subscriptions").select("endpoint").execute()).map((r) => r.endpoint);
  await request("PUT", "/push/subscription", { token: a.human, body: { subscription: sub(endpoint) } });
  assert.deepEqual(await endpoints(), [endpoint]);

  assert.equal((await request("DELETE", "/push/subscription", { body: { endpoint } })).status, 401);
  assert.deepEqual(await endpoints(), [endpoint]);

  assert.equal((await request("DELETE", "/push/subscription", { token: b.human, body: { endpoint } })).status, 204);
  assert.deepEqual(await endpoints(), [endpoint]);

  assert.equal((await request("DELETE", "/push/subscription", { token: a.human, body: { endpoint } })).status, 204);
  assert.deepEqual(await endpoints(), []);
});

test("the human renames an agent and picks its bird", async () => {
  const { request, ownedChannel } = await setup();
  const { agent, human } = await ownedChannel();
  const [bot] = (await request("GET", "/agents", { token: human })).json.agents;
  assert.equal(bot.avatar, null);

  const look = { color: 3, crest: 5, eyes: 2, hat: 1, accent: 7, cheeks: true, belly: false };
  assert.equal((await request("PATCH", `/agents/${bot.id}`, { token: human, body: { label: "Scout", avatar: look } })).status, 204);
  const [updated] = (await request("GET", "/agents", { token: agent })).json.agents;
  assert.equal(updated.label, "Scout");
  assert.deepEqual(updated.avatar, look);

  assert.equal((await request("PATCH", `/agents/${bot.id}`, { token: human, body: { avatar: { ...look, hat: 99 } } })).status, 400);
  assert.equal((await request("PATCH", `/agents/${bot.id}`, { token: human, body: {} })).status, 400);
  assert.equal((await request("PATCH", `/agents/${bot.id}`, { token: agent, body: { label: "me" } })).status, 403);
  assert.equal((await request("PATCH", "/agents/nope", { token: human, body: { label: "x" } })).status, 404);
  await request("PATCH", `/agents/${bot.id}`, { token: human, body: { avatar: null } });
  assert.equal((await request("GET", "/agents", { token: human })).json.agents[0].avatar, null);
});

test("feedback lands in the collecting server's channel, and only there", async () => {
  const { deps, request, ownedChannel } = await setup();
  const body = { text: "rply send --blocks should say which block is wrong", from: "agent", version: "0.9.0", contact: "me@example.com" };
  assert.equal((await request("POST", "/feedback", { body })).status, 404);

  const { channel, agent } = await ownedChannel("feedback");
  deps.feedbackChannel = channel.id;
  assert.equal((await request("POST", "/feedback", { body: { ...body, text: " " } })).status, 400);
  assert.equal((await request("POST", "/feedback", { body })).status, 200);

  const [message] = (await request("GET", "/messages", { token: agent })).json.messages;
  assert.equal(message.body.title, "Feedback from an agent");
  assert.equal(message.body.text, body.text);
  assert.deepEqual(message.body.blocks[0].items, [{ key: "Version", value: "0.9.0" }, { key: "Contact", value: "me@example.com" }]);

  const ip = { "x-forwarded-for": "203.0.113.9" };
  for (let i = 0; i < 5; i++) assert.equal((await request("POST", "/feedback", { body, headers: ip })).status, 200);
  assert.equal((await request("POST", "/feedback", { body, headers: ip })).status, 429);
});
