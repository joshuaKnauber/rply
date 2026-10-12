import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { CallRequest, CallResultRequest, COMMAND_NAME, type Call, type CallResponse, type CallsResponse, type PendingCall } from "@rply/schema";
import { requireAuth } from "../auth.ts";
import { parse, waitParam, type AppEnv, type Deps } from "../context.ts";
import { insertMessage, loadMessage, recordChanges } from "../messages.ts";
import { longPoll } from "../notifier.ts";
import type { Serve, Serves } from "../serves.ts";
import { now, randomId } from "../tokens.ts";

const SCRIPT_TIMEOUT = 35_000;
const MAX_STORED_RESULT = 256 * 1024;

type Waiting = { channelId: string; resolve: (res: CallResponse) => void };

export function callRoutes(deps: Deps, serves: Serves) {
  const { db, notifier } = deps;
  const agent = requireAuth(deps, "agent");
  const human = requireAuth(deps, "human");
  const waiting = new Map<string, Waiting>();

  const callResponse = (id: string, call: Call): CallResponse =>
    call.error !== undefined ? { id, status: "error", error: call.error } : "result" in call ? { id, status: "done", result: call.result } : { id, status: "pending" };

  const loadCall = async (channelId: string, id: string) => {
    const row = await loadMessage(db, channelId, id);
    const call = row.enc ? undefined : (JSON.parse(row.body).call as Call | undefined);
    if (!call) throw new HTTPException(404, { message: "Call not found" });
    return { row, call };
  };

  const waitForAgent = (client: string, channelId: string, id: string, seconds: number, signal: AbortSignal) =>
    longPoll({
      notifier,
      client,
      channelIds: [channelId],
      waitSeconds: seconds,
      signal,
      fetch: async () => callResponse(id, (await loadCall(channelId, id)).call),
      isEmpty: (res) => res.status === "pending",
    });

  const runScript = (server: Serve, agentId: string, call: PendingCall, signal: AbortSignal) =>
    new Promise<CallResponse | undefined>((resolve) => {
      const finish = (res: CallResponse | undefined) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        waiting.delete(call.id);
        server.queue = server.queue.filter((c) => c.id !== call.id);
        resolve(res);
      };
      const abort = () => finish(undefined);
      const timer = setTimeout(abort, SCRIPT_TIMEOUT);
      signal.addEventListener("abort", abort);
      waiting.set(call.id, { channelId: server.channelId, resolve: finish });
      server.queue.push(call);
      notifier.notify(`calls:${agentId}`);
    });

  return new Hono<AppEnv>()
    .post("/calls", human, async (c) => {
      const { channel } = c.var.auth;
      const req = parse(CallRequest, await c.req.json());
      const target = await loadMessage(db, channel.id, req.message_id);
      if (target.sender !== "agent") throw new HTTPException(400, { message: "Calls can only come from agent messages" });

      const id = randomId();
      if (req.agent) await deps.limits.newMessage(channel.id);
      else deps.limits.call(channel.id);
      if (!req.agent) {
        const online = serves.onlineIn(channel.id);
        if (online.length === 0) throw new HTTPException(503, { message: "offline" });
        const [agentId, server] = online.find(([, s]) => s.commands.has(req.name)) ?? [];
        if (!server) throw new HTTPException(404, { message: `No command "${req.name}"` });
        const call: PendingCall = { id, name: req.name, args: req.args, block_id: req.block_id, message_id: target.id };
        const res = await runScript(server, agentId!, call, c.req.raw.signal);
        if (!res) throw new HTTPException(504, { message: "timeout" });
        return c.json(res);
      }

      const call: Call = { name: req.name, block_id: req.block_id, args: req.args };
      await insertMessage(db, {
        id,
        channel_id: channel.id,
        sender: "human",
        enc: 0,
        body: JSON.stringify({ call }),
        reply_to: target.id,
        pin: null,
        state: null,
        created_at: now(),
        updated_at: null,
        deleted_at: null,
      });
      await recordChanges(deps, channel.id, [id]);
      return c.json(await waitForAgent(c.var.auth.userId!, channel.id, id, req.wait ?? 0, c.req.raw.signal));
    })
    .get("/calls/:id", human, async (c) => {
      return c.json(await waitForAgent(c.var.auth.userId!, c.var.auth.channel.id, c.req.param("id"), waitParam(c.req.query("wait")), c.req.raw.signal));
    })
    .get("/calls", agent, async (c) => {
      const { channel, agentId } = c.var.auth;
      const server = serves.register(agentId!, channel.id);
      server.wakes = c.req.query("wakes") === "1";
      server.commands = new Set((c.req.query("commands") ?? "").split(",").filter((name) => COMMAND_NAME.test(name)));
      server.polling++;
      try {
        const calls = await longPoll({
          notifier,
          client: agentId!,
          channelIds: [`calls:${agentId}`],
          waitSeconds: waitParam(c.req.query("wait")),
          signal: c.req.raw.signal,
          fetch: async () => server.queue.splice(0),
          isEmpty: (calls) => calls.length === 0,
        });
        const res: CallsResponse = { calls };
        return c.json(res);
      } finally {
        server.polling--;
        server.seen = Date.now();
      }
    })
    .post("/calls/:id/result", agent, async (c) => {
      const { channel } = c.var.auth;
      const id = c.req.param("id");
      const outcome = parse(CallResultRequest, await c.req.json());

      const script = waiting.get(id);
      if (script && script.channelId === channel.id) {
        script.resolve("error" in outcome ? { id, status: "error", error: outcome.error } : { id, status: "done", result: outcome.result });
        return c.body(null, 204);
      }

      const { row, call } = await loadCall(channel.id, id);
      if (JSON.stringify(outcome).length > MAX_STORED_RESULT) {
        throw new HTTPException(413, { message: "Results of rply.agent calls are stored as messages and limited to 256 KB. Use a command script for large data" });
      }
      if (callResponse(id, call).status !== "pending") throw new HTTPException(409, { message: "This call was already answered" });
      await db
        .updateTable("messages")
        .set({ body: JSON.stringify({ call: { ...call, ...outcome } }), state: "done" })
        .where("id", "=", row.id)
        .execute();
      await recordChanges(deps, channel.id, [row.id]);
      return c.body(null, 204);
    });
}
