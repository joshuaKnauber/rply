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

test("devices lists the channel's paired human tokens and marks the caller", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();

  const { json } = await request("GET", "/devices", { token: human });
  assert.equal(json.devices.length, 1);
  assert.equal(json.devices[0].current, true);
  assert.ok(json.devices[0].last_seen_at);
  await delay(5);
  assert.equal((await request("GET", "/devices", { token: human })).json.devices[0].last_seen_at, json.devices[0].last_seen_at);
  assert.equal((await request("GET", "/devices", { token: agent })).json.devices[0].current, false);

  const pairing = await request("POST", "/pairings", { token: human });
  assert.equal(pairing.status, 201);
  assert.equal((await request("POST", "/pairings/claim", { body: { code: pairing.json.code, label: "Phone" } })).status, 201);
  assert.equal((await request("GET", "/devices", { token: human })).json.devices.length, 2);
});

test("a channel created in the app gets its agent through a single-use agent code", async () => {
  const { request } = await setup();
  const created = await request("POST", "/channels", { body: { name: "Web", as: "human", label: "Chrome on macOS" } });
  assert.equal(created.status, 201);
  const { token: human, agent_code } = created.json;
  assert.match(human, /^rply_h_/);

  assert.equal((await request("POST", "/pairings/claim", { body: { code: agent_code.code } })).status, 404);
  const joined = await request("POST", "/agents/join", { body: { code: agent_code.code, label: "box-1" } });
  assert.equal(joined.status, 201);
  assert.equal(joined.json.channel.id, created.json.channel.id);
  assert.equal((await request("POST", "/agents/join", { body: { code: agent_code.code } })).status, 404);

  const agent = joined.json.agent_token;
  assert.equal((await request("POST", "/messages", { token: agent, body: { body: { text: "hi" } } })).status, 201);
  const { json } = await request("GET", "/agents", { token: human });
  assert.deepEqual(json.agents.map((a: any) => [a.label, a.current]), [["box-1", false]]);
});

test("the human can add more agents and revoke agents and devices", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();

  assert.equal((await request("POST", "/pairings", { token: agent, body: { role: "agent" } })).status, 403);
  const code = (await request("POST", "/pairings", { token: human, body: { role: "agent" } })).json.code;
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

  const device = (await request("GET", "/devices", { token: human })).json.devices[0].id;
  assert.equal((await request("DELETE", `/devices/${device}`, { token: human })).status, 204);
  assert.equal((await request("GET", "/channel", { token: human })).status, 401);
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
  assert.notEqual((await post({ blocks: [{ type: "html", id: "chart", question: true, html: "<b>hi</b>" }] })).json.message.ask, null);
  assert.equal((await post({ blocks: [{ type: "html", id: "chart", html: "<b>hi</b>" }] })).json.message.ask, null);
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

test("pinned messages are managed by key, kept out of the thread and removable", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();

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

  const initial = await request("POST", "/sync", { body: { tokens: [human] } });
  assert.equal((await request("DELETE", "/pins/todo", { token: agent })).status, 204);
  const synced = await request("POST", "/sync", { body: { tokens: [human], cursor: initial.json.cursor } });
  assert.equal(synced.json.messages[0].pin, "todo");
  assert.ok(synced.json.messages[0].deleted_at);
  assert.deepEqual((await request("GET", "/pins", { token: human })).json.messages.map((m: any) => m.pin), ["status"]);
});

test("agents delete their own messages, which also withdraws questions", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();
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
  assert.equal((await asAdmin("PUT", "/pins/status", a.channel.id, { body: { blocks: [] } })).status, 403);

  const initial = await request("POST", "/sync", { token: "secret", body: { tokens: [] } });
  const waiting = request("POST", "/sync", { token: "secret", body: { tokens: [], cursor: initial.json.cursor, wait: 5 } });
  await delay(50);
  await request("POST", "/messages", { token: a.agent, body: { body: { text: "for admin" } } });
  assert.deepEqual((await waiting).json.messages.map((m: any) => m.body.text), ["for admin"]);
});

test("the owner can delete a channel, which revokes everyone in it", async () => {
  const { db, request, pairedChannel } = await setup();
  const { channel, agent, human } = await pairedChannel();
  await request("POST", "/messages", { token: agent, body: { body: { text: "hi" } } });
  await syncAdminToken(db, "secret");
  assert.equal((await request("DELETE", `/admin/channels/${channel.id}`, { token: human })).status, 401);
  assert.equal((await request("DELETE", `/admin/channels/${channel.id}`, { token: "secret" })).status, 204);
  assert.equal((await request("DELETE", `/admin/channels/${channel.id}`, { token: "secret" })).status, 404);
  assert.equal((await request("GET", "/messages", { token: agent })).status, 401);
  assert.deepEqual((await request("POST", "/sync", { body: { tokens: [human] } })).json.revoked, [human]);
  const { count } = await db.selectFrom("messages").select((eb) => eb.fn.countAll<number>().as("count")).executeTakeFirstOrThrow();
  assert.equal(Number(count), 0);
});

