import type { ClaimPairingResponse, CreateChannelAsHumanResponse, Pairing } from "@rply/schema";
import { api } from "./api";
import { addChannel, auth, type StoredChannel } from "./channels";

export function parsePairingInput(input: string) {
  const trimmed = input.trim();
  try {
    return new URL(trimmed).searchParams.get("c") ?? trimmed;
  } catch {
    return trimmed;
  }
}

export async function claimPairing(input: string) {
  const res = await api<ClaimPairingResponse>("/pairings/claim", {
    body: { code: parsePairingInput(input), label: deviceLabel() },
  });
  addChannel({ channel: res.channel, token: res.token });
  return res.channel;
}

export async function createChannel(name: string, adminToken: string | null) {
  const res = await api<CreateChannelAsHumanResponse>("/channels", {
    token: adminToken ?? undefined,
    body: { name, as: "human", label: deviceLabel() },
  });
  const entry = { channel: res.channel, token: res.token };
  addChannel(entry);
  return { entry, code: res.agent_code };
}

export const createAgentCode = (entry: StoredChannel) => api<Pairing>("/pairings", { ...auth(entry), body: { role: "agent" } });

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

export const initPrompt = (tokenFlag: string) =>
  setupPrompt(
    `rply init ${location.origin} --name "<a short name for you>"${tokenFlag}`,
    "Tell me the pairing code it prints, then run `rply guide setup` and follow every step, including the background service and the test message at the end.",
  );

function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  return os ? `${browser} on ${os}` : browser;
}
