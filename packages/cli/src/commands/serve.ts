import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Command } from "commander";
import type { AgentsResponse, CallsResponse, Message, MessagesResponse, PendingCall } from "@rply/schema";
import { isAnswer } from "@rply/schema/helpers";
import { CliError, type Client } from "../client.ts";
import { updateChannel, type Selected } from "../config.ts";
import { connect } from "../context.ts";
import { parseDuration } from "../io.ts";
import { installService, logPath, serviceRunning, uninstallService } from "../service.ts";
import { childEnv, commandsDir, listCommands, runScript } from "../scripts.ts";


type ServeOptions = { dir?: string; onMessage?: string; onMessageTimeout: string; install?: boolean; uninstall?: boolean };

export function registerServe(program: Command) {
  program
    .command("serve")
    .description("run command scripts for apps and wake the agent on new messages (install it as a service with --install)")
    .option("--dir <path>", "folder with command scripts (default: see rply app commands)")
    .option("--on-message <command>", "shell command that wakes the agent when the human writes, e.g. a headless agent run")
    .option("--on-message-timeout <duration>", "stop a wake run after this long, 0 for never", "1h")
    .option("--install", "install as a background service (systemd or launchd) that restarts on crash and reboot")
    .option("--uninstall", "stop and remove the background service")
    .addHelpText(
      "after",
      `
--on-message runs at most once at a time, in the current directory, with the new messages as JSON on stdin
and RPLY_CHANNEL set. Messages that arrive during a run trigger one more run afterwards. Don't start the agent
in the background from the hook (runs would overlap); raise --on-message-timeout for long runs instead.
--install remembers the current directory, PATH and options. Run it from the agent's project directory.`,
    )
    .action(async (opts: ServeOptions) => {
      const { client, selected } = connect();
      const key = selected.key;
      if (opts.uninstall) {
        if (!key) throw new CliError("Services need a saved channel (rply init or rply join)");
        uninstallService(key);
        return console.log(`Removed the service for "${key}"`);
      }
      if (opts.install) return install(client, selected, opts);

      if (key && !process.env.RPLY_SERVICE && serviceRunning(key)) {
        throw new CliError(`The service for "${key}" is already running. Logs: ${logPath(key)}. Remove it with rply serve --uninstall.`);
      }
      const dir = opts.dir ? resolve(opts.dir) : commandsDir(selected);
      mkdirSync(dir, { recursive: true });
      log(`Serving commands from ${dir}`);
      if (opts.onMessage) {
        await warnAboutOtherWakers(client);
        log(`Waking the agent on new messages with: ${opts.onMessage}`);
        const timeout = parseDuration(opts.onMessageTimeout) || undefined;
        watchInbox(client, selected, opts.onMessage, timeout).catch((err) => {
          console.error(`rply: ${err.message}`);
          process.exit(1);
        });
      }
      await client.poll(undefined, async (waitSeconds) => {
        const names = listCommands(dir);
        const wakes = opts.onMessage ? "&wakes=1" : "";
        const { calls } = await client.once<CallsResponse>("GET", `/calls?wait=${waitSeconds}&commands=${names.join(",")}${wakes}`);
        for (const call of calls) void handle(client, dir, call, key);
        return undefined;
      });
    });
}

async function install(client: Client, selected: Selected, opts: ServeOptions) {
  if (!selected.key) throw new CliError("Services need a saved channel (rply init or rply join), not RPLY_SERVER/RPLY_TOKEN");
  if (opts.onMessage) await warnAboutOtherWakers(client);
  const args = [
    ...(opts.dir ? ["--dir", resolve(opts.dir)] : []),
    ...(opts.onMessage ? ["--on-message", opts.onMessage, "--on-message-timeout", opts.onMessageTimeout] : []),
  ];
  const service = installService({ key: selected.key, args, cwd: process.cwd() });
  console.log(`Installed and started ${service.name} (${service.file})`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`Logs: ${logPath(selected.key)}`);
  if (service.warning) console.error(`rply: ${service.warning}`);
}

async function warnAboutOtherWakers(client: Client) {
  const { agents } = await client.request<AgentsResponse>("GET", "/agents");
  const others = agents.filter((a) => !a.current && a.serve?.wakes);
  if (others.length) {
    console.error(`rply: ${others.map((a) => a.label ?? "another agent").join(", ")} already wakes on messages in this channel, so both will handle every message that doesn't @mention one of you.`);
  }
}

const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

async function watchInbox(client: Client, selected: Selected, command: string, timeout: number | undefined) {
  let cursor = selected.config.wake_cursor ?? (await client.request<MessagesResponse>("GET", "/messages?sender=human&limit=1&peek=1")).cursor;
  let running = false;
  let pending: Message[] = [];

  const wake = async (messages: Message[]) => {
    running = true;
    const started = Date.now();
    log(`Waking the agent for ${messages.length} message${messages.length === 1 ? "" : "s"}`);
    const code = await runWake(command, messages, selected.key, timeout);
    log(`Agent run ${code === 0 ? "finished" : `failed (${code})`} after ${Math.round((Date.now() - started) / 1000)}s`);
    running = false;
    if (pending.length) void wake(pending.splice(0));
  };

  await client.poll(undefined, async (waitSeconds) => {
    const res = await client.once<MessagesResponse>("GET", `/messages?sender=human&since=${cursor}&wait=${waitSeconds}&peek=1`);
    cursor = res.cursor;
    updateChannel(selected, { wake_cursor: cursor });
    const fresh = res.messages.filter((m) => !isAnswer(m));
    if (fresh.length) {
      if (running) pending.push(...fresh);
      else void wake(fresh);
    }
    return undefined;
  });
}

function runWake(command: string, messages: Message[], key: string | undefined, timeout: number | undefined) {
  return new Promise<number | string>((done) => {
    const child = spawn("sh", ["-c", command], {
      env: childEnv(key),
      stdio: ["pipe", "inherit", "inherit"],
      timeout,
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(messages));
    child.on("error", (err) => done(err.message));
    child.on("close", (code, signal) => done(signal ? (signal === "SIGTERM" ? "timed out" : signal) : (code ?? 1)));
  });
}

async function handle(client: Client, dir: string, call: PendingCall, key: string | undefined) {
  const started = Date.now();
  const outcome = await runScript(dir, call, key);
  const status = "error" in outcome ? `failed: ${outcome.error}` : "ok";
  log(`${call.name} ${status} (${Date.now() - started}ms)`);
  await client.request("POST", `/calls/${call.id}/result`, outcome).catch((err) => console.error(`rply: ${err.message}`));
}

