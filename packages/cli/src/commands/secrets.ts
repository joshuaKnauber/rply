import { resolve } from "node:path";
import type { Command } from "commander";
import type { Message, SecretResponse } from "@rply/schema";
import { generateKeyPair, open } from "@rply/schema/crypto";
import { CliError } from "../client.ts";
import { updateChannel } from "../config.ts";
import { connect, json } from "../context.ts";
import { deadlineFrom, parseDuration, printJson } from "../io.ts";
import { writeEnvValue, writeSecretFile } from "../secrets-file.ts";

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function registerSecrets(program: Command) {
  const secret = program
    .command("secret")
    .description("ask the human for a secret that is written straight to a file, never shown to you");

  secret
    .command("request")
    .description("request a secret; the value is encrypted on the human's device and only ever written to --to")
    .argument("<name>", "e.g. OPENAI_API_KEY (the variable name in .env mode)")
    .requiredOption("--to <path>", "file to write, e.g. .env")
    .option("--file", "write the value as the whole file instead of a NAME=value line")
    .option("--reason <text>", "why you need it, shown to the human")
    .option("--expires <duration>", "stop accepting the secret after e.g. 1h (defaults to --timeout when waiting)")
    .option("--wait", "block until the secret is written")
    .option("--timeout <duration>", "give up waiting after e.g. 30m (exit code 2)")
    .addHelpText(
      "after",
      `
The value is never printed, logged or returned. Only the file path is reported.
Files are written with permissions 0600. In .env mode an existing NAME= line is replaced and the rest kept.
Exit codes: 2 if it expired or --timeout ran out, 3 if the human declined or it was cancelled.`,
    )
    .action(async (name: string, opts: { to: string; file?: boolean; reason?: string; expires?: string; wait?: boolean; timeout?: string }) => {
      const mode = opts.file ? "file" : "env";
      if (mode === "env" && !ENV_NAME.test(name)) throw new CliError("In .env mode the name must be a variable name (letters, digits and _)");
      const { client } = await withKey();
      const expires = parseDuration(opts.expires ?? (opts.wait ? opts.timeout : undefined));
      const target = resolve(opts.to);
      const res = await client.request<{ id: string; message: Message }>("POST", "/secrets", {
        name,
        target,
        mode,
        reason: opts.reason,
        expires_at: expires === undefined ? undefined : Date.now() + expires,
      });
      if (!opts.wait) {
        if (json()) return printJson({ id: res.id, name, target, mode, status: "open" });
        return console.log(`Requested ${name} (id: ${res.id}). Write it when provided with: rply secret fetch ${res.id} --wait`);
      }
      await fetchSecret(res.id, true, opts.timeout);
    });

  secret
    .command("fetch")
    .description("write a requested secret once the human has provided it")
    .argument("<id>", "id printed by rply secret request")
    .option("--wait", "block until it's provided")
    .option("--timeout <duration>", "give up waiting after e.g. 30m (exit code 2)")
    .action((id: string, opts: { wait?: boolean; timeout?: string }) => fetchSecret(id, opts.wait ?? false, opts.timeout));

  secret
    .command("cancel")
    .description("withdraw a secret request")
    .argument("<id>")
    .action(async (id: string) => {
      await connect().client.request("POST", `/secrets/${id}/cancel`);
      if (!json()) console.log("Secret request cancelled");
    });
}

async function withKey() {
  const ctx = connect();
  if (ctx.selected.from === "hermes") throw new CliError("In Hermes, request secrets with the rply_request_secret tool instead");
  if (!ctx.selected.key) throw new CliError("Secrets need a saved channel (rply init), not RPLY_SERVER/RPLY_TOKEN");
  let { secret_key, public_key } = ctx.config;
  if (!secret_key || !public_key) {
    ({ secretKey: secret_key, publicKey: public_key } = generateKeyPair());
    updateChannel(ctx.selected, { secret_key, public_key });
  }
  await ctx.client.request("PUT", "/channel/key", { public_key });
  return { ...ctx, secretKey: secret_key };
}

async function fetchSecret(id: string, wait: boolean, timeout: string | undefined) {
  const { client, secretKey } = await withKey();
  const res = wait
    ? await client.poll(deadlineFrom(timeout), async (waitSeconds) => {
        const r = await client.once<SecretResponse>("GET", `/secrets/${id}?wait=${waitSeconds}`);
        return r.status === "open" ? undefined : r;
      })
    : await client.request<SecretResponse>("GET", `/secrets/${id}`).then((r) => (r.status === "open" ? undefined : r));
  if (!res) throw new CliError("Not provided yet", 2);
  if (res.status === "expired") throw new CliError("The secret request expired", 2);
  if (res.status === "declined" || res.status === "cancelled") throw new CliError(`The secret request was ${res.status}`, 3);
  if (res.status === "delivered") throw new CliError("This secret was already written and deleted from the server", 1);

  let value: string;
  try {
    value = open(res.ciphertext!, secretKey);
  } catch {
    throw new CliError("Couldn't decrypt the secret. Was it encrypted for a different key?");
  }
  if (res.mode === "env") writeEnvValue(res.target, res.name, value);
  else writeSecretFile(res.target, value);
  await client.request("POST", `/secrets/${id}/delivered`);

  if (json()) return printJson({ id, name: res.name, target: res.target, mode: res.mode, status: "delivered" });
  console.log(`${res.name} written to ${res.target}`);
}
