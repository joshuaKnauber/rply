import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePreview } from "../src/routes/unfurl.ts";
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
    site: null,
  });
  const bare = parsePreview("https://example.com/x", "https://example.com/x", "<title>Only a title</title>");
  assert.equal(bare.title, "Only a title");
  assert.equal(bare.icon, "https://example.com/favicon.ico");
});

test("unfurl refuses private addresses and non-http URLs", async () => {
  const { request, pairedChannel } = await setup();
  const { human } = await pairedChannel();
  assert.equal((await request("GET", "/unfurl?url=javascript:alert(1)", { token: human })).status, 400);
  assert.equal((await request("GET", "/unfurl?url=https://example.com")).status, 401);
  for (const url of ["http://127.0.0.1:8080/", "http://localhost/", "http://192.168.1.1/", "http://[::1]/", "http://169.254.169.254/latest"]) {
    const { json } = await request("GET", `/unfurl?url=${encodeURIComponent(url)}`, { token: human });
    assert.equal(json.title, null, url);
  }
});
