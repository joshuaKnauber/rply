import type { ClaimChannelResponse, CreateOwnedChannelResponse, Pairing } from "@rply/schema";
import type { ChannelEntry } from "@rply/schema";
import { api } from "./api";
import { auth } from "./channels";

export function parseCodeInput(input: string) {
  const trimmed = input.trim();
  try {
    return new URL(trimmed).searchParams.get("c") ?? trimmed;
  } catch {
    return trimmed;
  }
}

export const claimChannel = (input: string) =>
  api<ClaimChannelResponse>("/channels/claim", { body: { code: parseCodeInput(input) } }).then((r) => r.channel);

export const createChannel = (name: string) => api<CreateOwnedChannelResponse>("/channels", { body: { name } });

export const createAgentCode = (entry: ChannelEntry) => api<Pairing>("/pairings", { ...auth(entry), method: "POST" });

const shellQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

const setupPrompt = (connect: string, last: string) =>
  `Connect yourself to rply so I can reach you from the rply app:
1. npm install --global @rply/cli
2. ${connect}
3. ${last}`;

export const joinPrompt = (code: string, agentName = "") =>
  setupPrompt(
    `rply join ${location.origin} ${code}${agentName.trim() ? ` --agent-name ${shellQuote(agentName.trim())}` : ""}`,
    "Run `rply guide setup` and follow every step, including the background service and the test message at the end.",
  );

export const initPrompt = () =>
  setupPrompt(
    `rply init ${location.origin} --name "<a short name for you>"`,
    "Give me the claim link it prints, then run `rply guide setup` and follow every step, including the background service and the test message at the end.",
  );
