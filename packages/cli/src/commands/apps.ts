import { spawn } from "node:child_process";
import { accessSync, constants, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Command } from "commander";
import type { CallsResponse, Message, PendingCall } from "@rply/schema";
import { appTitle, COMMAND_NAME, isApp } from "@rply/schema/helpers";
import { CliError, type Client } from "../client.ts";
import { configPath, type Selected } from "../config.ts";
import { connect, json } from "../context.ts";
import { printJson } from "../io.ts";

const SCRIPT_TIMEOUT = 30_000;
const MAX_OUTPUT = 200 * 1024;

export function registerApps(program: Command) {
  const app = program.command("app").description("full-page HTML apps listed under the channel, e.g. dashboards and control panels");

  app
    .command("set")
    .description("create or replace the app with this key")
    .argument("<key>", "short name, e.g. dashboard")
    .argument("<file|->", "a single HTML file, or - for stdin")
    .option("--title <title>", "tab title (default: the key)")
    .action(async (key: string, source: string, opts: { title?: string }) => {
      const html = readFileSync(source === "-" ? 0 : source, "utf8");
      const { message } = await connect().client.request<{ message: Message }>("PUT", `/pins/${key}`, {
        body: { title: opts.title, view: "app", blocks: [{ type: "html", id: "app", html }] },
      });
      if (json()) return printJson(message);
      console.log(`App "${key}" updated`);
    });

  app
    .command("remove")
    .description("delete the app with this key")
    .argument("<key>")
    .action(async (key: string) => {
      await connect().client.request("DELETE", `/pins/${key}`);
      if (!json()) console.log(`Removed app "${key}"`);
    });

  app
    .command("list")
    .description("list apps")
    .action(async () => {
      const { messages } = await connect().client.request<{ messages: Message[] }>("GET", "/pins");
      const apps = messages.filter(isApp);
      if (json()) return printJson(apps);
      if (apps.length === 0) return console.log("No apps.");
      for (const m of apps) console.log(`${m.pin}  ${appTitle(m)}`);
    });

  app
    .command("commands")
    .description("show the folder for command scripts and the commands in it")
    .action(() => {
      const { selected } = connect();
      const dir = commandsDir(selected);
      const names = listCommands(dir);
      if (json()) return printJson({ dir, commands: names });
      console.log(`Command scripts: ${dir}`);
      console.log(names.length ? names.map((n) => `  ${n}`).join("\n") : "  (none yet)");
    });

  program
    .command("serve")
    .description("run command scripts when an app calls them (keep this running, e.g. with systemd)")
    .option("--dir <path>", "folder with command scripts (default: see rply app commands)")
    .action(async (opts: { dir?: string }) => {
      const { client, selected } = connect();
      const dir = opts.dir ? resolve(opts.dir) : commandsDir(selected);
      mkdirSync(dir, { recursive: true });
      console.log(`Serving commands from ${dir}`);
      await client.poll(undefined, async (waitSeconds) => {
        const names = listCommands(dir);
        const { calls } = await client.once<CallsResponse>("GET", `/calls?wait=${waitSeconds}&commands=${names.join(",")}`);
        for (const call of calls) void handle(client, dir, call);
        return undefined;
      });
    });

  program
    .command("respond")
    .description("answer a call from an app (shown by rply inbox)")
    .argument("<call-id>")
    .argument("[value]", "result as JSON, plain text, or - for stdin")
    .option("--error <message>", "report a failure instead")
    .action(async (id: string, value: string | undefined, opts: { error?: string }) => {
      const body = opts.error !== undefined ? { error: opts.error } : { result: parseOutput(value === "-" ? readFileSync(0, "utf8") : (value ?? "")) };
      await connect().client.request("POST", `/calls/${id}/result`, body);
      if (!json()) console.log("Responded");
    });
}

export const commandsDir = (selected: Selected) => join(dirname(configPath()), "commands", selected.key ?? "default");

function listCommands(dir: string) {
  try {
    return readdirSync(dir).filter((name) => COMMAND_NAME.test(name) && isExecutable(join(dir, name)));
  } catch {
    return [];
  }
}

function isExecutable(path: string) {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function parseOutput(output: string) {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

async function handle(client: Client, dir: string, call: PendingCall) {
  const started = Date.now();
  const outcome = await run(join(dir, call.name), call);
  const status = "error" in outcome ? `failed: ${outcome.error}` : "ok";
  console.log(`${new Date().toLocaleTimeString()} ${call.name} ${status} (${Date.now() - started}ms)`);
  await client.request("POST", `/calls/${call.id}/result`, outcome).catch((err) => console.error(`rply: ${err.message}`));
}

function run(path: string, call: PendingCall) {
  return new Promise<{ result: unknown } | { error: string }>((done) => {
    if (!isExecutable(path)) return done({ error: `No command "${call.name}"` });
    const child = spawn(path, [], {
      env: { ...process.env, RPLY_CALL_NAME: call.name, RPLY_CALL_ID: call.id },
      timeout: SCRIPT_TIMEOUT,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr = (stderr + chunk).slice(-4096)));
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(call.args ?? null));
    child.on("error", (err) => done({ error: err.message }));
    child.on("close", (code, signal) => {
      if (signal) return done({ error: signal === "SIGTERM" ? "timed out" : `killed by ${signal}` });
      if (code !== 0) return done({ error: stderr.trim().split("\n").at(-1) || `exited with code ${code}` });
      if (stdout.length > MAX_OUTPUT) return done({ error: "output too large" });
      done({ result: parseOutput(stdout) });
    });
  });
}
