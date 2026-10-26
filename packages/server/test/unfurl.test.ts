import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { fallbackPreview, isPrivate, parsePreview } from "../src/routes/unfurl.ts";
import { setup } from "./helpers.ts";

test("previews read open graph tags and fall back to title and favicon", () => {
  const html = `<html><head><title>Fallback</title>
    <meta property="og:title" content="How we cut build times &amp; costs">
    <meta name="description" content="  Caching,
      smaller layers &#x2014; and more ">
    <meta property="og:image" content="/cover.png">
    <link rel="shortcut icon" href="https://cdn.example.com/icon.png">
  </head><body><meta property="og:title" content="ignored"></body></html>`;
  assert.deepEqual(parsePreview("https://example.com/a", "https://example.com/a", html), {
    url: "https://example.com/a",
    title: "How we cut build times & costs",
    description: "Caching, smaller layers — and more",
    image: "https://example.com/cover.png",
    icon: "https://cdn.example.com/icon.png",
    icon_dark: null,
    site: null,
  });
  const bare = parsePreview("https://example.com/x", "https://example.com/x", "<title>Only a title</title>");
  assert.equal(bare.title, "Only a title");
  assert.equal(bare.icon, "https://example.com/favicon.ico");
});

test("previews pick up dark favicons", () => {
  const media = parsePreview("https://a.com", "https://a.com", `<link rel="icon" href="/dark.png" media="(prefers-color-scheme: dark)"><link rel="icon" href="/light.png" media="(prefers-color-scheme: light)">`);
  assert.equal(media.icon, "https://a.com/light.png");
  assert.equal(media.icon_dark, "https://a.com/dark.png");
  const github = parsePreview("https://github.com", "https://github.com", `<link rel="icon" href="https://github.githubassets.com/favicons/favicon.svg" data-base-href="https://github.githubassets.com/favicons/favicon">`);
  assert.equal(github.icon_dark, "https://github.githubassets.com/favicons/favicon-dark.svg");
});

test("unfurl refuses private addresses and non-http URLs", async () => {
  const { request, ownedChannel } = await setup();
  const { human } = await ownedChannel();
  assert.equal((await request("GET", "/unfurl?url=javascript:alert(1)", { token: human })).status, 400);
  assert.equal((await request("GET", "/unfurl?url=https://example.com")).status, 401);
  for (const url of ["http://127.0.0.1:8080/", "http://localhost/", "http://192.168.1.1/", "http://[::1]/", "http://169.254.169.254/latest"]) {
    const { json } = await request("GET", `/unfurl?url=${encodeURIComponent(url)}`, { token: human });
    assert.equal(json.title, null, url);
  }
});

test("private addresses cover IPv4-mapped forms and the full IPv6 ranges", () => {
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "::", "::ffff:7f00:1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe", "0:0:0:0:0:ffff:7f00:1", "fe80::1", "fe90::1", "febf::1", "fc00::1", "ff02::1", "64:ff9b::8.8.8.8"]) {
    assert.equal(isPrivate(address), true, address);
  }
  for (const address of ["8.8.8.8", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8", "fbff::1"]) {
    assert.equal(isPrivate(address), false, address);
  }
});

test("unfurl refuses an IPv4-mapped loopback host", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<title>internal</title>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const { request, ownedChannel } = await setup();
    const { human } = await ownedChannel();
    const { status, json } = await request("GET", `/unfurl?url=${encodeURIComponent(`http://[::ffff:7f00:1]:${port}/`)}`, { token: human });
    assert.equal(status, 200);
    assert.equal(json.title, null);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("pages that can't be read still get a favicon, and GitHub links a title", () => {
  assert.deepEqual(fallbackPreview("https://github.com/acme/app/pull/15", "https://github.com/acme/app/pull/15"), {
    url: "https://github.com/acme/app/pull/15",
    title: "acme/app #15",
    description: null,
    image: null,
    icon: "https://github.com/favicon.ico",
    icon_dark: null,
    site: "GitHub",
  });
  const other = fallbackPreview("https://example.com/report.pdf", "https://cdn.example.com/report.pdf");
  assert.equal(other.title, null);
  assert.equal(other.icon, "https://cdn.example.com/favicon.ico");
  const homeIcon = "https://github.githubassets.com/favicons/favicon.png";
  assert.equal(fallbackPreview("https://github.com/acme/app", "https://github.com/acme/app", homeIcon).icon, homeIcon);
});
