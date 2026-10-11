import { spawn } from "node:child_process";
import { accessSync, constants, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PendingCall } from "@rply/schema";
import { COMMAND_NAME } from "@rply/schema/helpers";
import { configPath, type Selected } from "./config.ts";

const SCRIPT_TIMEOUT = 30_000;
const MAX_OUTPUT = 4 * 1024 * 1024;

export type Outcome = { result: unknown } | { error: string };

export const commandsDir = (selected: Selected) => join(dirname(configPath()), "commands", selected.key ?? "default");

export function listCommands(dir: string) {
  try {
    return readdirSync(dir).filter((name) => COMMAND_NAME.test(name) && isExecutable(join(dir, name)));
  } catch {
    return [];
  }
}

export function isExecutable(path: string) {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function parseOutput(output: string) {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function childEnv(key: string | undefined, extra: Record<string, string> = {}) {
  const { RPLY_SERVICE: _, ...env } = process.env;
  return { ...env, ...(key && { RPLY_CHANNEL: key }), ...extra };
}

export function runScript(dir: string, call: Pick<PendingCall, "id" | "name" | "args">, key: string | undefined) {
  const path = join(dir, call.name);
  return new Promise<Outcome>((done) => {
    if (!isExecutable(path)) return done({ error: `No command "${call.name}"` });
    const child = spawn(path, [], {
      env: childEnv(key, { RPLY_CALL_NAME: call.name, RPLY_CALL_ID: call.id, RPLY_NO_UPDATE_CHECK: "1", RPLY_NO_GUIDE_HINT: "1" }),
      timeout: SCRIPT_TIMEOUT,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      if (stdout.length <= MAX_OUTPUT) stdout += chunk;
    });
    child.stderr.on("data", (chunk) => (stderr = (stderr + chunk).slice(-4096)));
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(call.args ?? null));
    child.on("error", (err) => done({ error: err.message }));
    child.on("close", (code, signal) => {
      if (signal) return done({ error: signal === "SIGTERM" ? "timed out" : `killed by ${signal}` });
      if (code !== 0) return done({ error: stderr.trim().split("\n").at(-1) || `exited with code ${code}` });
      if (stdout.length > MAX_OUTPUT) return done({ error: "output over 4 MB" });
      done({ result: parseOutput(stdout) });
    });
  });
}
