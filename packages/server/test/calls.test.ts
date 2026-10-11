import assert from "node:assert/strict";
import { test } from "node:test";
import { delay, setup } from "./helpers.ts";

const app = { body: { title: "Dashboard", view: "app", blocks: [{ type: "html", id: "app", html: "<p>hi</p>" }] } };

async function withApp() {
  const ctx = await setup();
  const ids = await ctx.pairedChannel();
  const pinned = await ctx.request("PUT", "/pins/dash", { token: ids.agent, body: app });
  assert.equal(pinned.status, 200);
  assert.equal(pinned.json.message.body.view, "app");
  return { ...ctx, ...ids, messageId: pinned.json.message.id as string };
}

test("an agent call goes to the agent's inbox and the agent responds", async () => {
  const { request, agent, human, messageId } = await withApp();

  const posted = await request("POST", "/calls", { token: human, body: { message_id: messageId, block_id: "app", name: "plan", args: { n: 3 }, agent: true } });
  assert.equal(posted.json.status, "pending");
  const id = posted.json.id;

  const inbox = await request("GET", "/messages?sender=human&since=0", { token: agent });
  const call = inbox.json.messages.find((m: any) => m.id === id);
  assert.deepEqual(call.body.call, { name: "plan", block_id: "app", args: { n: 3 } });
  assert.equal(call.reply_to, messageId);

  const waiting = request("GET", `/calls/${id}?wait=5`, { token: human });
  await delay(20);
  assert.equal((await request("POST", `/calls/${id}/result`, { token: agent, body: { result: { pages: 3 } } })).status, 204);
  assert.deepEqual((await waiting).json, { id, status: "done", result: { pages: 3 } });

  assert.equal((await request("POST", `/calls/${id}/result`, { token: agent, body: { result: 1 } })).status, 409);
  const after = await request("GET", "/messages?sender=human&since=0", { token: agent });
  assert.equal(after.json.messages.find((m: any) => m.id === id).state, "done");
});

test("the human can't forge call results through messages", async () => {
  const { request, human, messageId } = await withApp();
  const res = await request("POST", "/messages", { token: human, body: { reply_to: messageId, body: { text: "x", call: { name: "a", result: 1 } } } });
  assert.equal(res.status, 201);
  assert.equal(res.json.message.body.call, undefined);
});

test("calls to registered script commands are relayed to serve without being stored", async () => {
  const { request, agent, human, messageId } = await withApp();

  const poll = request("GET", "/calls?wait=5&commands=stats,bad/name", { token: agent });
  await delay(20);
  const call = request("POST", "/calls", { token: human, body: { message_id: messageId, name: "stats", args: { range: "7d" } } });
  const { json } = await poll;
  assert.equal(json.calls.length, 1);
  assert.deepEqual(json.calls[0].args, { range: "7d" });
  assert.equal(json.calls[0].message_id, messageId);

  assert.equal((await request("POST", `/calls/${json.calls[0].id}/result`, { token: agent, body: { result: { visits: 42 } } })).status, 204);
  assert.deepEqual((await call).json, { id: json.calls[0].id, status: "done", result: { visits: 42 } });

  const errored = request("POST", "/calls", { token: human, body: { message_id: messageId, name: "stats" } });
  const next = await request("GET", "/calls?wait=5&commands=stats", { token: agent });
  await request("POST", `/calls/${next.json.calls[0].id}/result`, { token: agent, body: { error: "disk full" } });
  assert.equal((await errored).json.error, "disk full");

  const inbox = await request("GET", "/messages?sender=human&since=0", { token: agent });
  assert.equal(inbox.json.messages.length, 0);
});

test("script calls never reach the chat: offline without serve, unknown names are errors", async () => {
  const { request, agent, human, messageId } = await withApp();
  const offline = await request("POST", "/calls", { token: human, body: { message_id: messageId, name: "stats" } });
  assert.equal(offline.status, 503);
  assert.equal(offline.json.error, "offline");

  await request("GET", "/calls?wait=0&commands=stats", { token: agent });
  const unknown = await request("POST", "/calls", { token: human, body: { message_id: messageId, name: "plan" } });
  assert.equal(unknown.status, 404);

  const inbox = await request("GET", "/messages?sender=human&since=0", { token: agent });
  assert.equal(inbox.json.messages.length, 0);
});

test("a script command whose serve went away reports offline", async (t) => {
  const { request, agent, human, messageId } = await withApp();
  await request("GET", "/calls?wait=0&commands=stats", { token: agent });
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 60_000 });
  const res = await request("POST", "/calls", { token: human, body: { message_id: messageId, name: "stats" } });
  assert.equal(res.status, 503);
  assert.equal(res.json.error, "offline");
});

test("calls need a valid name, an agent message and the human side", async () => {
  const { request, agent, human, messageId } = await withApp();
  assert.equal((await request("POST", "/calls", { token: human, body: { message_id: messageId, name: "../x" } })).status, 400);
  assert.equal((await request("POST", "/calls", { token: agent, body: { message_id: messageId, name: "x" } })).status, 403);
  const own = await request("POST", "/messages", { token: human, body: { body: { text: "hi" } } });
  assert.equal((await request("POST", "/calls", { token: human, body: { message_id: own.json.message.id, name: "x" } })).status, 400);
  assert.equal((await request("POST", "/calls/nope/result", { token: agent, body: { result: 1 } })).status, 404);
});

test("the human can remove apps but not other pins", async () => {
  const { request, agent, human } = await withApp();
  await request("PUT", "/pins/status", { token: agent, body: { body: { text: "ok" } } });
  assert.equal((await request("DELETE", "/pins/status", { token: human })).status, 403);
  assert.equal((await request("DELETE", "/pins/dash", { token: human })).status, 204);
  const { json } = await request("GET", "/pins", { token: human });
  assert.deepEqual(json.messages.map((m: any) => m.pin), ["status"]);
});
