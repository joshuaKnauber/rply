import type { Channel } from "@rply/schema";
import { keyFingerprint, seal } from "@rply/schema/crypto";
import { api } from "./api";
import { auth, type StoredChannel } from "./channels";
import { createStore } from "./store";

const trusted = createStore<Record<string, string>>("rply.keys", {});
export const loadTrustedKeys = trusted.load;


export class KeyChangedError extends Error {
  previous: string;
  current: string;
  constructor(previous: string, current: string) {
    super("The agent's encryption key changed");
    this.previous = keyFingerprint(previous);
    this.current = keyFingerprint(current);
  }
}

export const fetchPublicKey = (entry: StoredChannel) =>
  api<{ channel: Channel }>(entry.server, "/channel", auth(entry)).then(({ channel }) => {
    if (!channel.public_key) throw new Error("This agent hasn't set up a key yet");
    return channel.public_key;
  });

export async function provideSecret(entry: StoredChannel, secretId: string, value: string, acceptNewKey = false) {
  const publicKey = await fetchPublicKey(entry);
  const known = trusted.get()[entry.channel.id];
  if (known && known !== publicKey && !acceptNewKey) throw new KeyChangedError(known, publicKey);
  trusted.update((all) => ({ ...all, [entry.channel.id]: publicKey }));
  await api(entry.server, `/secrets/${secretId}/fulfil`, { ...auth(entry), body: { ciphertext: seal(value, publicKey) } });
}

export const declineSecret = (entry: StoredChannel, secretId: string) =>
  api(entry.server, `/secrets/${secretId}/decline`, { ...auth(entry), method: "POST" });
