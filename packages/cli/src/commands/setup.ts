import { hostname } from "node:os";
import { Option, type Command } from "commander";
import type { Channel, CreateChannelResponse, Pairing } from "@rply/schema";
import { CliError, createClient } from "../client.ts";
import { channelKey, normalizeServer, readConfigFile, updateConfigFile } from "../config.ts";
import { connect, json, requested } from "../context.ts";
import { printJson, printPairing } from "../io.ts";

export function registerSetup(program: Command) {
  program
    .command("init")
    .description("create a channel on a server and store its agent token")
    .argument("<server-url>", "your rply server, e.g. https://rply.example.com")
    .option("--name <name>", "channel name shown in the app", hostname())
    .addOption(new Option("--server-token <token>", "needed if the server sets RPLY_ADMIN_TOKEN").env("RPLY_SERVER_TOKEN"))
    .option("--force", "replace a local channel with the same name")
    .addHelpText("after", "\nThe channel is stored under --channel <name> if given, otherwise under a slug of --name.\nThe first channel becomes the default.")
    .action(async (serverUrl: string, opts: { name: string; serverToken?: string; force?: boolean }) => {
      const key = requested() ?? channelKey(opts.name);
      const existing = readConfigFile().channels[key];
      if (existing && !opts.force) {
        throw new CliError(`A channel "${key}" is already set up on ${existing.server}. Use --force to replace it, or pick another --channel.`);
      }

      const server = normalizeServer(serverUrl);
      const res = await createClient(server, opts.serverToken).request<CreateChannelResponse>("POST", "/channels", { name: opts.name });
      let isDefault = false;
      updateConfigFile((file) => {
        file.channels[key] = { server, token: res.agent_token, channel: { id: res.channel.id, name: res.channel.name }, inbox_cursor: 0 };
        if (!file.default || !file.channels[file.default]) file.default = key;
        isDefault = file.default === key;
      });

      if (json()) return printJson({ key, default: isDefault, channel: res.channel, pairing: { ...res.pairing, url: `${server}/pair?c=${res.pairing.code}` } });
      console.log(`Created channel "${res.channel.name}" on ${server}, saved as "${key}"${isDefault ? " (default)" : ` (use --channel ${key})`}\n`);
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
      const { selected, config, client } = connect();
      const { channel } = await client.request<{ channel: Channel }>("GET", "/channel");
      if (json()) return printJson({ key: selected.key ?? null, server: config.server, channel });
      console.log(`"${channel.name}" (${selected.key ? `saved as ${selected.key}` : "from RPLY_SERVER/RPLY_TOKEN"}) on ${config.server}`);
    });

  const channels = program
    .command("channels")
    .description("list the channels set up on this machine")
    .action(() => {
      const file = readConfigFile();
      const entries = Object.entries(file.channels);
      if (json()) {
        return printJson(entries.map(([key, c]) => ({ key, default: key === file.default, name: c.channel?.name ?? null, server: c.server })));
      }
      if (entries.length === 0) return console.log("No channels yet. Run `rply init <server-url>`.");
      const width = Math.max(...entries.map(([key]) => key.length));
      for (const [key, c] of entries) {
        console.log(`${key === file.default ? "*" : " "} ${key.padEnd(width)}  "${c.channel?.name ?? key}" on ${c.server}`);
      }
    });

  channels
    .command("use")
    .description("make a channel the default")
    .argument("<name>")
    .action((key: string) => {
      updateConfigFile((file) => {
        if (!file.channels[key]) throw new CliError(`No channel "${key}". Set up: ${Object.keys(file.channels).join(", ") || "none"}`);
        file.default = key;
      });
      console.log(`"${key}" is now the default channel`);
    });

  channels
    .command("remove")
    .description("forget a channel on this machine (it stays on the server)")
    .argument("<name>")
    .action((key: string) => {
      updateConfigFile((file) => {
        if (!file.channels[key]) throw new CliError(`No channel "${key}"`);
        delete file.channels[key];
        if (file.default === key) file.default = Object.keys(file.channels)[0];
      });
      console.log(`Removed "${key}" from this machine`);
    });
}
