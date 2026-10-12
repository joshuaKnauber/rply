---
title: "Self-hosting"
description: "Run your own rply server: what you need and how to choose where."
sidebar:
  label: "Overview"
  order: 1
---

rply is open source, and the server is one Docker container. Running your own means your messages live on your machine and nobody else can read them. The web app comes with the server, so there's nothing else to deploy.

:::tip[Just want to try rply?]
The hosted app at [app.rply.sh](https://app.rply.sh) is free to start and works the same way. Self-hosting is for when you want to own the data.
:::

## What you run

- **One container** built from the repository's `Dockerfile`. It serves the API and the web app on port `8080`.
- **SQLite** in `/data/rply.db`, plus uploaded files in `/data/files`. Mount `/data` on a persistent volume, or you'll lose everything on the next deploy.
- **Postgres** instead of SQLite is supported for larger setups; see [Configuration](/docs/self-hosting/configuration/#database).

Run one instance. SQLite and the server's in-memory wait queue assume a single process.

## Requirements

- Somewhere to run a Docker container with a persistent volume.
- **HTTPS** on a public address, so your phone can reach it and the browser allows push notifications and passkeys. Most platforms provide this; on a plain server, put Caddy in front.
- Set `RPLY_URL` to the public address, e.g. `https://rply.example.com`. It's needed for passkeys and email links.

The server checks itself at `/health`, which platforms can use as a health check.

## The first account

When you open a new server, it asks you to create an account. **The first account sets up the server and owns it.** After that, nobody else can sign up by default. To let others register, set `RPLY_REGISTRATION=open`; see [Configuration](/docs/self-hosting/configuration/#accounts).

## Pick a platform

| Platform | Good for |
| --- | --- |
| [exe.dev](/docs/self-hosting/exe-dev/) | Running the server on the same VM as your agent |
| [Railway](/docs/self-hosting/railway/) | The least setup: deploy from GitHub, add a volume |
| [Fly.io or Render](/docs/self-hosting/other-platforms/) | Managed platforms you may already use |
| [Docker on any server](/docs/self-hosting/docker/) | A VPS from Hetzner, DigitalOcean or anyone else, or your laptop |

## Let your agent do it

An agent with a shell can deploy the server for you. The **Get started** section on [rply.sh](https://rply.sh) has a setup prompt for each platform: the agent deploys the server, you create the first account, and it connects itself to a channel.

## After deploying

1. Open your server's URL and create the first account.
2. Create a channel with **Add channel**, and give your agent the prompt the app shows. Or run `rply init https://your-server --name "…"` and open the claim link.
3. Turn on notifications with the bell in the sidebar.
