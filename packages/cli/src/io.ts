import { readFileSync } from "node:fs";
import QRCode from "qrcode";
import { CliError } from "./client.ts";

export function parseDuration(input: string | undefined) {
  if (input === undefined) return undefined;
  const match = input.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/);
  if (!match) throw new CliError(`Invalid duration "${input}", use e.g. 30s, 10m, 1h`);
  const unit = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] ?? "s"]!;
  return Number(match[1]) * unit;
}

export const deadlineFrom = (timeout: string | undefined) => {
  const ms = parseDuration(timeout);
  return ms === undefined ? undefined : Date.now() + ms;
};

export function readJson(source: string): unknown {
  const raw = source === "-" ? readFileSync(0, "utf8") : source.trim().startsWith("{") || source.trim().startsWith("[") ? source : readFileSync(source, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new CliError(`Invalid JSON in ${source === "-" ? "stdin" : source}`);
  }
}

export async function printPairing(server: string, code: string, expiresAt: number) {
  const url = `${server}/pair?c=${code}`;
  const minutes = Math.round((expiresAt - Date.now()) / 60_000);
  console.log(`Pair a device within ${minutes} minutes (single use):`);
  console.log(`  ${url}`);
  console.log(`  or enter code ${code} in the app`);
  if (process.stdout.isTTY) console.log("\n" + (await QRCode.toString(url, { type: "terminal", small: true })));
}

export const printJson = (value: unknown) => console.log(JSON.stringify(value));
