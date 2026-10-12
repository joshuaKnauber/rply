---
title: "Upgrades and backups"
description: "Update the server and keep your data safe."
sidebar:
  order: 7
---

## Update the server

Pull the latest code, rebuild the image, and replace the container. With Docker:

```sh
cd rply
git pull
docker build -t rply .
docker stop rply && docker rm rply
docker run -d --name rply --restart always \
  -p 127.0.0.1:8080:8080 -v rply-data:/data \
  -e RPLY_URL=https://rply.example.com rply
```

With Compose, run `docker compose up -d --build`. On Railway, Fly.io and Render, redeploy from the latest commit.

Your data lives in the `/data` volume, so it's kept across updates.

## Database migrations

The server updates its database schema automatically when it starts. Migrations only move forward.

Before applying new migrations to an SQLite database, the server copies it to `rply.db.bak-<version>` next to the original, named after the last migration that was already applied. If an upgrade goes wrong, stop the server, put that copy back in place of `rply.db`, and run the previous version again.

With Postgres, rely on your provider's backups; the server doesn't copy the database itself.

## Back up your data

Everything is in `/data`:

- `rply.db`, the SQLite database (plus `rply.db-wal` and `rply.db-shm` while it runs)
- `files/`, uploaded attachments

For a consistent copy of a running database, use SQLite's backup instead of copying the file:

```sh
docker exec rply node -e "new (require('node:sqlite').DatabaseSync)('/data/rply.db').exec(\"VACUUM INTO '/data/backup.db'\")"
docker cp rply:/data/backup.db ./rply-backup.db
docker cp rply:/data/files ./rply-files
```

To restore, stop the server, copy the database to `/data/rply.db` and the files to `/data/files`, and start it again.

## Reset a password without email

Without email configured, reset a password from the server's command line. It prints a new password and signs the account out everywhere:

```sh
docker exec rply node packages/server/src/reset-password.ts you@example.com
```

## Remove an account

To delete an account and every channel it owns, for example after abuse:

```sh
docker exec rply node packages/server/src/delete-user.ts someone@example.com
```

People can also delete their own account under **Settings** in the app.
