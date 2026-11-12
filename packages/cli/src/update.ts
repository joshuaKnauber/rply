import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import pkg from "../package.json" with { type: "json" };
import { CliError } from "./client.ts";
import { configPath } from "./config.ts";

export const VERSION = pkg.version;
const PACKAGE = pkg.name;

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const cachePath = () => join(dirname(configPath()), "update-check.json");

type Cache = { checked_at: number; latest: string };

export async function checkForUpdate(): Promise<string | undefined> {
  if (process.env.RPLY_NO_UPDATE_CHECK) return undefined;
  let cache = readCache();
  if (!cache || Date.now() - cache.checked_at > CHECK_INTERVAL_MS) {
    const latest = await fetchLatest();
    if (latest) {
      cache = { checked_at: Date.now(), latest };
      writeCache(cache);
    }
  }
  return cache && isNewer(cache.latest, VERSION) ? cache.latest : undefined;
}

export const updateNotice = (latest: string) =>
  `rply: a new version is available (${VERSION} → ${latest}). Run \`rply update\` to install it.`;

export function registerUpdate(program: Command) {
  program
    .command("update")
    .description("update rply to the latest version")
    .action(async () => {
      if (process.argv[1]?.includes("_npx")) {
        return console.log(`You're running rply through npx. Use \`npx ${PACKAGE}@latest\` to get the newest version.`);
      }
      const prefix = installPrefix();
      const args = ["install", "--global", ...(prefix ? ["--prefix", prefix] : []), `${PACKAGE}@latest`];
      const result = spawnSync("npm", args, { stdio: "inherit" });
      if (result.status !== 0) throw new CliError(`Update failed. Try running: npm ${args.join(" ")}`);
      writeCache({ checked_at: 0, latest: VERSION });
      console.log("rply is up to date.");
    });
}

// npm's default prefix isn't always where rply was installed (e.g. `npm i -g --prefix ~/.local` without root)
function installPrefix() {
  try {
    const path = realpathSync(process.argv[1]!).replaceAll("\\", "/");
    return path.match(new RegExp(`^(.*?)(/lib)?/node_modules/${PACKAGE}/`))?.[1];
  } catch {
    return undefined;
  }
}

async function fetchLatest() {
  try {
    const res = await fetch(`https://registry.npmjs.org/${PACKAGE.replace("/", "%2f")}/latest`, { signal: AbortSignal.timeout(1500) });
    return res.ok ? ((await res.json()) as { version: string }).version : undefined;
  } catch {
    return undefined;
  }
}

function readCache(): Cache | undefined {
  try {
    return existsSync(cachePath()) ? JSON.parse(readFileSync(cachePath(), "utf8")) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(cache: Cache) {
  try {
    mkdirSync(dirname(cachePath()), { recursive: true });
    writeFileSync(cachePath(), JSON.stringify(cache));
  } catch {}
}

function isNewer(candidate: string, current: string) {
  const parse = (v: string) => v.split("-")[0]!.split(".").map(Number);
  const [a, b] = [parse(candidate), parse(current)];
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}
