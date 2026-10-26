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

    const preview = await fetchPage(url).catch((err) => {
      console.error("link preview failed", { url: logUrl(url), error: err });
      return { url, title: null, description: null, image: null, icon: null, icon_dark: null, site: null };
    });
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

// a URL's query string can carry tokens (presigned links, magic links), so only the origin and path go to the log
const logUrl = (raw: string) => {
  try {
    const { origin, pathname } = new URL(raw);
    return `${origin}${pathname}`;
  } catch {
    return raw.slice(0, 200);
  }
};

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

function isPrivate(address: string) {
  const v4 = address.replace(/^::ffff:/, "");
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || a >= 224;
  }
  const v6 = address.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
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
