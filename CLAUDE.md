# rply: project context

> **rply** (domain **rply.sh**, CLI `rply`) is "ntfy for agents": a self-hostable communication layer between humans and their AI agents.

## Code style
- YAGNI, keep things simple, no overengineering
- Comments to a minimum, code should be descriptive enough
- Keep things organized, refactor when needed on your own as you notice complexity
- Never commit or push; the author does that

## 1. The idea in one paragraph

A self-hostable, drop-in communication layer between humans and their AI agents. Any agent, running anywhere (exe.dev, Hetzner, a laptop, a hosted service), installs a CLI, creates a channel, and can then: push updates to the human, ask questions and wait for answers, show interactive UI (forms, buttons, tables, progress), maintain a live status page, and request secrets that get written straight to a file without passing through the agent's context. The human uses one inbox for all their agents: a web app served by the server (for the laptop) and a mobile app (React Native / Expo) with push. It is to agents what ntfy is to scripts: tiny to set up, easy to self-host, and agent-agnostic.

**It is NOT** a remote-control or session-mirror tool for a specific coding agent (like Happy or Omnara), and it does NOT provision or host the agent's machine. Users bring their own VPS or sandbox.

## 2. Origin and motivating use case

- The author runs a Claude agent on **exe.dev** that manages SEO for several of their projects.
- Today that setup has two separate parts:
  1. A **website** the agent creates and hosts on exe.dev, which shows status/updates and lets the author send messages to the agent (e.g. "add another project", "add new pages").
  2. **ntfy** for mobile push notifications and replies.
- It works, but the author keeps switching between the two. The goal is one tool that does both and can be dropped into any agent setup.
- The agent should be able to **ask the human for things** (decisions, info, credentials), not just report.

## 3. Landscape (researched Oct 2026)

### Closest existing projects (study before building)
- **Agent Dash**: https://github.com/Prajeevan/agent-dash. Self-hosted push inbox for agents on Cloudflare (Workers + D1 + KV), PWA with Web Push, typed blocks (markdown, progress, tables, forms), ask-and-wait. Agents poll for answers about every 10s. Tied to Cloudflare, PWA only. **Closest to this idea; worth reading before building.**
- **Agent Relay**: https://glama.ai/mcp/servers/asyeg3avqp (arelay.app). Open-source end-to-end encrypted inbox for agents, CLI and MCP (`npx @arelay/cli`), self-hostable. Built around delivering reports and approving them, not live interactive UI.
- **Figs**: https://github.com/figs-so/app. Agents publish state via `.figs` and `figs push`, with a handoff inbox. One-way only (the app never writes back).
- **Agent Mail CLI**: https://github.com/JuanjoFuchs/agent-mail-cli. Messaging between agents, not agent-to-human.

### "Ask a human" over MCP (hosted, narrower)
- **Pushary**: https://pushary.com/human-in-the-loop-mcp. Hosted MCP server with ask-a-human and notify tools, delivered to the phone by app push, then PWA push, then Slack.
- **paigy**: https://enterprisedna.co/directories/mcp/paigy-ai-mcp. Calls, texts or pushes your phone, with voice replies.
- **hil-agent**: https://hub.docker.com/r/superbizon007/hil-agent. Self-hosted, routes to Telegram, WhatsApp etc., with an MCP endpoint.

