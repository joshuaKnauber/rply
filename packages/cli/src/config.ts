import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CliError } from "./client.ts";

export type ChannelConfig = {
  server: string;
  token: string;
  channel?: { id: string; name: string };
  inbox_cursor?: number;
  wake_cursor?: number;
  secret_key?: string;
  public_key?: string;
};

type ConfigFile = { default?: string; channels: Record<string, ChannelConfig> };

// key: a channel saved in the config file; otherwise it comes from RPLY_SERVER/RPLY_TOKEN or a Hermes profile
export type Selected = { key?: string; from?: "env" | "hermes"; config: ChannelConfig };

export const configPath = () =>
  process.env.RPLY_CONFIG ?? join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "rply", "config.json");

export function readConfigFile(): ConfigFile {
  const path = configPath();
  if (!existsSync(path)) return { channels: {} };
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (raw.channels) return raw;
  const key = channelKey(raw.channel?.name ?? "default");
  return { default: key, channels: { [key]: raw } };
}

function writeConfigFile(file: ConfigFile) {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function updateConfigFile(fn: (file: ConfigFile) => void) {
  const file = readConfigFile();
  fn(file);
  writeConfigFile(file);
}

export function selectChannel(requested?: string): Selected {
  if (process.env.RPLY_SERVER && process.env.RPLY_TOKEN) {
    return { from: "env", config: { server: normalizeServer(process.env.RPLY_SERVER), token: process.env.RPLY_TOKEN } };
  }
  const hermes = !requested && hermesChannel();
  if (hermes) return { from: "hermes", config: hermes };
  const file = readConfigFile();
  const keys = Object.keys(file.channels);
  if (keys.length === 0) throw new CliError("Not set up yet. Run `rply init <server-url>`, or set RPLY_SERVER and RPLY_TOKEN.");

  const key = requested ?? file.default ?? (keys.length === 1 ? keys[0] : undefined);
  if (!key) throw new CliError(`Several channels are set up (${keys.join(", ")}). Pick one with --channel or RPLY_CHANNEL.`);
  const config = file.channels[key];
  if (!config) throw new CliError(`No channel "${key}". Set up: ${keys.join(", ")}`);
  return { key, config };
}

// Hermes keeps platform tokens out of the agent's commands but sets HERMES_HOME to the profile, whose
// .env holds the rply plugin's token, so the CLI acts as the same agent as the plugin.
function hermesChannel(): ChannelConfig | undefined {
  const home = process.env.HERMES_HOME;
  if (!home || !existsSync(join(home, ".env"))) return undefined;
  const env = Object.fromEntries(
    readFileSync(join(home, ".env"), "utf8")
      .split("\n")
      .map((line) => line.match(/^\s*(?:export\s+)?(RPLY_[A-Z_]+)\s*=\s*(.*?)\s*$/))
      .filter((m) => m !== null)
      .map(([, name, value]) => [name, value!.replace(/^(["'])(.*)\1$/, "$2")]),
  );
  if (!env.RPLY_TOKEN) return undefined;
  return { server: normalizeServer(env.RPLY_SERVER || "https://app.rply.sh"), token: env.RPLY_TOKEN };
}

export function saveCursor(selected: Selected, cursor: number) {
  updateChannel(selected, { inbox_cursor: cursor });
}

export function updateChannel({ key }: Selected, values: Partial<ChannelConfig>) {
  if (!key) return;
  updateConfigFile((file) => {
    if (file.channels[key]) Object.assign(file.channels[key], values);
  });
}

export const channelKey = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";

export function normalizeServer(input: string) {
  const url = /^https?:\/\//.test(input) ? input : `${/^(localhost|127\.|\[::1\])/.test(input) ? "http" : "https"}://${input}`;
  return url.replace(/\/+$/, "");
}
