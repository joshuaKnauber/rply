---
title: "Fly.io and Render"
description: "Deploy rply on Fly.io or Render."
sidebar:
  order: 5
---

Both platforms build the repository's `Dockerfile` and provide HTTPS. The one thing to get right is persistent storage at `/data`.

## Fly.io

You need [flyctl](https://fly.io/docs/flyctl/install/) and a Fly.io account.

### 1. Create the app

```sh
git clone https://github.com/joshuaKnauber/rply
cd rply
fly launch --no-deploy
```

`fly launch` detects the `Dockerfile` and writes a `fly.toml`. Pick a name and region when it asks.

### 2. Add a volume and the URL

```sh
fly volumes create rply_data --size 1
fly secrets set RPLY_URL=https://<app>.fly.dev
```

### 3. Mount the volume

Add this to `fly.toml`:

```toml title="fly.toml"
[mounts]
  source = "rply_data"
  destination = "/data"
```

### 4. Deploy

```sh
fly deploy
```

Open `https://<app>.fly.dev` and create the first account. Keep the app at one machine; a volume belongs to a single machine, and rply runs as a single instance.

## Render

Render's persistent disks need a paid instance type.

1. Create a **New Web Service** from the `joshuaKnauber/rply` repository (or your fork) and choose the **Docker** runtime.
2. Add a **Persistent Disk** with the mount path `/data`.
3. Under **Environment**, set `RPLY_URL` to the service's URL, e.g. `https://rply.onrender.com`.
4. Set the health check path to `/health`.

When the deploy finishes, open the URL and create the first account.

## Next steps

- [Configuration](/docs/self-hosting/configuration/) for registration, email and storage.
- [Upgrades and backups](/docs/self-hosting/upgrades/).
