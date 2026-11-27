import assert from "node:assert/strict";
import { test } from "node:test";
import { delay, setup } from "./helpers.ts";

// a channel with two agents: the second one is a member with the same rights, and owns nothing of the first
async function twoAgents() {
  const ctx = await setup();
  const ids = await ctx.ownedChannel();
  await ctx.request("PATCH", "/agent", { token: ids.agent, body: { label: "First bot" } });
  const code = (await ctx.request("POST", "/pairings", { token: ids.human })).json.code;
  const second = (await ctx.request("POST", "/agents/join", { body: { code, label: "Second bot" } })).json.agent_token as string;
  return { ...ctx, ...ids, second };
}

const MESSAGE_REFUSAL = /^This message belongs to First bot\. Agents can only change their own messages and pins\.$/;
const PIN_REFUSAL = /^The pin "status" belongs to First bot\. Agents can only change their own messages and pins\. Pin under your own key instead, e\.g\. status-<your name>\.$/;
const CALL_REFUSAL = /^This call belongs to First bot\. Only the agent the call was sent to can answer it\.$/;

test("a second agent in the channel can't change the first agent's messages", async () => {
  const { request, agent, second } = await twoAgents();
  const mine = (await request("POST", "/messages", { token: agent, body: { body: { text: "mine" } } })).json.message;

  const edit = await request("PATCH", `/messages/${mine.id}`, { token: second, body: { text: "hijacked" } });
  assert.equal(edit.status, 403);
  assert.match(edit.json.error, MESSAGE_REFUSAL);
  assert.equal((await request("DELETE", `/messages/${mine.id}`, { token: second })).status, 403);

  const after = await request("GET", "/messages", { token: second });
  assert.equal(after.json.messages.find((m: any) => m.id === mine.id).body.text, "mine");

  assert.equal((await request("PATCH", `/messages/${mine.id}`, { token: agent, body: { text: "edited" } })).json.message.body.text, "edited");
  assert.equal((await request("DELETE", `/messages/${mine.id}`, { token: agent })).status, 204);
});

test("a second agent in the channel can't change the first agent's pin", async () => {
  const { request, agent, second } = await twoAgents();
  assert.equal((await request("PUT", "/pins/status", { token: agent, body: { body: { text: "first" } } })).status, 200);

  const put = await request("PUT", "/pins/status", { token: second, body: { body: { text: "hijacked" } } });
  assert.equal(put.status, 403);
  assert.match(put.json.error, PIN_REFUSAL);
  assert.equal((await request("PATCH", "/pins/status", { token: second, body: { text: "hijacked" } })).status, 403);
  assert.equal((await request("DELETE", "/pins/status", { token: second })).status, 403);

  const { json } = await request("GET", "/pins", { token: second });
  assert.deepEqual(json.messages.map((m: any) => m.body.text), ["first"]);

  assert.equal((await request("PUT", "/pins/status", { token: agent, body: { body: { text: "again" } } })).status, 200);
  assert.equal((await request("PATCH", "/pins/status", { token: agent, body: { text: "patched" } })).status, 200);
  assert.equal((await request("DELETE", "/pins/status", { token: agent })).status, 204);
});

test("only the agent a call was sent to can answer it, stored or relayed", async () => {
  const { request, agent, second, human } = await twoAgents();
  const app = { body: { title: "Dashboard", view: "app", blocks: [{ type: "html", id: "app", html: "<p>hi</p>" }] } };
  const pinned = (await request("PUT", "/pins/dash", { token: agent, body: app })).json.message;

  // a stored call belongs to the agent whose message it replies to
  const stored = (await request("POST", "/calls", { token: human, body: { message_id: pinned.id, block_id: "app", name: "plan", agent: true } })).json;
  assert.equal(stored.status, "pending");
  const forged = await request("POST", `/calls/${stored.id}/result`, { token: second, body: { result: "forged" } });
  assert.equal(forged.status, 403);
  assert.match(forged.json.error, CALL_REFUSAL);
  assert.equal((await request("GET", `/calls/${stored.id}`, { token: human })).json.status, "pending");
  assert.equal((await request("POST", `/calls/${stored.id}/result`, { token: agent, body: { result: "mine" } })).status, 204);
  assert.deepEqual((await request("GET", `/calls/${stored.id}`, { token: human })).json, { id: stored.id, status: "done", result: "mine" });

  // a relayed call belongs to the agent that serves the command for its own app
  const otherPoll = request("GET", "/calls?wait=1&commands=stats", { token: second });
  await delay(20);
  const ownPoll = request("GET", "/calls?wait=5&commands=stats", { token: agent });
  await delay(20);
  const call = request("POST", "/calls", { token: human, body: { message_id: pinned.id, name: "stats" } });
  const id = (await ownPoll).json.calls[0].id as string;
  assert.equal((await otherPoll).json.calls.length, 0);

  const relayed = await request("POST", `/calls/${id}/result`, { token: second, body: { result: "forged" } });
  assert.equal(relayed.status, 403);
  assert.match(relayed.json.error, CALL_REFUSAL);
  assert.equal((await request("POST", `/calls/${id}/result`, { token: agent, body: { result: "mine" } })).status, 204);
  assert.deepEqual((await call).json, { id, status: "done", result: "mine" });
});