test("embeds send events that reach the agent's inbox without being answers", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();
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
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();
  const pinned = await request("PUT", "/pins/status", { token: agent, body: { body: { text: "Overview" } } });
  const id = pinned.json.message.id;

  const initial = await request("POST", "/sync", { body: { tokens: [human] } });
  const unpinned = await request("POST", `/messages/${id}/unpin`, { token: human });
  assert.equal(unpinned.json.message.pin, null);
  assert.equal((await request("POST", `/messages/${id}/unpin`, { token: human })).status, 400);

  assert.equal((await request("GET", "/pins", { token: human })).json.messages.length, 0);
  assert.deepEqual((await request("GET", "/messages", { token: human })).json.messages.map((m: any) => m.body.text), ["Overview"]);
  const synced = await request("POST", "/sync", { body: { tokens: [human], cursor: initial.json.cursor } });
  assert.equal(synced.json.messages[0].pin, null);

  const patch = await request("PATCH", "/pins/status", { token: agent, body: { text: "x" } });
  assert.equal(patch.status, 404);
  assert.match(patch.json.error, /unpinned/);
  assert.notEqual((await request("PUT", "/pins/status", { token: agent, body: { body: { text: "New" } } })).json.message.id, id);
});

test("secrets travel sealed to the agent's key and are deleted after delivery", async () => {
  const { generateKeyPair, open, seal } = await import("@rply/schema/crypto");
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();
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

  const { channel } = (await request("GET", "/channel", { token: human })).json;
  assert.equal(channel.public_key, keys.publicKey);

  const waiting = request("GET", `/secrets/${id}?wait=5`, { token: agent });
  await delay(50);
  assert.equal((await request("POST", `/secrets/${id}/fulfil`, { token: agent, body: { ciphertext: "x" } })).status, 403);
  assert.equal((await request("POST", `/secrets/${id}/fulfil`, { token: human, body: { ciphertext: seal("sk-123", channel.public_key) } })).status, 204);
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
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();
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
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();
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
  const { request, pairedChannel, upload, download, deps } = await setup({ files });
  const a = await pairedChannel("a");
  const b = await pairedChannel("b");

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
  assert.equal((await download("rply_h_nope", png.json.file.file_id)).status, 401);

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
  const { request, pairedChannel, upload } = await setup();
  const { agent } = await pairedChannel();
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
  const { db, request, pairedChannel } = await setup({ pushSend });
  const a = await pairedChannel("SEO bot");
  const b = await pairedChannel("Shop agent");
  const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "BKey", auth: "auth" } });
  const flush = () => delay(20);

  assert.ok((await request("GET", "/info")).json.push.public_key);
  assert.equal((await request("PUT", "/push/subscription", { body: { subscription: sub("https://push.example/none"), tokens: ["rply_h_bad"] } })).status, 400);
  assert.equal((await request("PUT", "/push/subscription", { body: { subscription: sub("https://push.example/1"), tokens: [a.human] } })).status, 200);

  await request("POST", "/messages", { token: a.agent, body: { body: { text: "Publish?", blocks: [choice()] } } });
  await request("POST", "/messages", { token: a.agent, body: { body: { text: "quiet" }, silent: true } });
  await request("POST", "/messages", { token: a.human, body: { body: { text: "from me" } } });
  await request("POST", "/messages", { token: b.agent, body: { body: { text: "other channel" } } });
  await flush();
  assert.deepEqual(sent.map((s) => s.payload), [{ title: "SEO bot", body: "❓ Publish?", url: `/c/${a.channel.id}`, tag: a.channel.id }]);

  sent.length = 0;
  await request("POST", "/sync", { body: { tokens: [a.human], viewing: a.channel.id, push_endpoint: "https://push.example/1" } });
  await request("POST", "/messages", { token: a.agent, body: { body: { text: "while viewing" } } });
  await flush();
  assert.equal(sent.length, 0);
  await request("POST", "/sync", { body: { tokens: [a.human], viewing: null, push_endpoint: "https://push.example/1" } });
  await request("POST", "/messages", { token: a.agent, body: { body: { text: "tab hidden" } } });
  await flush();
  assert.equal(sent[0]?.payload.body, "tab hidden");

  await syncAdminToken(db, "secret");
  await request("PUT", "/push/subscription", { token: "secret", body: { subscription: sub("https://push.example/owner"), tokens: [] } });
  await syncAdminToken(db, "secret");
  sent.length = 0;
  await request("POST", "/messages", { token: b.agent, body: { body: { text: "for the owner" } } });
  await flush();
  assert.deepEqual(sent.map((s) => s.endpoint), ["https://push.example/owner"]);

  failWith = 410;
  await request("POST", "/messages", { token: a.agent, body: { body: { text: "gone" } } });
  await flush();
  assert.equal((await db.selectFrom("push_subscriptions").select("endpoint").execute()).length, 0);
});
