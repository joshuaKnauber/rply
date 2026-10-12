import type { BlockOf } from "@rply/schema";
import { keyFingerprint, seal } from "@rply/schema/crypto";
import { api } from "./api";
import { auth, type ServerChannel } from "./channels";
import { createStore } from "./store";

const trusted = createStore<Record<string, string | string[]>>("rply.keys", {});

const knownKeys = (channelId: string) => [trusted.get()[channelId] ?? []].flat();
export const loadTrustedKeys = trusted.load;


export class KeyChangedError extends Error {
  previous: string;
  current: string;
  constructor(previous: string, current: string) {
    super("This request uses a new encryption key");
    this.previous = keyFingerprint(previous);
    this.current = keyFingerprint(current);
  }
}

export async function provideSecret(entry: ServerChannel, block: BlockOf<"secret">, value: string, acceptNewKey = false) {
  const publicKey = block.public_key;
  const known = knownKeys(entry.channel.id);
  if (known.length && !known.includes(publicKey) && !acceptNewKey) throw new KeyChangedError(known.at(-1)!, publicKey);
  if (!known.includes(publicKey)) trusted.update((all) => ({ ...all, [entry.channel.id]: [...known, publicKey] }));
  await api(entry.server, `/secrets/${block.id}/fulfil`, { ...auth(entry), body: { ciphertext: seal(value, publicKey) } });
}

export const declineSecret = (entry: ServerChannel, secretId: string) =>
  api(entry.server, `/secrets/${secretId}/decline`, { ...auth(entry), method: "POST" });
