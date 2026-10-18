import { createClient } from "./client.ts";
import { selectChannel } from "./config.ts";

let jsonMode = false;
let requestedChannel: string | undefined;

export function setGlobalOptions(opts: { json?: boolean; channel?: string }) {
  jsonMode = Boolean(opts.json);
  requestedChannel = opts.channel ?? process.env.RPLY_CHANNEL;
}

export const json = () => jsonMode;
export const requested = () => requestedChannel;

export function connect() {
  const selected = selectChannel(requestedChannel);
  const rejoin = {
    env: "Check RPLY_TOKEN.",
    hermes: "Connect this Hermes profile again with `hermes rply join <server-url> <code>`.",
    saved: `Forget it with \`rply channels remove ${selected.key}\`, then \`rply join\` or \`rply init\` again.`,
  }[selected.from ?? "saved"];
  const rejected = `The server doesn't accept this agent's token: the agent was removed or its channel was deleted. ${rejoin}`;
  return { selected, config: selected.config, client: createClient(selected.config.server, selected.config.token, rejected) };
}
