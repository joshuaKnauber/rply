import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CliError } from "./client.ts";

export type Config = {
  server: string;
  token: string;
  channel?: { id: string; name: string };
  inbox_cursor?: number;
};

export const configPath = () =>
  process.env.RPLY_CONFIG ?? join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "rply", "config.json");

export function readConfig(): Config | undefined {
  const path = configPath();
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
}

export function writeConfig(config: Config) {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function loadConfig(): Config {
  const file = readConfig();
  const server = process.env.RPLY_SERVER ?? file?.server;
  const token = process.env.RPLY_TOKEN ?? file?.token;
  if (!server || !token) throw new CliError("Not set up yet. Run `rply init <server-url>`, or set RPLY_SERVER and RPLY_TOKEN.");
  return { ...file, server: normalizeServer(server), token };
}

export function saveCursor(cursor: number) {
  const file = readConfig();
  if (file) writeConfig({ ...file, inbox_cursor: cursor });
}

export function normalizeServer(input: string) {
  const url = /^https?:\/\//.test(input) ? input : `${/^(localhost|127\.|\[::1\])/.test(input) ? "http" : "https"}://${input}`;
  return url.replace(/\/+$/, "");
}
