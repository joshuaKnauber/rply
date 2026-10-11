import assert from "node:assert/strict";
import { test } from "node:test";
import { syncAdminToken } from "../src/auth.ts";
import { delay, setup } from "./helpers.ts";

const choice = (id = "choice") => ({ type: "choice", id, options: [{ label: "Yes" }, { label: "No" }] });

test("pairing codes are single use and accept sloppy input", async () => {
  const { request } = await setup();
  const { json } = await request("POST", "/channels", { body: { name: "seo" } });
  const sloppy = json.pairing.code.toLowerCase().replace("-", " ");

  const first = await request("POST", "/pairings/claim", { body: { code: sloppy } });
  assert.equal(first.status, 201);
  assert.match(first.json.token, /^rply_h_/);
  assert.equal((await request("POST", "/pairings/claim", { body: { code: json.pairing.code } })).status, 404);
});

test("a question is answered once and the agent's wait returns the answer", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();

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
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();
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
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();

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
  const { request, pairedChannel } = await setup();
  const { agent } = await pairedChannel();
  const post = (body: unknown) => request("POST", "/messages", { token: agent, body: { body } });

  const unknown = await post({ blocks: [{ type: "hologram", id: "h", depth: 3 }] });
  assert.equal(unknown.status, 201);
  assert.equal(unknown.json.message.ask, null);
  assert.equal((await post({ blocks: [{ type: "progress", value: "lots" }] })).status, 400);
  assert.equal((await post({ blocks: [{ type: "choice", options: [] }] })).status, 400);
  assert.equal((await post({ blocks: [choice("a"), choice("a")] })).status, 400);
  assert.equal((await post({ text: "plain" })).json.message.ask, null);
  assert.notEqual((await post({ blocks: [{ type: "html", id: "chart", html: "<b>hi</b>" }] })).json.message.ask, null);
  assert.equal((await post({ blocks: [{ type: "html", html: "<b>hi</b>" }] })).json.message.ask, null);
});

test("inbox marks messages seen, the agent can acknowledge progress", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();
  const sent = await request("POST", "/messages", { token: human, body: { body: { text: "add project X" } } });
  assert.equal(sent.json.message.state, null);

  const peek = await request("GET", "/messages?since=0&sender=human&peek=1", { token: agent });
  assert.equal(peek.json.messages[0].state, null);
  const read = await request("GET", "/messages?since=0&sender=human", { token: agent });
  assert.equal(read.json.messages[0].state, "seen");

  const id = sent.json.message.id;
  assert.equal((await request("POST", `/messages/${id}/state`, { token: agent, body: { state: "working" } })).json.message.state, "working");
  assert.equal((await request("POST", `/messages/${id}/state`, { token: human, body: { state: "done" } })).status, 403);
  const own = await request("POST", "/messages", { token: agent, body: { body: { text: "hi" } } });
  assert.equal((await request("POST", `/messages/${own.json.message.id}/state`, { token: agent, body: { state: "done" } })).status, 400);
  const fromHuman = await request("GET", "/messages", { token: human });
  assert.equal(fromHuman.json.messages[0].state, "working");
});

test("agents edit their messages and edits reach sync", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();
  const msg = await request("POST", "/messages", {
    token: agent,
    body: { body: { text: "Deploying", blocks: [{ type: "progress", id: "p", value: 1, max: 10 }] } },
  });
  const id = msg.json.message.id;
  const initial = await request("POST", "/sync", { body: { tokens: [human] } });

  const waiting = request("POST", "/sync", { body: { tokens: [human], cursor: initial.json.cursor, wait: 5 } });
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

test("the status page is a pinned message kept out of the thread", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();

  await request("PUT", "/status", {
    token: agent,
    body: { body: { blocks: [{ type: "heading", text: "SEO" }, { type: "progress", id: "pages", value: 10 }] } },
  });
  assert.equal((await request("PATCH", "/status", { token: agent, body: { blocks: [{ id: "pages", value: 42 }] } })).status, 200);
  assert.equal((await request("PATCH", "/status", { token: agent, body: { blocks: [{ id: "pages", value: "lots" }] } })).status, 400);

  const { json } = await request("GET", "/status", { token: human });
  assert.equal(json.status.pin, "status");
  assert.equal(json.status.body.blocks[1].value, 42);
  assert.equal((await request("GET", "/messages", { token: human })).json.messages.length, 0);
  assert.equal((await request("GET", "/messages?pinned=1", { token: human })).json.messages.length, 1);
  assert.equal((await request("PUT", "/status", { token: human, body: { body: { blocks: [] } } })).status, 403);
});

test("sync covers several channels and reports revoked tokens", async () => {
  const { request, pairedChannel } = await setup();
  const a = await pairedChannel("a");
  const b = await pairedChannel("b");

  const initial = await request("POST", "/sync", { body: { tokens: [a.human, b.human, "rply_h_gone"] } });
  assert.deepEqual(initial.json.revoked, ["rply_h_gone"]);
  assert.equal(initial.json.messages.length, 0);

  const waiting = request("POST", "/sync", { body: { tokens: [a.human, b.human], cursor: initial.json.cursor, wait: 5 } });
  await delay(50);
  await request("POST", "/messages", { token: b.agent, body: { body: { text: "from b" } } });
  assert.deepEqual((await waiting).json.messages.map((m: any) => m.body.text), ["from b"]);
});

test("channel creation requires the admin token once set", async () => {
  const { db, request } = await setup();
  await syncAdminToken(db, "secret");
  assert.equal((await request("GET", "/info")).json.server_token_required, true);
  assert.equal((await request("POST", "/channels", { body: { name: "x" } })).status, 401);
  assert.equal((await request("POST", "/channels", { token: "secret", body: { name: "x" } })).status, 201);
  await syncAdminToken(db, undefined);
  assert.equal((await request("GET", "/info")).json.server_token_required, false);
});

test("the admin token sees and talks to every channel", async () => {
  const { db, request, pairedChannel } = await setup();
  const a = await pairedChannel("a");
  const b = await pairedChannel("b");
  assert.equal((await request("GET", "/admin/channels", { token: "secret" })).status, 401);
  await syncAdminToken(db, "secret");
  assert.deepEqual((await request("GET", "/admin/channels", { token: "secret" })).json.channels.map((c: any) => c.name), ["a", "b"]);

  const asAdmin = (method: string, path: string, channel: string, body?: unknown) =>
    request(method, path, { token: "secret", body, headers: { "x-rply-channel": channel } });
  await request("POST", "/messages", { token: b.agent, body: { body: { text: "from b" } } });
  assert.deepEqual((await asAdmin("GET", "/messages", b.channel.id)).json.messages.map((m: any) => m.body.text), ["from b"]);
  assert.equal((await asAdmin("POST", "/messages", a.channel.id, { body: { text: "hi a" } })).json.message.sender, "human");
  assert.equal((await asAdmin("PUT", "/status", a.channel.id, { body: { blocks: [] } })).status, 403);

  const initial = await request("POST", "/sync", { token: "secret", body: { tokens: [] } });
  const waiting = request("POST", "/sync", { token: "secret", body: { tokens: [], cursor: initial.json.cursor, wait: 5 } });
  await delay(50);
  await request("POST", "/messages", { token: a.agent, body: { body: { text: "for admin" } } });
  assert.deepEqual((await waiting).json.messages.map((m: any) => m.body.text), ["for admin"]);
});
