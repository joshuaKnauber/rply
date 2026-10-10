import { hostname } from "node:os";
import { Option, type Command } from "commander";
import type { Channel, CreateChannelResponse, Pairing } from "@rply/schema";
import { CliError, createClient } from "../client.ts";
import { normalizeServer, readConfig, writeConfig } from "../config.ts";
import { connect, json } from "../context.ts";
import { printJson, printPairing } from "../io.ts";

export function registerSetup(program: Command) {
  program
    .command("init")
    .description("create a channel on a server and store its agent token")
    .argument("<server-url>", "your rply server, e.g. https://rply.example.com")
    .option("--name <name>", "channel name shown in the app", hostname())
    .addOption(new Option("--server-token <token>", "needed if the server sets RPLY_ADMIN_TOKEN").env("RPLY_SERVER_TOKEN"))
    .option("--force", "replace an existing setup")
    .action(async (serverUrl: string, opts: { name: string; serverToken?: string; force?: boolean }) => {
      const existing = readConfig();
      if (existing && !opts.force) {
        throw new CliError(`Already set up for "${existing.channel?.name}" on ${existing.server}. Use --force to replace it.`);
      }
      const server = normalizeServer(serverUrl);
      const res = await createClient(server, opts.serverToken).request<CreateChannelResponse>("POST", "/channels", { name: opts.name });
      writeConfig({ server, token: res.agent_token, channel: { id: res.channel.id, name: res.channel.name }, inbox_cursor: 0 });

      if (json()) return printJson({ channel: res.channel, pairing: { ...res.pairing, url: `${server}/pair?c=${res.pairing.code}` } });
      console.log(`Created channel "${res.channel.name}" on ${server}\n`);
      await printPairing(server, res.pairing.code, res.pairing.expires_at);
    });

  program
    .command("pair")
    .description("create a one-time code to pair another device")
    .action(async () => {
      const { config, client } = connect();
      const pairing = await client.request<Pairing>("POST", "/pairings");
      if (json()) return printJson({ ...pairing, url: `${config.server}/pair?c=${pairing.code}` });
      await printPairing(config.server, pairing.code, pairing.expires_at);
    });

  program
    .command("whoami")
    .description("show the server and channel this machine posts to")
    .action(async () => {
      const { config, client } = connect();
      const { channel } = await client.request<{ channel: Channel }>("GET", "/channel");
      if (json()) return printJson({ server: config.server, channel });
      console.log(`"${channel.name}" (${channel.id}) on ${config.server}`);
    });
}