### Session mirrors / remote control (different category, not what we're building)
- Happy (https://happy.engineering, https://github.com/slopus/happy), Happier (https://github.com/jacobcoro/happier), Omnara (https://remote.omnara.com), Grass (https://codeongrass.com), SeaWork (https://seawork.ai), Claude Code Remote Control, Cursor Mobile.

### Relevant standard
- **MCP Apps**: https://github.com/modelcontextprotocol/ext-apps. Lets MCP tools serve interactive HTML through `ui://` resources. Possible later path for richer UIs; v1 uses our own safe component schema instead.

### Positioning / the gap
No existing tool combines all of: (1) one self-hosted server deployable anywhere like ntfy, (2) a native mobile app with real push plus a web inbox, (3) two-way chat plus interactive components, (4) a persistent status page per agent, (5) secret delivery that bypasses the agent's context, (6) being agent-agnostic through a CLI.

## 4. Product requirements

### Must have (v1)
1. **Server**: Docker image with SQLite, trivial to self-host (Railway, exe.dev, Hetzner, anywhere). Serves the API and the web app.
2. **CLI**: `npx @rply/cli init <server-url>`, scan the QR code, done. Works from any agent with a shell, and also from cron, git hooks and CI.
3. **Web app** (React, served by the server): channel list, a chat thread per channel, a pinned status page per channel, replies. Usable on a laptop as a first-class client, not only for testing.
4. **Mobile app** (React Native / Expo): the same features plus push notifications. Built after the web app.
5. **Messages**: agent sends text or markdown plus components; human replies with free text or by interacting with components.
6. **Ask and wait**: agent asks a question and blocks or waits until answered, with a non-blocking "check inbox later" path as well.
7. **Pinned messages per channel**: agent pins live-updating messages made of the same components to the top of the chat (replaces the custom exe.dev website).
8. **Human → agent messages**: human can message the agent at any time (e.g. "add project X"); the agent receives them through the CLI (`listen`, `inbox`, or a long-poll).
9. **Secret requests**: see section 7. A core differentiator.

### Should have (later)
- Optional end-to-end encryption per channel (section 8). Planned right after the first working loop, before push and secrets.
- Remote MCP endpoint on the server for ChatGPT, Claude connectors and other hosted agents (without secret-to-file delivery).
- Local `mcp` subcommand in the CLI for shell-less local agents (Claude Desktop, some IDE agents) or locked-down permission setups.
- `run --with-secrets -- <cmd>` to inject secrets as environment variables without writing them to disk.
- MCP Apps rendering for richer UIs.
- Hosted version on rply.sh with user accounts (section 10).
- Multiple users per channel, sharing an agent with a team.

## 5. Architecture

```
 Agent machine (any VPS)            Self-hosted server              Human
 ┌──────────────────────┐          ┌──────────────────────┐        ┌───────────────┐
 │ agent (Claude etc.)  │  HTTPS   │ Node + Hono           │  HTTP  │ web app       │
 │   └─ CLI ────────────┼─────────▶│  - REST API           │◀──────▶│ (served by    │
 │      (holds agent    │  long-   │  - long-polling       │  long- │  the server)  │
 │       token, keys,   │  poll    │  - SQLite (Kysely)    │  poll  │               │
 │       writes secrets)│          │  - static web app     │        │ Expo app      │
 └──────────────────────┘          │  - remote /mcp (later)│        │ (later)       │
                                   └──────────┬───────────┘        └──────▲────────┘
                                              │ content-free "wake" ping  │ APNs/FCM
                                              ▼                           │
                                   ┌──────────────────────┐               │
                                   │ Push relay (hosted   │───────────────┘
                                   │ by the developer,    │  (via Expo push API)
                                   │ like ntfy upstream)  │
                                   └──────────────────────┘
```

### Long-polling
Clients wait for new things by holding a plain HTTP request open (`?wait=60`). The server answers as soon as something arrives, or empty after the timeout, and the client asks again. It is used by `ask --wait`, `inbox --wait`, `listen`, `secret request --wait`, and the web app's live updates. It works through any proxy and suits a CLI that runs once and exits. Waiters live in memory behind a small notifier interface; a multi-instance hosted setup swaps that for Postgres `LISTEN/NOTIFY`.

### The push notification problem (shapes the mobile app)
- APNs and FCM only accept pushes signed with **the app developer's** credentials, so a self-hosted server cannot push to the published app directly.
- The fix follows **ntfy's upstream pattern**: a small relay hosted by the developer. Self-hosted servers send it a **content-free wake ping** (device token plus an opaque ID). The phone wakes up and fetches the real content straight from the user's own server.
- The relay never sees message content, and self-hosters need no Apple or Google keys.
- With Expo, the relay can forward to the Expo push API.
- Self-hosters who build their own app can point at their own push credentials instead.
- **Web Push needs none of this** (built): browsers accept pushes signed with the server's own VAPID key, so each self-hosted server pushes to its web app directly. See section 7c.

### Stack (decided)
- **Language**: TypeScript everywhere.
- **Package manager**: npm workspaces. Not bun, not pnpm.
- **Server**: Node, Hono, Kysely. SQLite for self-hosting (`node:sqlite` if Kysely works with it cleanly, otherwise `better-sqlite3`). Postgres support comes later for the hosted version through a second Kysely dialect. Shipped as a Docker image (Railway: mount a volume at `/data`).
- **Portable SQL**: text IDs (not rowid), JSON stored as text, timestamps as integer milliseconds, no SQLite-only features. The global `seq` cursor is autoincrement in SQLite and an identity column in Postgres.
- **Migrations**: Kysely `Migrator`, numbered TS files (`0001_init.ts`) using the schema builder so they run on both dialects. Imported explicitly, not globbed from disk. Run automatically on server start. Before applying pending migrations on SQLite, copy the db file to `rply.db.bak-<version>`. Forward-only, never edit a shipped migration, destructive changes in two releases (stop using, then drop).
- **CLI**: separate package, Node, distributed via npm as `@rply/cli` (`npx @rply/cli`, installs the `rply` command). Minimal dependencies.
- **Shared package**: zod schemas for blocks and API types, used by server, CLI and both apps.
- **Web app**: React + Vite, built to static files that the server serves at `/`.
- **Mobile app**: Expo (React Native) with expo-notifications and expo-secure-store. Separate from the web app.
- **Crypto (E2E, secrets)**: `@noble/ciphers` / `@noble/curves`, pure JS so it runs the same in Node, browsers and React Native.

### Repo layout
```
packages/schema    zod schemas, shared types
packages/server    Hono API, Kysely, migrations, serves apps/web build
packages/cli       the rply CLI
apps/web           React + Vite inbox
apps/mobile        Expo app (later)
apps/site          rply.sh website + docs (Astro + Starlight)
packages/relay     push relay (later)
```

## 6. Component system

Agents send typed JSON **blocks**; the apps render a known set and show an "update the app" placeholder for unknown types. The current block set, questions, embeds (sandboxed `html` with the `rply.reply` / `rply.send` bridge), pinned messages and secret cards are specified in section 11 ("Messages, blocks and questions").

## 7. Secrets (core differentiator, built)

Goal: the human can give an agent credentials (API keys etc.) **without the value ever entering the agent's LLM context or being readable by the server**.

Flow:
1. On the first `rply secret request` for a channel, the CLI generates an **X25519 keypair**, stores the private key in its config (`secret_key`, file mode 0600) and uploads the public key (`PUT /v1/channel/key`, stored on that agent's token). Every request re-uploads it, so a reset server gets it back. With several agents each has its own key: the secret block carries `public_key`, the key of the agent that asked, and the apps seal to that.
2. `rply secret request OPENAI_API_KEY --to .env [--file] [--reason ".."] [--expires 1h] [--wait] [--timeout 30m]`. The target is resolved to an absolute path and shown to the human. `--file` writes the value as the whole file instead of a `NAME=value` line (env mode requires a variable-style name).
3. The server creates a `secret_requests` row plus an agent message with a `secret` block (`{ type: "secret", id, name, target, mode, reason, status, expires_at }`). Agents can't create, edit or pin `secret` blocks through the normal message/pin routes.
4. The app shows a masked field. It **seals** the value to the channel's public key (`@rply/schema/crypto`: ephemeral X25519 + HKDF-SHA256 + XChaCha20-Poly1305, output `v1.<base64url>`) and posts only the ciphertext (`POST /v1/secrets/:id/fulfil`). The human can also decline.
5. **Key pinning (trust on first use)**: the apps remember the public keys they've used per channel (`rply.keys`, a list) and refuse to encrypt to a new one until the human confirms, showing the last trusted and the new fingerprint (`keyFingerprint`, e.g. `2e6d-c547-3bcb`). A new agent joining or an agent being set up again triggers this once.
6. The CLI long-polls `GET /v1/secrets/:id`, decrypts, writes the file atomically with permissions `0600` (`.env` mode replaces an existing `NAME=` line and keeps the rest), then calls `POST /v1/secrets/:id/delivered`, which **deletes the ciphertext**.
7. The CLI prints only `NAME written to /abs/path`. **Never the value**, not on stdout, not in logs, not in errors.
8. Requests are **single use**, **expire**, and can be declined (human) or cancelled (agent, or by deleting the message). The server updates the block's `status` (open → provided → delivered, or declined / cancelled; expired is computed from `expires_at`) and sync carries it to all clients.

Exit codes: 2 = expired or timed out, 3 = declined or cancelled. `rply secret fetch <id> [--wait]` writes a secret requested earlier without `--wait`; `rply secret cancel <id>` withdraws one.

Documented limitations: the agent can still read the written file (it has a shell); `run --with-secrets -- cmd` (environment injection, nothing on disk) is the stronger option for later. In the web app, the code that encrypts is served by the server itself, so a compromised server could capture the value as it's typed; the native app doesn't have this weakness. Secrets need a saved channel (`rply init`), not `RPLY_SERVER`/`RPLY_TOKEN`.

The remote MCP endpoint **cannot** deliver secrets to files (the server can't write on the agent's machine, and returning the value would put it into context), so `request_secret` is either missing there or clearly marked as delivering into context.

## 7b. Files and images (built)

Attachments both ways: agents attach images and files to messages and pins, the human attaches files in the apps, and the agent downloads them with the CLI.
- **Storage is optional and pluggable** (`packages/server/src/files/`): a directory (default: `files/` next to the SQLite file, i.e. `/data/files` in Docker) or any S3-compatible bucket (AWS, R2, MinIO, Railway buckets) via `aws4fetch`. Env: `RPLY_FILES=off`, `RPLY_FILES_DIR`, `RPLY_S3_BUCKET` + `RPLY_S3_ENDPOINT` + `RPLY_S3_ACCESS_KEY_ID` + `RPLY_S3_SECRET_ACCESS_KEY` (+ `RPLY_S3_REGION`, default `auto`), `RPLY_FILES_MAX_SIZE` (default 25MB), `RPLY_FILES_TOTAL_LIMIT` (default 5GB, uploads beyond it get 507), `RPLY_FILES_RETENTION` (e.g. `30d`, off by default). `/v1/info` reports `files: { enabled, max_size }` so clients hide the attach button when files are off.
- **Upload first, then reference**: `POST /v1/files?name=` with the raw bytes and `content-type` returns `{ file_id, name, mime, size }`. Messages reference files with `image` (`{ file_id, name?, alt? }`) and `file` (`{ file_id, name, mime?, size? }`) blocks, or `attachments: FileRef[]` in a human message body. The server rejects references to unknown files or files from another channel, and links each file to the first message that references it. Deleting that message (or the pin) deletes the file; uploads never referenced are swept after 24h; the optional retention sweeps by age (hourly).
- **Downloads need the channel token** (`GET /v1/files/:id`), so images can't be plain `<img src>`: the web app fetches them as blobs, mobile passes the auth header to `Image` and downloads with `expo-file-system` + the share sheet. S3 answers an authenticated request with a 302 to a 5-minute presigned URL.
- **Security**: only `image/png|jpeg|gif|webp` are served inline; everything else (SVG, HTML, ...) as `application/octet-stream` with `Content-Disposition: attachment`, `nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`, because uploads share the origin with the web app and its tokens.
- Files are opaque bytes with the description (name, type) kept in the message, so E2E can later encrypt files client-side before upload.
- Not built: thumbnails/resizing, virus scanning.

## 7c. Web push notifications (built)

The web app can notify about agent messages while the tab is closed (desktop browsers; on iPhone only once added to the Home Screen).
- **VAPID**: the server generates a keypair on first start and keeps it in the `settings` table, or takes `RPLY_VAPID_PUBLIC_KEY` + `RPLY_VAPID_PRIVATE_KEY`. `RPLY_VAPID_SUBJECT` defaults to `https://rply.sh`. `RPLY_PUSH=off` disables it. `/v1/info` returns `push: { public_key } | null`. Sending uses the `web-push` library (`packages/server/src/push/`). Push services need HTTPS, except on `localhost`.
- **Subscriptions are per browser, not per channel**: the bell in the sidebar subscribes once and `PUT /v1/push/subscription { subscription, tokens }` (plus the admin token as bearer when signed in) stores one row per credential. The web app re-sends it whenever its paired channels or admin sign-in change. Revoking a human token or rotating the admin token cascades to its rows; push services answering 404/410 delete the row.
- **What notifies**: agent messages (`rply send --silent` / `silent: true` opts out) and secret requests. Title = channel name, body = preview (questions prefixed with ❓), click opens `/c/<id>`, `tag` = channel, so one notification per channel replaces the last. Content goes through the push service end-to-end encrypted (RFC 8291) but the server reads it; E2E channels will need a generic text.
- **Presence**: `/v1/sync` sends `viewing` (the open channel while the tab is visible) and `push_endpoint`. The server skips that endpoint for that channel until the long-poll plus 15s runs out, so the channel you're looking at doesn't ping you.
- **Web app**: `public/sw.js` (shows the notification, focuses an open tab via a `rply:open` message or opens one), `public/manifest.webmanifest` + icons (installable PWA, required for iOS push), `src/lib/push.ts`, `components/NotificationsButton.tsx`. The endpoint is stored as `rply.push` in localStorage.
- Mobile push (relay, section 5) is separate and not built yet.

## 8. Channels, auth and E2E (decided)

### Channels, modelled on ntfy
ntfy has no accounts: the topic name is the identity and the app keeps a local list of (server, topic). rply keeps that model with one change. Human messages are instructions to an agent with shell access, so a leaked secret must not let someone command the agent. Each channel therefore has **two kinds of credentials**:

| credential | held by | can |
|---|---|---|
| agent token `rply_a_…` (one per agent) | CLI on the agent machine | post as agent, read human messages, set status, request secrets |
| human token `rply_h_…` (one per device) | web / mobile app | read agent messages, reply as human, fulfil secrets |

- No user accounts. Clients store a list of (server, channel, human token). Several servers in one inbox works.
- Tokens are stored only as SHA-256 hashes. The prefixes make leaked tokens easy to spot.
- One channel per agent is the default, but an agent may use several (e.g. one per project). Cron scripts and CI use channels too.

### Pairing
1. `rply init <server-url> --name "SEO bot"` creates the channel. The CLI stores the agent token in its config.
2. The server also returns a **one-time pairing code** (short, base32, about 10 minutes, single use). The CLI prints a QR code and a link: `https://<server>/pair?c=K7QX-M2PD`. The link opens the web app and pairs it directly; the mobile app handles the same link or scans the QR.
3. Pasting the pairing string into an "add channel" field works for setups where scanning is awkward.
4. Claiming the code gives that device its own human token. `rply pair` issues a new code for another device. Each device token can be revoked on its own.
5. The code, not the human token, is printed because CLI output can end up in the agent's context or logs. A used code is worthless.
6. The reverse works too: the web app can create a channel (`POST /v1/channels { as: "human" }`), which pairs that browser and returns a single-use **agent code**. The agent runs `rply join <server-url> <code>`. A paired device can create more agent codes (`POST /v1/pairings { role: "agent" }`), so a channel can have several agents, and an agent that lost its config can rejoin. Agent codes and pairing codes share `pairing_codes` (column `role`) and only work on their own claim route.

### Server tokens (who may create channels)
- Self-host: if `RPLY_ADMIN_TOKEN` is unset, channel creation is open (fine for a private instance). If it is set, `init` needs `--server-token`.
- Server tokens `rply_k_…` live in an `api_keys` table; the env var seeds one row. The hosted version uses the same slot for per-account API keys, so the CLI does not change.

### Owner sign-in (self-hosted multi-device)
Pairing is per device (like ntfy without auth, where each device subscribes on its own). So that the owner sees everything on any device, the web app can **sign in with the admin token**:
- A server token plus an `X-Rply-Channel: <id>` header authenticates as the human side of that channel (read, reply, answer; not agent actions).
- `GET /v1/admin/channels` lists every channel. `POST /v1/sync` with a server token as bearer covers every channel.
- The web app keeps the admin token in localStorage (`rply.admin`). While signed in, it lists channels from the server (refetched every 15s) instead of its paired list. It only offers sign-in when the server has an admin token.
- This stands in for accounts until the hosted version. ntfy's equivalent is user login with synced subscriptions. On rply.sh, an account would see the channels it owns (`owner_id`).

### End-to-end encryption (optional, per channel)
Plaintext is the default. E2E mostly protects against the server operator, which is you when self-hosting, and plaintext keeps `curl` publishing, typed pairing codes, server-side MCP and easy debugging.
- Every message has an `enc` flag from day one. The body is either plain JSON or ciphertext, so a channel can have mixed history and the API never changes shape.
- `rply init --e2e` creates an encrypted channel. `rply e2e enable` upgrades an existing one: the CLI generates a 32-byte channel key (XChaCha20-Poly1305), encrypts from then on, and prints a QR code / link with the key in the **URL fragment** (`#k=…`), which the server never sees. Scanning it attaches the key to the existing channel on that device.
- **The key link must never be sent through rply itself**, since that puts the key on the server. The CLI refuses to do so. The QR code in the terminal is the best path; an agent showing the link in its own chat is acceptable (it passes the LLM provider, not the rply server).
- Apps show a lock icon per channel and warn loudly if a channel goes from encrypted back to plaintext.
- Encrypted: message bodies, replies, form answers, status pages. Still visible to the server: channel IDs, timestamps, sender side, reply links, sizes.
- Costs: no `curl` publishing on E2E channels, no server-side block validation, no remote MCP on E2E channels, revoking a device needs key rotation, push previews need an iOS Notification Service Extension (until then: "New message from SEO bot").

## 9. CLI vs MCP (decided)

- **The CLI is the core and comes first.** Any agent with a shell can use it immediately; it works for non-agent scripts too; long blocking waits are easy (no MCP client timeouts); and secret writing happens locally.
- **Remote MCP on the server** later, for ChatGPT, Claude connectors and hosted agents that have no shell.
- **Local `mcp` subcommand in the CLI**: low priority. Only useful for local agents without a shell or with locked-down shell permissions. Cheap to add later since it reuses the CLI code.
- **`rply guide`** teaches agents the CLI (topics: basics, ask, blocks, html, pins, secrets, files; `--snippet` prints lines for AGENTS.md/CLAUDE.md). To make sure agents read it: `init`/`join` end with "Next: run `rply guide`", every command prints a stderr hint until the guide was read for the installed version (stored in `guide.json` next to the config, `RPLY_NO_GUIDE_HINT=1` turns it off), 400s on `/messages` and `/pins` point to `rply guide blocks`, and the join command the app shows ends with `rply guide`. Keep the guide in `packages/cli/src/commands/guide.ts` in sync when commands or blocks change.

## 10. Hosted version (later, plan for it now)

rply.sh hosting is not part of v1, but the design leaves room for it:
- Two layers of auth. Channel access (agent and human tokens, pairing) is identical everywhere. Account auth only decides who may create and own channels.
- Hosted needs **user accounts** for billing, quotas, abuse prevention, recovery after losing a phone, and syncing the channel list to a new device. Probably passkeys or magic links, e.g. via better-auth.
- Prepared now: nullable `owner_id` on channels, server tokens in an `api_keys` table, Kysely so Postgres is a dialect swap, notifier interface so long-polling works across instances.
- E2E would likely be the default on rply.sh ("we can't read your agents' messages").

## 11. Sketches (not final)

### CLI commands
```
rply init <server-url> [--name ..] [--server-token ..] [--e2e]   # creates channel, prints QR + link
rply join <server-url> <code>           # join a channel created in the app (agent code)
rply rename <name>                      # name this agent shows in the app (init/join take --agent-name, default: hostname)
rply guide [basics|ask|blocks|html|pins|secrets|files|all] [--snippet]   # usage guide for agents
rply pair                               # new pairing code for another device
rply send "Deployed 3 new pages" [--title ..] [--blocks file.json] [--silent]
rply ask "Publish these 5 pages?" --choices yes,no [--multi] [--other] [--default no] [--expires 2h] [--wait] [--timeout 1h]
rply ask "Delete 40 pages?" --confirm Delete --danger --wait
rply ask "New page" --blocks questions.json --wait   # several questions, prints JSON keyed by block id
rply wait <message-id> [--timeout 1h]   # answer to an earlier ask without --wait
rply asks | cancel <message-id>         # open questions / withdraw one
rply edit <message-id> [text] [--patch '{"id":"p","value":7}']
rply ack <message-id> working|done
rply whoami
rply channels [use|remove <name>]    # several channels per machine, --channel <name> on any command
rply inbox [--wait] [--since <cursor>]  # read human → agent messages
rply listen                             # stream incoming messages (JSONL)
rply pin set overview "text" [--title ..] [--blocks file.json]   # pinned to the top of the chat
rply pin patch overview --patch '{"id":"pages","value":42}' | pin remove overview | pin list
rply status set|patch|get                # shortcut for the pin "status"
rply delete <message-id>
rply send "Weekly report" --image chart.png --file data.csv      # --image/--file repeatable, also on pin set
rply file upload <path> | file get <file-id> [--to path] [--force]
rply secret request NAME --to .env [--file] [--reason ".."] [--expires 1h] [--wait] | secret fetch <id> | secret cancel <id>
rply e2e enable
```
Output should be machine-friendly (JSON with `--json`) and self-describing (`--help`, perhaps a `describe` command that prints a JSON schema, as Agent Mail CLI does).

### Server API
The token decides the channel and the sender side, so most routes don't need a channel ID.
- `POST /v1/channels` (server token if required) → channel, agent token, pairing code; with `as: "human"` → channel, human token, agent code
- `POST /v1/pairings { role? }` (either side, so the apps can link another device; `role: "agent"` is human-only) → new pairing or agent code; `POST /v1/agents/join` (agent code) → agent token; `POST /v1/pairings/claim` (code) → human token
- `GET /v1/channel` (either token) → channel info; `GET /v1/devices` / `GET /v1/agents` (either token) → paired human / agent tokens `{ id, label, created_at, last_seen_at, current }`; `DELETE /v1/devices/:id` / `DELETE /v1/agents/:id` (human) revoke one; `PATCH /v1/agent { label }` (agent) renames itself
- `GET /v1/admin/channels` (server token) → all channels; a server token plus `X-Rply-Channel` works on the human-side routes
- `GET /v1/info` (no auth) → `{ server_token_required }`, used by the web app to show the right setup command
- `POST /v1/messages` (agent or human; `reply_to` + `answers` answers a question), `GET /v1/messages?since=&wait=&sender=&pinned=1&peek=1` (without `since`: latest page, no waiting; the agent reading human messages marks them seen unless `peek=1`)
- `PUT|PATCH /v1/messages/:id` (agent edits), `POST /v1/messages/:id/cancel` (agent cancels a question), `POST /v1/messages/:id/state` (agent: seen|working|done on a human message)
- `GET /v1/asks` (agent: open questions), `GET /v1/asks/:id?wait=60` (agent: long-poll until answered, expired or cancelled → `{ message, answer }`)
- `GET /v1/pins`, `PUT|PATCH|DELETE /v1/pins/:key` (agent; keys are 1-32 of `a-z0-9_-`), `POST /v1/messages/:id/unpin` (either side, moves it into the thread), `DELETE /v1/messages/:id` (agent, soft delete)
- `POST /v1/sync` (human tokens and/or admin token + cursor over the `changes` log, long-polls; returns changed messages)
- `PUT /v1/channel/key` (agent: upload the X25519 public key), `POST /v1/secrets` (agent: create a request + secret message), `GET /v1/secrets/:id?wait=` (agent: long-poll; returns the ciphertext once provided), `POST /v1/secrets/:id/delivered|cancel` (agent), `POST /v1/secrets/:id/fulfil|decline` (human)
- `POST /v1/files?name=` (either side, raw body), `GET /v1/files/:id` (either side of the file's channel)
- `PUT /v1/push/subscription` (human tokens in the body and/or admin bearer), `DELETE /v1/push/subscription { endpoint }`
- later: `POST /v1/devices` (mobile push), `/mcp`

### Data model
```
channels        id, name, agent_token_hash (legacy, unused), agent_public_key (latest key, for old clients), e2e, owner_id (null), created_at
human_tokens    id, channel_id, token_hash, label, created_at, last_seen_at, revoked_at
agent_tokens    id, channel_id, token_hash, label (hostname), public_key, created_at, last_seen_at, revoked_at
pairing_codes   code_hash, channel_id, role (human|agent), expires_at, used_at
api_keys        id, token_hash, owner_id (null), label, created_at
messages        seq (creation order, agent inbox cursor), id, channel_id, sender ('agent'|'human'), enc,
                body (JSON text or ciphertext), reply_to, pin (null | key), state (human msgs: seen|working|done),
                created_at, updated_at, deleted_at
asks            message_id, channel_id, status (open|answered|expired|cancelled), expires_at, answer_id, closed_at
changes         seq, channel_id, message_id, created_at     -- one row per insert/edit/state/ask change, drives sync
secret_requests id, channel_id, message_id, name, target, mode (env|file), status (open|provided|delivered|declined|cancelled),
                ciphertext (only while provided), public_key (the requesting agent's), expires_at, created_at, closed_at
files           id, channel_id, message_id (first referencing message), uploader, name, mime, size, created_at, deleted_at
settings        key, value                                   -- e.g. the VAPID keypair
push_subscriptions id, endpoint, p256dh, auth, human_token_id | api_key_id (cascade), created_at
-- later:
devices         human_token_id, push_token, platform, created_at   -- mobile push
```

### Messages, blocks and questions (decided)
- **Blocks** are an open list of `{ type, id?, ...fields }`. Display blocks: `markdown`, `heading`, `code`, `link`, `progress`, `keyvalue`, `table`, `html`, `image`, `file` (section 7b). Input blocks (need an `id`): `choice` (options with `description`/`danger`, `multi`, `other`, `default`), `text_input`, `number_input`, `toggle`, `confirm`, and `html` with `"question": true`. The server validates known types and **accepts unknown types**; apps render unknown types as an "update the app" placeholder, so new block types don't need a coordinated release.
- **Questions**: an agent message containing input blocks is an ask (detected from plaintext, or declared with `ask: { expires_at }` for E2E). One message can hold several questions. The human answers **once per message** with `{ reply_to, body: { answers: { <block id>: value } } }`; the first answer wins (later ones get 409), expired and cancelled questions also refuse answers. `default` values live in the blocks and are applied by the CLI on expiry. Apps auto-submit when a message has exactly one simple input (single choice, confirm, html), otherwise they show one "Send answers" button.
- **Embed events vs answers**: inside an `html` block, `rply.send(value, label?)` sends an **event** any number of times: a human message `{ reply_to, body: { event: { block_id, value, label } } }` that is not an answer. It reaches the agent through `inbox`/`listen` (printed as `event "label" from <block> in message <id>: <json>`), and the apps show it as a compact "Sent: label" line. `rply.reply(value)` answers a question and only applies when the block is marked `"question": true` (which requires an `id`). An `id` alone doesn't make an html block a question. Events can only point at agent messages, and replying with an event to an open question doesn't answer it.
- The embed bridge (prepended to the agent's HTML in all three clients) starts with `<!doctype html><meta charset="utf-8">` so embeds don't render in quirks mode, and reports `document.body`'s height through a `ResizeObserver` (`rply.resize` is automatic). On web the parent listens with `useLayoutEffect` so the first measurement isn't missed.
- All three clients build the embed document with `embedDocument(block, transport, theme)` from `@rply/schema/helpers`. It sets `data-theme` (the app's theme, not the system's; the web app updates it live with a `{ rply: "theme" }` message) and default styles for buttons, inputs, links and tables. Agents can use the CSS variables `--rply-fg`, `--rply-muted`, `--rply-border`, `--rply-surface` and `--rply-accent` to match the app in light and dark mode.
- **Editable messages**: agents can `PATCH` (title/text/blocks, or `block_patches` merged by id) or `PUT` (full replace, for E2E) their own messages. Every change writes a `changes` row, and `/v1/sync` returns the current state of changed messages, so edits, ask status and acknowledgements reach all clients live.
- **Pinned messages instead of a status page**: an agent pins messages by key (`PUT /pins/:key`). They float at the top of the chat in both apps (collapsible) and are kept out of the thread. `status` is just a conventional key. The agent's `pin remove` soft-deletes the message (`deleted_at`). The human can unpin from the apps (`POST /messages/:id/unpin`), which clears `pin` so the message moves into the thread at its original position; the agent's next `pin patch` then 404s and `pin set` pins a fresh message. agents can also delete any message they sent, which withdraws an open question. Sync delivers deletions as messages with `deleted_at` set, and clients drop them.
- **Acknowledgements**: reading the inbox (without `peek`) marks human messages `seen`; the agent sets `working` / `done` with `rply ack`.

## 12. Development

- Node 24+ runs the TypeScript directly (type stripping), so there is no build step for the server. Use `.ts` extensions in relative imports and only erasable syntax (no enums, no parameter properties).
- `npm run dev:server` (watch mode, `rply.db` in the cwd) plus `npm run dev:web` (Vite on 5173, proxies `/v1` to 8080). `npm run build` builds the web app into `apps/web/dist`, which the server serves at `/` with an SPA fallback.
- `npm test`, `npm run typecheck`.
- Server env: `PORT` (8080), `RPLY_DB` (path to the SQLite file), `RPLY_ADMIN_TOKEN` (optional), `RPLY_WEB_DIR` (defaults to `apps/web/dist`), plus the files (7b) and push (7c) variables.
- Web app design rules (tokens, layout, components, do's and don'ts) live in `apps/web/DESIGN.md` (Google's DESIGN.md format, lint with `npx @google/design.md lint apps/web/DESIGN.md`). Read it before UI work and update it when the design changes.
- Web app: React + Vite + Tailwind v4 + shadcn (radix, nova preset, components in `src/components/ui`). Inter is the font everywhere. `src/index.css` defines the design tokens: a warm `gray-50…950` scale, semantic colors mapped onto it (plus `sidebar`), and an app-sized typescale (`text-sm` 13px, `text-base` 14px). Use these instead of raw colors or `text-[..]` sizes. Layout: a darker sidebar separated from the content by a single border. Prefer background tints (`bg-muted`) over borders; keep borders for form controls and table rows + TanStack Query + wouter. Paired channels, read positions and the optional admin token live in localStorage (`src/lib/channels.ts`, built on `src/lib/store.ts`). Requests use `auth(entry)`, which adds `X-Rply-Channel` for admin entries. One `/v1/sync` long-poll loop (`src/lib/sync.ts`) upserts changed messages into the query cache (`applySynced`; the pinned `status` message goes to the status query). Blocks render through `components/blocks/MessageBlocks.tsx` (question state, auto-submit vs "Send answers", answered/expired/cancelled), `Inputs.tsx` and `HtmlBlock.tsx` (sandboxed `iframe` with `sandbox="allow-scripts"` and `srcdoc`, plus a bridge exposing `rply.reply(value)` and `rply.resize(height)` through `postMessage`). Answer messages are hidden in the thread and shown inside their question.
- Server tests use `app.request()` against an in-memory database (`packages/server/test`).
- Shared client logic lives in `packages/schema/src/helpers.ts` (ask status incl. client-side expiry, defaults, collecting answers, required checks, the submit-on-tap rule, previews). Web, mobile and CLI import it from `@rply/schema`; keep UI-free logic there instead of duplicating it per app. `helpers.ts` imports only types from `index.ts` to avoid a require cycle.
- Mobile renders markdown with `react-native-marked` and `html` blocks in a `react-native-webview` WebView (same `rply.reply` / `rply.resize` bridge via `ReactNativeWebView.postMessage`; navigation away is blocked and http(s) links open externally). `HtmlBlock.web.tsx` uses a sandboxed iframe for the Expo web build. If changes don't show up in Expo, restart with `npx expo start --clear` (stale Metro cache).
- CLI commands whose main argument is free text (`send`, `ask`, `edit`, `pin set/patch`) use `allowUnknownOption()` so text starting with `-` (markdown lists) isn't parsed as an option.
- Mobile app (`apps/mobile`, Expo SDK 57): Expo Router (routes in `src/app`), Uniwind for Tailwind v4 classes (`metro.config.js`, `src/global.css`, generated `src/uniwind-types.d.ts`), TanStack Query, expo-secure-store. Run with `npm run dev:mobile` and open in Expo Go, or press `w` for web (storage falls back to localStorage there). Add native packages with `npx expo install` inside `apps/mobile`. `apps/mobile/AGENTS.md` has Expo's own guidance: check the SDK 57 docs instead of relying on memory.
- Unlike the web app, the mobile app talks to several servers. Each stored channel carries its `server`, owner sessions are per server, and `src/lib/sync.tsx` runs one sync loop per server.
- The whole repo uses one React version, pinned by root `overrides` to what Expo requires (19.2.3). Two copies of React in the mobile bundle break hooks, so bump it together with the Expo SDK.
- The API sends permissive CORS headers (`*`). That's safe because auth is bearer tokens, not cookies, and it lets the Expo web build and future multi-server web clients reach any server.
- Deploy: the root `Dockerfile`. Railway is defined in `.railway/railway.ts` (Railway IaC, applied with `railway config plan` / `railway config apply`; `railway.json` is deprecated). It declares the service, the Dockerfile build, the healthcheck and a volume at `/data`. `RPLY_ADMIN_TOKEN` is `preserve()`d, so set it in the Railway dashboard. Generate the public domain in the dashboard, since IaC doesn't manage generated domains. Run one replica only (SQLite).
- CLI (`packages/cli`, commander): run locally with `npm run rply -- <command>`. Config lives in `~/.config/rply/config.json` (mode 0600; override the path with `RPLY_CONFIG`) as `{ default, channels: { <key>: { server, token, channel, inbox_cursor } } }`. One machine can hold several channels. `init` saves each under `--channel <key>` or a slug of `--name`, and the first becomes the default. Other commands pick a channel with `--channel` / `RPLY_CHANNEL`, otherwise the default. `rply channels` lists them, and `rply channels use|remove` change the default or forget one. Old single-channel config files are migrated when read. `RPLY_SERVER` + `RPLY_TOKEN` override it (for CI), and `RPLY_SERVER_TOKEN` feeds `init --server-token`. Long waits poll in 55s chunks and retry through network errors and 5xx, so they survive server restarts. Exit code 2 means timeout. The QR code only prints when stdout is a TTY, so it doesn't fill an agent's context.
- `inbox` and `listen` skip answers to questions (messages with `reply_to`); those come through `ask --wait` or `rply wait <id>`. `ask` without `--choices`/`--confirm`/input blocks adds a `text_input` (id `answer`). With `--wait`, one question prints its value, several print a JSON object; exit 2 = expired without default or timed out, 3 = cancelled. `--timeout` also sets the question's expiry unless `--expires` is given.
- Migrations were reset to a single `0001_init` on 2026-10-11 (no data to keep). Any database created before that must be deleted once. Since then they're additive again: `0002_secrets` adds `secret_requests`, `0003_files` adds `files`, `0004_push` adds push subscriptions, `0005_agents` adds `agent_tokens` (copying each channel's old agent token), `pairing_codes.role` and `secret_requests.public_key`. `channels.agent_token_hash` is no longer read and can be dropped in a later release.
- `@rply/schema` has three entry points: `.` (zod schemas and types), `./helpers` (UI-free logic, imports only types) and `./crypto` (sealed box, keypairs, fingerprints; `@noble/*`). The CLI must import runtime values only from `./helpers` and `./crypto`, never from `.`, or zod ends up in its bundle (~170 KB without, ~630 KB with).
- Mobile polyfills `crypto.getRandomValues` from `expo-crypto` (`src/lib/polyfills.ts`, imported first in `_layout.tsx`) because the `@noble` libraries need it. Both apps render secret cards through `SecretBlock`, which gets the channel from `ChannelContext` (provided around the thread and pins).
- Publishing the CLI: `npm run build -w @rply/cli` bundles everything with esbuild into `packages/cli/dist/rply.js` (Node won't strip types inside `node_modules`). All runtime libraries are devDependencies because they're inlined, so the published package has no dependencies. `prepublishOnly` runs the build. To release, bump `version` in `packages/cli/package.json`, then `npm publish -w @rply/cli`. The npm package is `@rply/cli` (npm blocked the unscoped name `rply` as too similar to existing packages), but the command it installs is still `rply`.
- Website (`apps/site`): Astro + Starlight + Tailwind v4 for rply.sh. Marketing pages are plain Astro pages in `src/pages` (shared `layouts/Page.astro`, reusable pieces in `src/components`), docs are Markdown in `src/content/docs/docs/` and served under `/docs/`, with the sidebar groups defined in `astro.config.mjs`. Design tokens (type scale `text-display/h2/h3/lead/body/ui/small/caption`, colors `ink/secondary/muted/paper/line`, periwinkle `accent-*`) live in `src/styles/theme.css` and are shared by `global.css` (marketing, full Tailwind) and `docs.css` (Starlight via `@astrojs/starlight-tailwind`, no preflight). Use these tokens instead of raw sizes. Run with `npm run dev:site` / `npm run build:site`. The site lists `cookie@^2` as a direct dependency because the web app's tooling hoists `cookie@0.7` to the root, which breaks Astro's prerender build.
- Update check (`packages/cli/src/update.ts`): at most once a day the CLI fetches the latest `@rply/cli` version from the npm registry (1.5s timeout, cached in `update-check.json` next to the config). If a newer version exists, it prints a notice to stderr after the command, telling the agent to run `rply update` (which runs `npm install --global @rply/cli@latest`). `RPLY_NO_UPDATE_CHECK=1` turns it off.

## 13. Name

- **rply**, domain **rply.sh**, CLI `rply`. The name follows ntfy's style: a plain verb with the vowels dropped, nothing abstract or cute. It's about replying to and talking with agents, not just notifications.
- npm refused the unscoped name `rply` as too similar to `rlp`, `mlly`, `cpy` and `spdy`, so the CLI is published as `@rply/cli` (npm org `rply`). The GitHub username `rply` is taken (the repo is `joshuaKnauber/rply`).

## 14. Milestones

1. **Server core**: schema package, Kysely + SQLite + migrations, channels, pairing, messages, replies, inbox, status, long-polling, Dockerfile.
2. **CLI**: init (QR + link), pair, send, ask --wait, inbox, listen, status set/patch. Dogfood it with the SEO agent on exe.dev, keeping ntfy alongside as a fallback.
3. **Web app**: pairing via link or pasted code, channel list, thread, buttons/form rendering, replies, status page, live updates via `/v1/sync`. Served by the server. Deploy to Railway.
4. **E2E**: channel key, `--e2e`, `e2e enable`, lock icon, downgrade warning.
5. **Mobile app**: Expo app with the same features, QR scanning.
6. **Push**: web push done; relay service plus wake-and-fetch, Expo notifications.
7. **Secrets**: keypair on init, sealed-box encryption in the apps, `.env` writer, expiry.
8. **Packaging**: one-line install, exe.dev / Hetzner / Railway guides, agent skill snippet.
9. **Later**: hosted rply.sh with accounts and Postgres, remote MCP, `run --with-secrets`, MCP Apps.

## 15. Open questions

- Exact component set for v1.
- Multi-user / team support: when?
- Retention policy for messages on the server.
- Should the web app support channels from several servers (needs CORS), or only its own server?
