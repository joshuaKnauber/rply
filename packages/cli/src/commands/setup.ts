import { hostname } from "node:os";
import type { Command } from "commander";
import type { Channel, CreateChannelResponse, JoinChannelResponse, Pairing } from "@rply/schema";
import { CliError, createClient } from "../client.ts";
import { channelKey, normalizeServer, readConfigFile, updateConfigFile } from "../config.ts";
import { connect, json, requested } from "../context.ts";
import { claimUrl, printClaim, printJson } from "../io.ts";

const nextSteps = "\nNext: run `rply guide setup` and follow it to finish setting up this machine.";

function checkFree(key: string, force?: boolean) {
  const existing = readConfigFile().channels[key];
  if (existing && !force) {
    throw new CliError(`A channel "${key}" is already set up on ${existing.server}. Use --force to replace it, or pick another --channel.`);
  }
}

function saveChannel(key: string, server: string, token: string, channel: Channel) {
  let isDefault = false;
  updateConfigFile((file) => {
    file.channels[key] = { server, token, channel: { id: channel.id, name: channel.name }, inbox_cursor: 0 };
    if (!file.default || !file.channels[file.default]) file.default = key;
    isDefault = file.default === key;
  });
  return isDefault;
}

export function registerSetup(program: Command) {
  program
    .command("init")
    .description("create a channel on a server and store its agent token; your human claims it with the printed link")
    .argument("<server-url>", "your rply server, e.g. https://rply.example.com")
    .option("--name <name>", "channel name shown in the app", hostname())
    .option("--agent-name <name>", "name of this agent in the app", hostname())
    .option("--force", "replace a local channel with the same name")
    .addHelpText("after", "\nThe channel is stored under --channel <name> if given, otherwise under a slug of --name.\nThe first channel becomes the default.")
    .action(async (serverUrl: string, opts: { name: string; agentName: string; force?: boolean }) => {
      const key = requested() ?? channelKey(opts.name);
      checkFree(key, opts.force);
      const server = normalizeServer(serverUrl);
      const res = await createClient(server).request<CreateChannelResponse>("POST", "/channels", { name: opts.name, label: opts.agentName });
      const isDefault = saveChannel(key, server, res.agent_token, res.channel);

      if (json()) return printJson({ key, default: isDefault, channel: res.channel, claim: { ...res.claim, url: claimUrl(server, res.claim.code) } });
      console.log(`Created channel "${res.channel.name}" on ${server}, saved as "${key}"${isDefault ? " (default)" : ` (use --channel ${key})`}\n`);
      await printClaim(server, res.claim.code, res.claim.expires_at);
      console.log(nextSteps);
    });

  program
    .command("join")
    .description("join a channel created in the app, using the agent code it shows")
    .argument("<server-url>", "your rply server, e.g. https://rply.example.com")
    .argument("<code>", "the agent code from the app, e.g. K7QX-M2PD")
    .option("--agent-name <name>", "name of this agent in the app", hostname())
    .option("--force", "replace a local channel with the same name")
    .addHelpText("after", "\nThe channel is stored under --channel <name> if given, otherwise under a slug of its name.")
    .action(async (serverUrl: string, code: string, opts: { agentName: string; force?: boolean }) => {
      const server = normalizeServer(serverUrl);
      const res = await createClient(server).request<JoinChannelResponse>("POST", "/agents/join", { code, label: opts.agentName });
      const key = requested() ?? channelKey(res.channel.name);
      checkFree(key, opts.force);
      const isDefault = saveChannel(key, server, res.agent_token, res.channel);

      if (json()) return printJson({ key, default: isDefault, channel: res.channel });
      console.log(`Joined channel "${res.channel.name}" on ${server}, saved as "${key}"${isDefault ? " (default)" : ` (use --channel ${key})`}`);
      console.log(nextSteps);
    });

  program
    .command("pair")
    .description("print a new claim link while no account has claimed this channel yet")
    .action(async () => {
      const { config, client } = connect();
      const claim = await client.request<Pairing>("POST", "/pairings");
      if (json()) return printJson({ ...claim, url: claimUrl(config.server, claim.code) });
      await printClaim(config.server, claim.code, claim.expires_at);
    });

  program
    .command("rename")
    .description("set the name this agent shows in the app")
    .argument("<name>")
    .action(async (name: string) => {
      const { client } = connect();
      const { label } = await client.request<{ label: string }>("PATCH", "/agent", { label: name });
      if (json()) return printJson({ label });
      console.log(`This agent is now "${label}"`);
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
