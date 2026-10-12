---
title: "How rply works"
description: "The server, the CLI, the apps and how messages move between them."
sidebar:
  order: 1
---

rply has three parts. Knowing what runs where explains most of its behavior: why a waiting command survives a server restart, why push notifications work on a self-hosted server, and what the server can and can't see.

```
 Agent's machine                Server                          You
 ┌─────────────────┐   HTTPS   ┌─────────────────────┐  HTTPS  ┌──────────────┐
 │ agent           │──────────▶│ API                 │◀───────▶│ web app      │
 │  └─ rply CLI    │ long-poll │ database            │         │ (phone app   │
 │     (token,     │           │ web app files       │         │  coming)     │
 │      keys)      │           └─────────────────────┘         └──────────────┘
 └─────────────────┘
```

## The CLI

The `rply` command runs on the agent's machine. It holds the channel's agent token and, once the agent requests a secret, a private encryption key. Every command is a short HTTP request; nothing needs to run in the background unless you want the agent woken up or apps to run scripts, which is what `rply serve` is for.

Because it's a plain command, anything with a shell can use it: agents, scripts, cron jobs, git hooks and CI.

## The server

The server stores channels, messages, files and accounts, and serves the web app. It's a single Node.js process with SQLite by default, packaged as one Docker image. [app.rply.sh](https://app.rply.sh) runs the same software as a self-hosted server.

## The apps

The web app is served by the server itself, so every server, hosted or self-hosted, comes with its own copy. It works in any browser and can be added to a phone's Home Screen. A native mobile app is in progress.

## Waiting without webhooks

Commands like `rply ask --wait` and `rply inbox --wait` use long-polling. The CLI sends a request, and the server holds it open until something happens or about 55 seconds pass. Then the CLI asks again.

That has a few useful consequences:

- It works through any proxy, firewall or NAT. The agent never needs a public address or a webhook.
- A wait can last hours. The CLI keeps reconnecting, so it survives network drops and server restarts.
- The web app gets live updates the same way, through a single sync request per browser.

## Push notifications

Browsers accept push messages signed with the server's own keys, so every server, including a self-hosted one, can notify its web app directly. The server generates those keys on first start. Notification content passes through the browser vendor's push service encrypted end to end.

Native mobile apps work differently: Apple and Google only accept pushes signed by the app's developer. For the mobile app, self-hosted servers will send a content-free "wake up" ping through a small relay run by rply, and the phone then fetches the message from your own server. The relay never sees message content.

## Hosted or self-hosted

Both run the same code. The differences are who operates the server and who can read its database:

| | app.rply.sh | Self-hosted |
| --- | --- | --- |
| Setup | Sign up | Deploy one container |
| Updates | Automatic | Pull a new image |
| Who can read messages | rply, as the operator | You |
| Limits | Quotas set by app.rply.sh | Whatever you configure |

See [Self-hosting](/docs/self-hosting/overview/) to run your own.
