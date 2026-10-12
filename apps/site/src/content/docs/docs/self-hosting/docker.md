---
title: "Docker and any server"
description: "Run rply with Docker on any Linux server, with Caddy for HTTPS."
sidebar:
  order: 2
---

This guide runs rply on a server you control, such as a VPS from Hetzner or DigitalOcean, with Caddy providing HTTPS. You need Docker, a domain pointing at the server, and ports 80 and 443 open.

## 1. Build the image

```sh
git clone https://github.com/joshuaKnauber/rply
cd rply
docker build -t rply .
```

## 2. Run the container

```sh
docker run -d --name rply --restart always \
  -p 127.0.0.1:8080:8080 \
  -v rply-data:/data \
  -e RPLY_URL=https://rply.example.com \
  rply
```

- `-v rply-data:/data` keeps the database and files in a Docker volume across restarts and upgrades.
- Binding to `127.0.0.1` keeps the plain-HTTP port private; Caddy serves the public side.

Check it's up:

```sh
curl http://localhost:8080/health
```

```json
{"ok":true}
```

## 3. Add HTTPS with Caddy

[Install Caddy](https://caddyserver.com/docs/install), then run:

```sh
caddy reverse-proxy --from rply.example.com --to localhost:8080
```

For a permanent setup, put this in `/etc/caddy/Caddyfile` and reload Caddy:

```text title="Caddyfile"
rply.example.com {
  reverse_proxy localhost:8080
}
```

Caddy gets a certificate automatically. Open `https://rply.example.com` and create the first account.

## Docker Compose

The same setup as a Compose file, including Caddy:

```yaml title="compose.yaml"
services:
  rply:
    build: https://github.com/joshuaKnauber/rply.git
    restart: always
    environment:
      RPLY_URL: https://rply.example.com
    volumes:
      - rply-data:/data

  caddy:
    image: caddy:2
    restart: always
    ports:
      - "80:80"
      - "443:443"
    command: caddy reverse-proxy --from rply.example.com --to rply:8080
    volumes:
      - caddy-data:/data

volumes:
  rply-data:
  caddy-data:
```

```sh
docker compose up -d
```

## Running it locally

To try rply on your laptop, skip Caddy and open `http://localhost:8080`:

```sh
docker run -d --name rply -p 8080:8080 -v rply-data:/data rply
```

Only your computer can reach it, so your phone won't get notifications. Browsers allow push on `localhost`, so notifications in that browser still work.

## Next steps

- [Configuration](/docs/self-hosting/configuration/) lists every environment variable.
- [Upgrades and backups](/docs/self-hosting/upgrades/) covers updating and restoring.
