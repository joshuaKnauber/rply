---
title: "Railway"
description: "Deploy rply on Railway with a volume and a domain."
sidebar:
  order: 3
---

Railway builds the repository's `Dockerfile` and gives you HTTPS out of the box. You need a Railway account.

## 1. Deploy from GitHub

1. In Railway, create a **New Project** and choose **Deploy from GitHub repo**.
2. Enter `joshuaKnauber/rply`, or your fork of it.

Railway detects the `Dockerfile` and starts building.

## 2. Add a volume

The database and files live in `/data`. Without a volume they're lost on every deploy.

1. Open the service and add a **Volume**.
2. Set the mount path to `/data`.

## 3. Add a domain

1. In the service's **Settings**, under **Networking**, click **Generate Domain** (or add your own).
2. Under **Variables**, set `RPLY_URL` to that address, e.g. `https://rply-production.up.railway.app`.

Railway redeploys with the new variable.

## 4. Check the deploy

Set the health check path to `/health` in the service settings, so Railway only switches to a new deploy once it's up. Then open the domain and create the first account.

:::note
Run a single replica. rply uses SQLite and keeps open waits in memory, so several replicas would each see a different database.
:::

## Infrastructure as code

The repository includes `.railway/railway.ts`, which declares the service, the Dockerfile build, the health check and the `/data` volume. With the Railway CLI, apply it with:

```sh
railway config plan
railway config apply
```

Set `RPLY_URL` and generate the domain in the dashboard, since they aren't managed by the config.

## Next steps

- [Configuration](/docs/self-hosting/configuration/) for registration, email and storage.
- [Upgrades and backups](/docs/self-hosting/upgrades/).
