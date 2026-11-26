import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthError, createClient } from "../src/client.ts";

const REJECTED = "The server doesn't accept this agent's token: the agent was removed or its channel was deleted.";

function stubFetch(status: number, body: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test("a rejected agent token stops the command instead of retrying", async () => {
  const restore = stubFetch(401, { error: "Sign in or use an agent token" });
  const calls: string[] = [];
  const inner = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push(String(url));
    return inner(url, init);
  }) as unknown as typeof fetch;
  try {
    const client = createClient("http://rply.test", "revoked", REJECTED);
    await assert.rejects(client.request("GET", "/agents"), (err: unknown) => {
      assert.ok(err instanceof AuthError);
      assert.equal(err.message, REJECTED);
      assert.equal(err.exitCode, 1);
      return true;
    });
    assert.deepEqual(calls, ["http://rply.test/v1/agents"]);
  } finally {
    restore();
  }
});

test("the installed service exits cleanly so its supervisor does not restart it", () => {
  assert.equal(new AuthError(REJECTED).exitCode, 1);
  process.env.RPLY_SERVICE = "1";
  try {
    assert.equal(new AuthError(REJECTED).exitCode, 0);
  } finally {
    delete process.env.RPLY_SERVICE;
  }
});

test("other server errors still exit with a failure code", async () => {
  const restore = stubFetch(409, { error: "Channel already exists" });
  try {
    const client = createClient("http://rply.test", "token", REJECTED);
    await assert.rejects(client.request("POST", "/channels", {}), (err: unknown) => {
      assert.equal(err instanceof AuthError, false);
      return true;
    });
  } finally {
    restore();
  }
});
