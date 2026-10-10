import assert from "node:assert/strict";
import { test } from "node:test";
import { syncAdminToken } from "../src/auth.ts";
import { delay, setup } from "./helpers.ts";

test("pairing codes are single use and accept sloppy input", async () => {
  const { request } = await setup();
  const { json } = await request("POST", "/channels", { body: { name: "seo" } });
  const sloppy = json.pairing.code.toLowerCase().replace("-", " ");

  const first = await request("POST", "/pairings/claim", { body: { code: sloppy } });
  assert.equal(first.status, 201);
  assert.match(first.json.token, /^rply_h_/);
  assert.equal(first.json.channel.name, "seo");

  const second = await request("POST", "/pairings/claim", { body: { code: json.pairing.code } });
  assert.equal(second.status, 404);
});

test("agent sends, human reads, agent waits for a button reply", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();

  const ask = await request("POST", "/messages", {
    token: agent,
    body: { body: { text: "Publish?", blocks: [{ type: "buttons", id: "choice", options: [{ label: "Yes", value: "yes" }] }] } },
  });
  assert.equal(ask.status, 201);
  const askId = ask.json.message.id;

  const inbox = await request("GET", "/messages", { token: human });
  assert.equal(inbox.json.messages[0].body.text, "Publish?");

  const waiting = request("GET", `/messages/${askId}/replies?wait=5`, { token: agent });
  await delay(50);
  await request("POST", "/messages", {
    token: human,
    body: { reply_to: askId, body: { action: { element_id: "choice", value: "yes" } } },
  });

  const { json } = await waiting;
  assert.equal(json.replies[0].body.action.value, "yes");
});

test("agent inbox only returns human messages after the cursor", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();

  await request("POST", "/messages", { token: agent, body: { body: { text: "hi" } } });
  await request("POST", "/messages", { token: human, body: { body: { text: "add project X" } } });

  const first = await request("GET", "/messages?since=0&sender=human", { token: agent });
  assert.deepEqual(first.json.messages.map((m: any) => m.body.text), ["add project X"]);

  const empty = await request("GET", `/messages?since=${first.json.cursor}&sender=human&wait=0`, { token: agent });
  assert.equal(empty.json.messages.length, 0);
  assert.equal(empty.json.cursor, first.json.cursor);
});

test("roles and validation are enforced", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();

  assert.equal((await request("PUT", "/status", { token: human, body: { body: { blocks: [] } } })).status, 403);
  assert.equal((await request("GET", "/messages", { token: "rply_a_nope" })).status, 401);
  assert.equal((await request("POST", "/messages", { token: agent, body: { body: {} } })).status, 400);
  assert.equal((await request("POST", "/messages", { token: agent, body: { body: { blocks: [{ type: "nope" }] } } })).status, 400);
  assert.equal((await request("POST", "/messages", { token: agent, body: { enc: true, body: "opaque-ciphertext" } })).status, 201);
});

test("status set and patch", async () => {
  const { request, pairedChannel } = await setup();
  const { agent, human } = await pairedChannel();

  await request("PUT", "/status", {
    token: agent,
    body: { body: { blocks: [{ type: "heading", text: "SEO" }, { type: "progress", id: "pages", value: 10, label: "Pages" }] } },
  });
  const patched = await request("PATCH", "/status", { token: agent, body: { blocks: [{ id: "pages", value: 42 }] } });
  assert.equal(patched.status, 200);

  const { json } = await request("GET", "/status", { token: human });
  assert.equal(json.status.body.blocks[1].value, 42);

  const bad = await request("PATCH", "/status", { token: agent, body: { blocks: [{ id: "pages", value: "lots" }] } });
  assert.equal(bad.status, 400);
});

test("sync long-polls across channels and reports revoked tokens", async () => {
  const { request, pairedChannel } = await setup();
  const a = await pairedChannel("a");
  const b = await pairedChannel("b");
  await request("PUT", "/status", { token: a.agent, body: { body: { blocks: [] } } });

  const initial = await request("POST", "/sync", { body: { tokens: [a.human, b.human, "rply_h_gone"] } });
  assert.equal(initial.json.statuses.length, 1);
  assert.equal(initial.json.messages.length, 0);
  assert.deepEqual(initial.json.revoked, ["rply_h_gone"]);

  const waiting = request("POST", "/sync", { body: { tokens: [a.human, b.human], cursor: initial.json.cursor, wait: 5 } });
  await delay(50);
  await request("POST", "/messages", { token: b.agent, body: { body: { text: "from b" } } });

  const { json } = await waiting;
  assert.deepEqual(json.messages.map((m: any) => m.body.text), ["from b"]);
  assert.equal(json.statuses.length, 0);
});

test("channel creation requires the admin token once set", async () => {
  const { db, request } = await setup();
  await syncAdminToken(db, "secret");

  assert.equal((await request("POST", "/channels", { body: { name: "x" } })).status, 401);
  assert.equal((await request("POST", "/channels", { token: "secret", body: { name: "x" } })).status, 201);

  await syncAdminToken(db, undefined);
  assert.equal((await request("POST", "/channels", { body: { name: "x" } })).status, 201);
});
