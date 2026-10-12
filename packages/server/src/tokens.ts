import { createHash, randomBytes, randomInt } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const randomString = (length: number) => Array.from({ length }, () => CROCKFORD[randomInt(32)]).join("");

export const randomId = () => randomString(16).toLowerCase();

export const createToken = (kind: "a" | "k") => `rply_${kind}_${randomBytes(32).toString("base64url")}`;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function createPairingCode() {
  const code = randomString(8);
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export const normalizePairingCode = (code: string) =>
  code.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");

let last = 0;
export const now = () => (last = Math.max(Date.now(), last + 1));
