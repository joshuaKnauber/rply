import type { ClaimPairingResponse } from "@rply/schema";
import { api } from "./api";
import { addChannel } from "./channels";

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
    body: { code: parsePairingInput(input), label: "Web browser" },
  });
  addChannel({ channel: res.channel, token: res.token });
  return res.channel;
}
