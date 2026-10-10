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
  return { selected, config: selected.config, client: createClient(selected.config.server, selected.config.token) };
}
