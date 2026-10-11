import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

const VERSION = "v1";
const INFO = new TextEncoder().encode("rply-sealed-box-v1");

export const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export function generateKeyPair() {
  const secretKey = x25519.utils.randomSecretKey();
  return { secretKey: toBase64Url(secretKey), publicKey: toBase64Url(x25519.getPublicKey(secretKey)) };
}

const deriveKey = (shared: Uint8Array, ephemeralPublic: Uint8Array, recipientPublic: Uint8Array) =>
  hkdf(sha256, shared, new Uint8Array([...ephemeralPublic, ...recipientPublic]), INFO, 32);

export function seal(plaintext: string, recipientPublicKey: string) {
  const recipient = fromBase64Url(recipientPublicKey);
  const ephemeralSecret = x25519.utils.randomSecretKey();
  const ephemeralPublic = x25519.getPublicKey(ephemeralSecret);
  const key = deriveKey(x25519.getSharedSecret(ephemeralSecret, recipient), ephemeralPublic, recipient);
  const nonce = randomBytes(24);
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(new TextEncoder().encode(plaintext));
  return `${VERSION}.${toBase64Url(new Uint8Array([...ephemeralPublic, ...nonce, ...ciphertext]))}`;
}

export function open(sealed: string, secretKey: string) {
  const [version, payload] = sealed.split(".");
  if (version !== VERSION || !payload) throw new Error("Unsupported sealed format");
  const bytes = fromBase64Url(payload);
  const ephemeralPublic = bytes.slice(0, 32);
  const nonce = bytes.slice(32, 56);
  const secret = fromBase64Url(secretKey);
  const key = deriveKey(x25519.getSharedSecret(secret, ephemeralPublic), ephemeralPublic, x25519.getPublicKey(secret));
  return new TextDecoder().decode(xchacha20poly1305(key, nonce).decrypt(bytes.slice(56)));
}

export const keyFingerprint = (publicKey: string) =>
  Array.from(sha256(fromBase64Url(publicKey)).slice(0, 6), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .replace(/(.{4})(?!$)/g, "$1-");
