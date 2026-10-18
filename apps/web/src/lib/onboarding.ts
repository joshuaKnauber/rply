import type { ClaimChannelResponse, CreateOwnedChannelResponse, Pairing } from "@rply/schema";
import type { ChannelEntry } from "@rply/schema";
import { agentSetupPrompt } from "@rply/schema/helpers";
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

export const joinPrompt = (code: string, agentName = "") => agentSetupPrompt(location.origin, { code, agentName });

export const initPrompt = () => agentSetupPrompt(location.origin);
