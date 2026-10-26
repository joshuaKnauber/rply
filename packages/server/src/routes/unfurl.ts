import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { LinkPreview } from "@rply/schema";
import { requireAuth } from "../auth.ts";
import type { AppEnv, Deps } from "../context.ts";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const CACHE_SIZE = 1000;
const HIT_TTL = 24 * 60 * 60 * 1000;
const MISS_TTL = 60 * 60 * 1000;

export function unfurlRoutes(deps: Deps, fetchPage: typeof fetchPreview = fetchPreview) {
  const cache = new Map<string, { preview: LinkPreview; expires: number }>();

  return new Hono<AppEnv>().get("/unfurl", requireAuth(deps), async (c) => {
    const url = c.req.query("url") ?? "";
    if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) throw new HTTPException(400, { message: "Expected an http(s) URL" });
    const cached = cache.get(url);
    if (cached && cached.expires > Date.now()) return c.json(cached.preview);
    deps.limits.unfurl(c.var.auth.channel.id);

    const preview = await fetchPage(url).catch(() => ({ url, title: null, description: null, image: null, icon: null, icon_dark: null, site: null }));
    cache.delete(url);
    cache.set(url, { preview, expires: Date.now() + (preview.title ? HIT_TTL : MISS_TTL) });
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
    return c.json(preview);
  });
}

async function fetchPreview(url: string): Promise<LinkPreview> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(new URL(current).hostname);
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; rply link preview)", accept: "text/html" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) {
      // Borrow the icon the site's homepage declares; a bare /favicon.ico is often an .ico the mobile app can't show.
      const home = new URL("/", current).toString();
      const homePreview = current === home ? null : await fetchPreview(home).catch(() => null);
      return { ...fallbackPreview(url, current, homePreview?.icon), icon_dark: homePreview?.icon_dark ?? null };
    }
    return parsePreview(url, current, await readStart(res));
  }
  throw new Error("Too many redirects");
}

export function fallbackPreview(url: string, pageUrl: string, icon?: string | null): LinkPreview {
  const { host, pathname } = new URL(url);
  const repo = host === "github.com" ? pathname.match(/^\/([^/]+\/[^/]+)(?:\/(?:pull|issues)\/(\d+))?/) : null;
  return {
    url,
    title: repo ? (repo[2] ? `${repo[1]} #${repo[2]}` : repo[1]!) : null,
    description: null,
    image: null,
    icon: icon ?? new URL("/favicon.ico", pageUrl).toString(),
    icon_dark: null,
    site: repo ? "GitHub" : null,
  };
}

async function assertPublic(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivate)) throw new Error("Private address");
}

export function isPrivate(address: string) {
  const v4 = toIPv4(address);
  if (v4) return isPrivateV4(v4);
  const groups = toIPv6Groups(address);
  // An address this cannot parse is not proven public, so block it too.
  if (!groups) return true;
  const [a, b, c, d, e, f] = groups;
  return (
    (a & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (a & 0xffc0) === 0xfe80 || // fe80::/10 link local
    (a & 0xff00) === 0xff00 || // ff00::/8 multicast
    (a === 0x64 && b === 0xff9b && c === 0 && d === 0 && e === 0 && f === 0) // 64:ff9b::/96 NAT64
  );
}

function isPrivateV4(v4: string) {
  const [a, b] = v4.split(".").map(Number) as [number, number];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || a >= 224;
}

// The IPv4 address an IPv6 address embeds (::/96 and ::ffff:0:0/96), or null.
function toIPv4(address: string): string | null {
  if (isIP(address) === 4) return address;
  const groups = toIPv6Groups(address);
  if (!groups) return null;
  const [a, b, c, d, e, f, hi, lo] = groups;
  if (a || b || c || d || e || (f !== 0 && f !== 0xffff)) return null;
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

// The eight 16-bit groups of an IPv6 address, or null when it is not one.
function toIPv6Groups(address: string): number[] | null {
  let src = address;
  const dotted = address.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const octets = dotted[1].split(".").map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    src = `${address.slice(0, dotted.index)}${(((octets[0] << 8) | octets[1]) >>> 0).toString(16)}:${(((octets[2] << 8) | octets[3]) >>> 0).toString(16)}`;
  }
  const parts = src.split("::");
  if (parts.length > 2) return null;
  const parse = (part: string) => part.split(":").map((group) => (group === "" ? NaN : parseInt(group, 16)));
  const high = parts[0] === "" ? [] : parse(parts[0]);
  const low = parts.length === 1 || parts[1] === "" ? [] : parse(parts[1]);
  if (parts.length === 2 && high.length + low.length > 8) return null;
  const groups = parts.length === 1 ? high : [...high, ...Array(8 - high.length - low.length).fill(0), ...low];
  return groups.length === 8 && groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff) ? groups : null;
}

async function readStart(res: Response) {
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  void reader.cancel();
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export function parsePreview(url: string, pageUrl: string, html: string): LinkPreview {
  const bodyAt = html.search(/<body[\s>]/i);
  const head = bodyAt > 0 ? html.slice(0, bodyAt) : html;
  const meta = (key: string) => {
    for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
      const name = attr(tag, "property") ?? attr(tag, "name");
      if (name?.toLowerCase() === key) return clean(attr(tag, "content"));
    }
    return null;
  };
  const icons = (head.match(/<link\b[^>]*>/gi) ?? []).filter((tag) => /(^|\s)(shortcut )?icon(\s|$)/i.test(attr(tag, "rel") ?? ""));
  const isDark = (tag: string) => /prefers-color-scheme:\s*dark/i.test(attr(tag, "media") ?? "");
  const icon = icons.find((tag) => !isDark(tag));
  const darkIcon = icons.find(isDark);
  // GitHub swaps its favicon with JS, from data-base-href (".../favicon") to ".../favicon-dark.svg".
  const darkBase = icon && attr(icon, "data-base-href");
  const resolve = (value: string | null) => {
    if (!value) return null;
    try {
      const resolved = new URL(value, pageUrl);
      return /^https?:$/.test(resolved.protocol) ? resolved.toString() : null;
    } catch {
      return null;
    }
  };
  return {
    url,
    title: meta("og:title") ?? meta("twitter:title") ?? clean(head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null),
    description: meta("og:description") ?? meta("twitter:description") ?? meta("description"),
    image: resolve(meta("og:image") ?? meta("twitter:image")),
    icon: resolve(icon ? attr(icon, "href") : "/favicon.ico"),
    icon_dark: resolve(darkIcon ? attr(darkIcon, "href") : darkBase ? `${darkBase}-dark.svg` : null),
    site: meta("og:site_name"),
  };
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((v) => v !== undefined) ?? null;

const fromCodePoint = (code: number) => {
  try {
    return String.fromCodePoint(code);
  } catch {
    return undefined;
  }
};

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function clean(value: string | null) {
  if (!value) return null;
  const text = value
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code: string) =>
      code[0] === "#" ? fromCodePoint(Number(/^#x/i.test(code) ? `0${code.slice(1)}` : code.slice(1))) ?? match : (entities[code.toLowerCase()] ?? match),
    )
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 300) : null;
}
