---
title: "Configuration"
description: "Every environment variable the server reads."
sidebar:
  order: 6
---

The server is configured entirely through environment variables. All of them are optional; a server with none set works for a single person on `localhost`.

Sizes accept `B`, `KB`, `MB` or `GB` (e.g. `25MB`). Retention periods accept hours or days (e.g. `12h`, `30d`).

## Basics

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | Port to listen on. |
| `RPLY_URL` | | The server's public address, e.g. `https://rply.example.com`. Needed for passkeys and email links. |
| `RPLY_WEB_DIR` | the built web app | Folder with the web app to serve. Only needed for custom builds. |

## Database

| Variable | Default | Description |
| --- | --- | --- |
| `RPLY_DB` | `rply.db` (`/data/rply.db` in Docker) | Path to the SQLite file. |
| `RPLY_DATABASE_URL` | | A `postgres://…` URL. When set, it's used instead of SQLite, and file storage is off unless you set `RPLY_FILES_DIR` or S3. |

Migrations run automatically on start. See [Upgrades and backups](/docs/self-hosting/upgrades/).

## Accounts

| Variable | Default | Description |
| --- | --- | --- |
| `RPLY_REGISTRATION` | `invite` | Who can create an account after the first one. `open`: anyone. `invite` and `closed`: nobody, for now; invites are planned. |
| `RPLY_AUTH_SECRET` | generated | Secret for signing sessions. Generated on first start and stored in the database if unset. |
| `RPLY_TRUSTED_ORIGINS` | | Comma-separated extra origins allowed to sign in, e.g. a separately hosted web app. |

### Email

Email enables verification, password reset and magic links. It's sent through [Resend](https://resend.com) and needs `RPLY_URL`.

| Variable | Description |
| --- | --- |
| `RPLY_RESEND_API_KEY` | Resend API key. |
| `RPLY_EMAIL_FROM` | Sender, e.g. `rply <login@example.com>`. Required with the API key. |

### GitHub and Google sign-in

Each provider shows a "Continue with …" button once both of its variables are set. Both need `RPLY_URL`. New accounts still follow `RPLY_REGISTRATION`; signing in with a provider whose verified email matches an existing account links it.

| Variable | Description |
| --- | --- |
| `RPLY_GITHUB_CLIENT_ID`, `RPLY_GITHUB_CLIENT_SECRET` | A [GitHub OAuth app](https://github.com/settings/developers) with the callback URL `<RPLY_URL>/v1/auth/callback/github`. |
| `RPLY_GOOGLE_CLIENT_ID`, `RPLY_GOOGLE_CLIENT_SECRET` | A [Google OAuth client](https://console.cloud.google.com/apis/credentials) (web application) with the redirect URI `<RPLY_URL>/v1/auth/callback/google`. |

The mobile app signs in with email and password only for now.

Without email, reset a password from the command line; see [Upgrades and backups](/docs/self-hosting/upgrades/#reset-a-password-without-email).

## Files

| Variable | Default | Description |
| --- | --- | --- |
| `RPLY_FILES` | on | Set to `off` to disable attachments. |
| `RPLY_FILES_DIR` | `files/` next to the database | Folder for uploaded files. |
| `RPLY_FILES_MAX_SIZE` | `25MB` | Largest allowed file. |
| `RPLY_FILES_TOTAL_LIMIT` | `5GB` | Total storage; uploads beyond it are refused. |
| `RPLY_FILES_RETENTION` | off | Delete files older than this, e.g. `30d`. |

### S3-compatible storage

Store files in any S3-compatible bucket (AWS, Cloudflare R2, MinIO, Railway buckets) instead of a folder:

| Variable | Description |
| --- | --- |
| `RPLY_S3_BUCKET` | Bucket name. Setting it switches to S3. |
| `RPLY_S3_ENDPOINT` | Endpoint URL. |
| `RPLY_S3_ACCESS_KEY_ID` | Access key. |
| `RPLY_S3_SECRET_ACCESS_KEY` | Secret key. |
| `RPLY_S3_REGION` | Region, default `auto`. |

## Push notifications

Web push works without configuration: the server generates its keys on first start and stores them in the database.

| Variable | Default | Description |
| --- | --- | --- |
| `RPLY_PUSH` | on | Set to `off` to disable push notifications. |
| `RPLY_VAPID_PUBLIC_KEY`, `RPLY_VAPID_PRIVATE_KEY` | generated | Use your own key pair. |
| `RPLY_VAPID_SUBJECT` | `https://rply.sh` | Contact for push services, a URL or `mailto:` address. |

Push services require HTTPS, except on `localhost`.

## Limits and retention

All of these are off by default. They count per account, across the channels the account owns.

| Variable | Description |
| --- | --- |
| `RPLY_LIMIT_CHANNELS` | Most channels an account can own. |
| `RPLY_LIMIT_MESSAGES_PER_DAY` | Most new messages per account in 24 hours. |
| `RPLY_LIMIT_STORAGE` | Most file storage per account, e.g. `1GB`. |
| `RPLY_MESSAGE_RETENTION` | Delete unpinned messages older than this, e.g. `90d`. |

Some limits are always on to protect the server, whatever you configure: 120 writes a minute per channel, 20 agents per channel, and 20 channels created without an account per IP address per hour.
