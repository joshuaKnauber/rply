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
- **Server**: Node, Hono, Kysely. SQLite (`node:sqlite`) by default for self-hosting, Postgres (`pg`) when `RPLY_DATABASE_URL` is set (the hosted version: PlanetScale Postgres, see `TODO-hosted.md`). Shipped as a Docker image (Railway: mount a volume at `/data` for SQLite).
- **Portable SQL**: text IDs (not rowid), JSON stored as text, timestamps as integer milliseconds, no SQLite-only features. Dialect differences live in `src/db/dialect.ts`: the `seq` columns are `integer autoincrement` in SQLite and `bigserial` in Postgres (`seqColumn`). `pg` returns `int8`/`numeric` as strings, so `db/index.ts` parses them to numbers. Postgres hands out `seq` values before commit, so inserts into `messages` and `changes` go through `inSeqOrder` (`insertMessage`, `recordChanges`), which takes a transaction-level advisory lock; otherwise a cursor could move past a row that commits later and skip it.
- **Migrations**: Kysely `Migrator`, numbered TS files (`0001_init.ts`) using the schema builder so they run on both dialects. Imported explicitly, not globbed from disk. Run automatically on server start. Before applying pending migrations on SQLite, copy the db file to `rply.db.bak-<version>` (Postgres relies on the provider's backups). Forward-only, never edit a shipped migration, destructive changes in two releases (stop using, then drop).
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
apps/video         product video (Remotion)
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
4. The app shows a masked field. It **seals** the value to the block's `public_key` (the requesting agent's key) (`@rply/schema/crypto`: ephemeral X25519 + HKDF-SHA256 + XChaCha20-Poly1305, output `v1.<base64url>`) and posts only the ciphertext (`POST /v1/secrets/:id/fulfil`). The human can also decline.
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
- **Security**: only `image/png|jpeg|gif|webp` and `video/mp4|webm|quicktime` are served inline (the web app plays videos in a `<video>` player, falling back to the download row if the browser can't play it; mobile still shows a download row); everything else (SVG, HTML, ...) as `application/octet-stream` with `Content-Disposition: attachment`, `nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`, because uploads share the origin with the web app and its tokens.
- Files are opaque bytes with the description (name, type) kept in the message, so E2E can later encrypt files client-side before upload.
- Not built: thumbnails/resizing, virus scanning.

## 7c. Web push notifications (built)

The web app can notify about agent messages while the tab is closed (desktop browsers; on iPhone only once added to the Home Screen).
- **VAPID**: the server generates a keypair on first start and keeps it in the `settings` table, or takes `RPLY_VAPID_PUBLIC_KEY` + `RPLY_VAPID_PRIVATE_KEY`. `RPLY_VAPID_SUBJECT` defaults to `https://rply.sh`. `RPLY_PUSH=off` disables it. `/v1/info` returns `push: { public_key } | null`. Sending uses the `web-push` library (`packages/server/src/push/`). Push services need HTTPS, except on `localhost`.
- **Subscriptions are per browser and user**: the bell in the sidebar subscribes once and `PUT /v1/push/subscription { subscription }` (signed in) stores it with the user; it notifies for every channel the user is a member of. Deleting the user cascades; push services answering 404/410 delete the row.
- **What notifies**: agent messages (`rply send --silent` / `silent: true` opts out) and secret requests. Title = channel name (plus ` · <agent label>` when the channel has more than one active agent), body = preview (questions prefixed with ❓), click opens `/c/<id>`, `tag` = channel, so one notification per channel replaces the last. Content goes through the push service end-to-end encrypted (RFC 8291) but the server reads it; E2E channels will need a generic text.
- **Presence**: `/v1/sync` sends `viewing` (the open channel while the tab is visible) and `push_endpoint`. The server skips that endpoint for that channel until the long-poll plus 15s runs out, so the channel you're looking at doesn't ping you.
- **Web app**: `public/sw.js` (shows the notification, focuses an open tab via a `rply:open` message or opens one), `public/manifest.webmanifest` + icons (installable PWA, required for iOS push), `src/lib/push.ts`, `components/NotificationsButton.tsx`. The endpoint is stored as `rply.push` in localStorage.
- Mobile push (relay, section 5) is separate and not built yet.

## 7d. Apps (built)

Full-page HTML apps per channel for dashboards and control spaces, replacing custom agent-hosted websites.
- **An app is a pin** whose body has `view: "app"` (in `PinnedBody`, so E2E pins can carry it too). No separate entity: it reuses pins, sync, editing, deletion and files. `rply app set <key> <file.html> [--title ..]` puts one `html` block (id `app`) into it. The agent only sends HTML; apps fetch their own data with `rply.call`.
- **Where apps show**: web lists them in the sidebar under their channel (`ChannelList`, pins fetched for every channel with `useAllPins`), route `/c/:id/a/:key` (`AppView.tsx`; header "Channel / App", the right panel is hidden). Mobile shows them as a row of tabs under the header (component state, no route). An app with exactly one `html` block and no text fills the area (`HtmlBlock` with `fill`); anything else renders as scrollable blocks. Apps are filtered out of the pinned list (`isApp` from helpers). The human removes an app from its header menu ("Remove app"): `DELETE /v1/pins/:key` is allowed for the human side only when the pin is an app (other pins are unpinned instead, which would dump a full-page app into the chat).
- **Bridge** (`embedDocument` in helpers, all clients) is wrapped in a closure, so the only globals are `window.rply` and `__rplyReceive` and apps can use any names (`packages/server/test/embed.test.ts` runs it in `vm`). It strips a leading `<!doctype>` and `<html>` tags, so pages can be fragments or full documents. `rply.theme` reads `data-theme`; theme changes fire a `rply:theme` window event. CSS variables include `--rply-bg`, `--rply-success`, `--rply-warning`, `--rply-danger`. Page errors and unhandled rejections post `{ rply: "error", message }`; the clients show a banner ("This app hit an error: …") with "Send to agent", which sends an event with value `{ error }` through the block's normal event path. `rply.call(name, args) → Promise` runs a command script, `rply.agent(name, args) → Promise` asks the agent (both reject with an `Error`: `offline`, `timeout`, or the command's error), and `rply.storage.get/set`. The page says explicitly which one it wants, so a dashboard polling scripts can never flood the chat. Storage is a snapshot injected into the document plus `{ rply: "storage" }` messages, persisted on the server per user, channel and pin key (or message id) in `app_storage` (`GET /v1/storage` loads a channel's values, `PUT /v1/storage/:key` saves one, max 256 KB), so it follows the user across devices. Results go back as `{ rply: "result", id, result | error }`, via `postMessage` on web and `injectJavaScript(__rplyReceive(..))` on native. `HtmlBlock` reads the channel from `ChannelContext` and the message from `MessageContext` (provided around thread messages, pins and apps), so calls work from any agent message's html block, not only apps.
- **Command scripts**: executables in `~/.config/rply/commands/<channel key>/<name>` (`rply app commands` prints the folder; `serve --dir` overrides). Names match `COMMAND_NAME` (`[A-Za-z0-9_-]{1,64}`), which also keeps them safe as file names. `rply serve` (`commands/serve.ts`) long-polls `GET /v1/calls?wait=55&commands=..[&wakes=1]` (re-reading the folder each poll, so new scripts need no restart), runs the script directly (no shell) with `args` as JSON on stdin and env `RPLY_CHANNEL` / `RPLY_CALL_NAME` / `RPLY_CALL_ID` (plus `RPLY_NO_UPDATE_CHECK` / `RPLY_NO_GUIDE_HINT`, so scripts that call rply stay quiet), and posts stdout (JSON if it parses, else the trimmed string, empty → null; max 4 MB, the server accepts 5 MB bodies on `/calls/:id/result` only; stored `rply.agent` results stay capped at 256 KB with a 413). Non-zero exit → `{ error }` with the last stderr line; 30s limit. The HTML can only name a command; scripts must validate `args`.
- **Agent commands**: `rply.agent` (request `agent: true`) always becomes a human message `{ call: { name, block_id, args } }` with `reply_to` the app message; the call id is that message id. `inbox`/`listen` print `call "plan" from app in message <id>: {...}` plus the `rply respond` hint. `rply respond <id> [json|text|-] [--error ..]` stores `result`/`error` in the call body and sets state `done`. The apps show it as a compact "Called plan" line. Humans can't forge calls through `POST /messages` (zod strips `call`). If the app was closed before the answer, the result is only in the message.
- **Server** (`routes/calls.ts`, state in memory per app instance, nothing stored for script calls): serve registrations are per agent token (`{ commands, polling, seen, queue }`), online while polling or within 15s of the last poll; `serve` re-registers within seconds after a server restart. `POST /v1/calls { message_id, block_id, name, args, agent?, wait? }` (human): without `agent`, the call is queued for an online `serve` that registered the name and waits up to 35s (503 `offline` if no `serve` is online for the channel, 404 if none has that command, 504 `timeout`). With `agent: true` it creates the call message and waits `wait` seconds. Response: `{ id, status: "done", result } | { id, status: "error", error } | { id, status: "pending" }`; clients keep polling `GET /v1/calls/:id?wait=`. `POST /v1/calls/:id/result { result } | { error }` (agent) resolves a waiting script call or answers an agent call (409 if already answered).
- **URL apps (previews)**: `rply app set <key> <http(s) url>` makes the app body a single `link` block (id `app`); `appUrl` (helpers) detects it. Web frames it full-page (`sandbox` with `allow-same-origin`, which is safe only because it's cross-origin, so same-origin URLs fall back to the normal blocks view) with reload and open-in-new-tab in the header; mobile uses `UrlView` (WebView, iframe on Expo web) with a small bar. rply doesn't tunnel anything: `rply guide previews` teaches the agent the options (OpenTunnel first, then Tailscale serve, the platform's proxy, cloudflared/ngrok/localtunnel) and tells it to ask the human which to use first and remember the choice. Old clients just show the link.
- **Testing**: `rply app call <name> [json]` runs a command exactly as `serve` does (shared `packages/cli/src/scripts.ts`). `rply app set` compiles the page's inline classic scripts with `node:vm` and refuses to upload on syntax errors; it prints "created" or "updated".
- **Waking the agent**: `rply serve --on-message "<cmd>"` also watches the inbox (`peek=1`, its own `wake_cursor` in the channel config, starting at the latest message on first run, so messages that arrive while it's down still wake the agent afterwards) and runs `sh -c <cmd>` in the current directory for new human messages (texts, events, `rply.agent` calls; not answers), with them as JSON on stdin and `RPLY_CHANNEL` set. One run at a time; messages arriving during a run are batched into one follow-up run; runs are killed after `--on-message-timeout` (default 1h, `0` for never; the guide says not to background the agent from the hook, since runs would overlap). The agent's own `rply inbox` (separate `inbox_cursor`) still marks messages seen, so a failed run loses nothing. `GET /v1/agents` returns `serve: { commands, wakes } | null` per agent (in-memory registry `serves.ts`, shared by the calls and channel routes), and `serve` warns when another agent on the channel already wakes.
- **Service** (`packages/cli/src/service.ts`): `rply serve --install [--on-message ..] [--dir ..]` writes a systemd user unit `rply-<key>` (`Restart=always`, plus `loginctl enable-linger`) on Linux or a launchd agent `sh.rply.<key>` (`KeepAlive`) on macOS, with the current directory, `PATH` and `RPLY_CONFIG`, logging to `logs/<key>.log` next to the config. It refuses to install from an npx copy. `--uninstall` removes it. A manual `rply serve` refuses to start while the channel's service is running (the service sets `RPLY_SERVICE=1`). Tested on macOS; the systemd path is untested.
- **Setup and onboarding**: `rply guide setup` is the checklist an agent follows on a new machine (install globally, join, read the guide, add the snippet, choose a headless wake command, `serve --install --on-message`, verify with a test message, report honestly if something can't work). `init`/`join` end with "Next: run `rply guide setup`". The web app's add-channel page and "Add an agent" dialog show a copyable prompt (`joinPrompt` / `initPrompt` in `lib/pairing.ts`) instead of bare commands; the details stay in the guide so they match the installed CLI version.
- **Several channels and agents**: one service and one commands folder per channel per machine; apps are per channel and shared by all its agents; only one agent per channel should use `--on-message`; script names should be unique within a channel.
- **Later**: MCP access is just a command script that calls the MCP server. E2E channels need call args and results sealed with the channel key (call messages are plaintext today).

## 7e. Limits (built)

`src/limits.ts`, created once per server as `deps.limits` (rate limiter state lives in memory, so one instance).
- **Guards, always on** (`GUARDS`): they protect the server and stay out of the way of normal use. 120 writes a minute per channel (new messages, edits, pins, secret requests), 120 script calls a minute per channel, 30 uncached link previews a minute per channel, 10 open long-polls per agent or user (`MAX_WAITS_PER_CLIENT` in `notifier.ts`; `longPoll` takes the `client` key), 10 wrong claim or agent codes per IP per 15 minutes (only failures count), 20 agents per channel, 20 anonymous channels per IP per hour. Unclaimed channels can't upload files, hold at most 100 messages and are deleted after 24 hours however often `rply pair` renewed the code.
- **Quotas per account, off unless set** (`Quotas`, from env): counted over the channels the user owns. `RPLY_LIMIT_CHANNELS` (owned channels; creating and claiming), `RPLY_LIMIT_MESSAGES_PER_DAY` (rolling 24h, every new message in their channels incl. pins, secret requests and `rply.agent` calls; 429), `RPLY_LIMIT_STORAGE` (file bytes; 507), `RPLY_MESSAGE_RETENTION` (e.g. `30d`; `sweepOldMessages` deletes unpinned messages and their files). File retention is separate and can be shorter (`RPLY_FILES_RETENTION`). Self-hosted servers usually leave them off; rply.sh sets them. `GET /v1/account/usage` returns the set quotas with the user's current use (null for unset ones); Settings shows a Usage section with a bar per quota only when the server sets any.
- **Sweeps**: no cron; `index.ts` runs `sweepFiles`, `sweepUnclaimed` and `sweepOldMessages` once at startup and then every 10 minutes (`setInterval`). Fine for one instance; several would only repeat the work.
- **Client IP** (`clientIp`): the last `X-Forwarded-For` entry, the one the proxy in front appended; the first ones can be forged. better-auth's own sign-in rate limit puts multi-entry headers into one shared bucket, so forging doesn't help there either.

## 7f. Agent avatars (built)

Every agent token is an animated rply bird in the web app (channel list, thread, agents panel); design rules in `apps/web/DESIGN.md`.
- **Look**: `BirdLook` (schema) is `{ color, crest, eyes, hat, accent, cheeks, belly }`, indexes into `BIRD_COLORS` / `BIRD_CRESTS` / `BIRD_EYES` / `BIRD_HATS` (helpers; `hat` also covers the monocle, headphones and scarf, `accent` colors them). `birdLook(id, agents)` returns the saved look (`agent_tokens.avatar`, JSON) or generates one from the token id; agents of a channel, in join order (`GET /v1/agents` is ordered by `created_at`), skip colors and crests already taken.
- **Customizing (web)**: clicking a bird or agent name in the channel list, thread or agents panel opens `AgentCreator` (`lib/customize.ts` holds which agent; the host is mounted in `App.tsx`): a big bird that follows the pointer and can be poked, Stardew-style pickers, randomize/reset, and the name. Every change makes the bird emote (`bird.emote`: love, surprise, music, sparkle, spin, with a speech bubble); typing the name makes it chirp. Saving `PATCH /v1/agents/:id { label?, avatar? }` (any human member; `avatar: null` goes back to the generated look, which the dialog also sends when the look equals it) and refetches agents and messages. The agent's own `rply rename` still works and the last write wins.
- **Mood**: `agentMood(agent, messages)` (helpers): `waiting` (the agent has an open ask or secret request), `working` (a human message it acked `working`; the ack stores `state_agent_id` on the message), `offline` (no `serve` and not seen for 15 minutes), else `idle`. The web component turns working → idle into a 3s `done` celebration.
- **Engine**: `apps/web/src/lib/bird.ts` draws the logo path as SVG and animates it with springs plus a little physics (hops with gravity, a tail that bends instead of being cut out, eye saccades and blinks), one shared `requestAnimationFrame` loop that skips birds outside the viewport. `components/AgentAvatar.tsx` wraps it: `mood`, `chirp` (grows with the agent's last message seq, which makes it chirp and the channel's other birds glance over) and `dot` (the waiting badge). `prefers-reduced-motion` drops the moves.
- Mobile doesn't have avatars yet; it can reuse the helpers and port `bird.ts` to react-native-svg.
- The site's mockups (hero, interactive demo) use a copy, `apps/site/src/components/agent-bird.ts`: `<span data-bird="<agent id>" data-size="28">` placeholders mounted by `mountBirds`, driven by `setMood(id, mood)` and `chirp(id)` from the hero loop and `demo.ts`. The copy is on purpose; keep the two in sync when the motion changes.

## 8. Channels, auth and E2E (decided)

### Accounts and channels
Humans have accounts on every server, self-hosted included (modelled on Plausible CE); agents don't. Human messages are instructions to an agent with shell access, so the two sides have separate credentials:

| credential | held by | can |
|---|---|---|
| agent token `rply_a_…` (one per agent) | CLI on the agent machine | post as agent, read human messages, set status, request secrets |
| account session (better-auth) | web / mobile app | the human side of every channel the user is a member of |

- **Sign-in** (`src/accounts.ts`, better-auth mounted at `/v1/auth/*` on our Kysely instance, telemetry off): email + password always; passkeys when `RPLY_URL` is set (rpID from it); email verification, password reset and magic links only when email is configured (`RPLY_RESEND_API_KEY` + `RPLY_EMAIL_FROM`, `src/email.ts`; requires `RPLY_URL`). The session secret comes from `RPLY_AUTH_SECRET` or is generated once into `settings`. Without email, `node packages/server/src/reset-password.ts <email>` prints a new password and signs the user out everywhere. `node packages/server/src/delete-user.ts <email>` removes an account and the channels it owns (for abuse).
- **Deleting an account**: better-auth's `POST /v1/auth/delete-user` (password, or a session from the last day). Its `beforeDelete` hook (`beforeDeleteUser` → `deleteOwnedChannels`) deletes every channel the user owns, files included; memberships elsewhere, sessions, app storage and push subscriptions cascade. Web: Settings > Delete account; mobile: Account screen (required for the App Store). Deleting the last user puts the server back into first-run setup.
- **Data export**: `GET /v1/account/export` (user, `routes/account.ts`) returns JSON as a download: the user plus every channel they're a member of with its role, agents (labels and dates, never tokens), live messages (as the apps see them, encrypted ones as ciphertext), file metadata and their app storage. File contents aren't included. Web: Settings > Your data.
- **Registration**: the first user to register sets the server up (`/v1/info` → `needs_setup`). After that `RPLY_REGISTRATION=open|invite|closed` (default `invite`, which is closed until invites exist), enforced in a `user.create.before` hook, so magic links can't create users either.
- **Sessions**: the web app uses better-auth's httpOnly cookie (`rply.session_token`, same origin); mobile and scripts send the session token as a bearer (better-auth's `bearer` plugin, returned in the `set-auth-token` header, which CORS exposes). Because cookies ride along automatically, `app.ts` refuses writes that carry a cookie but no `Authorization` header unless `Origin` matches the server's own host (better-auth checks its own routes). Channel-scoped human routes also need the custom `X-Rply-Channel: <id>` header, which forces a CORS preflight.
- **Membership**: `channel_members (channel_id, user_id, role owner|member, read_seq)`. A human request is `session + X-Rply-Channel`; `requireAuth` checks membership (404 if not a member) and sets `auth.role`. Owners delete the channel (`DELETE /v1/channel`), add agents (`POST /v1/pairings` → agent code) and revoke them; members (via invites, later) read and reply. `read_seq` is the read position (`PUT /v1/channel/read { seq }`, only moves forward), so unread counts match across devices.
- Agent tokens are stored only as SHA-256 hashes. The prefixes make leaked tokens easy to spot. Agent requests authenticate with one query (token joined with its channel); `last_seen_at` is only written when it's older than a minute (`markSeen`).
- One channel per agent is the default, but an agent may use several (e.g. one per project). Cron scripts and CI use channels too.
- Several agents on one channel: messages carry `agent: { id, label }` (joined from `agent_tokens`, so renames show on old messages too). The apps show the agent's label instead of the channel name when the channel has more than one active agent (`GET /v1/agents`, `agentName` in helpers), and web groups messages per agent. Push titles follow the same rule (`Channel · label`).
- **Mentions**: the web composer (tiptap, `components/Composer.tsx`) offers `@agent` suggestions when the channel has several agents. `POST /v1/messages` takes `mentions: [agent id]` at the top level (human only, active agents of the channel, outside the body so E2E channels can route too), stored in `messages.mentions`. An agent reading `GET /v1/messages` only gets human messages that mention it or nobody; its cursor still moves past the others, and only it marks them seen. So `inbox`, `listen` and the `--on-message` wake all follow mentions; the CLI prints `(mentions you)`. The thread highlights `@label` in sent messages. Mobile can't mention yet.

### Creating and joining channels
1. **App first (main path)**: a signed-in user creates the channel (`POST /v1/channels` with a session) and becomes its owner; the response carries a single-use **agent code** (1 hour). The agent runs `rply join <server-url> <code>` (`POST /v1/agents/join`). "Add an agent" issues more codes (a second agent, or one that lost its config).
2. **Agent first**: `rply init <server-url> --name "SEO bot"` without credentials creates an **unclaimed** channel (`POST /v1/channels`, rate-limited to 20 per hour per `X-Forwarded-For` IP) and returns the agent token plus a **claim code**. The CLI prints a link (`https://<server>/claim?c=K7QX-M2PD`) and a QR code in a TTY. A signed-in user claims it (`POST /v1/channels/claim { code }`) and becomes the owner. The agent can post meanwhile. `rply pair` (agent, `POST /v1/pairings`) issues a new claim code while the channel is unclaimed (409 after). `sweepUnclaimed` deletes channels with no member and no unexpired claim code once they're over an hour old, and any unclaimed channel after 24 hours.
3. The code, not a credential, is printed because CLI output can end up in the agent's context or logs. A used code is worthless. Agent codes and claim codes share `pairing_codes` (`role` `agent` / `human`) and only work on their own route.
4. Deleting a channel removes its stored files, then the row; everything else cascades (messages, tokens, codes, secrets, members, app storage). Agents get 401; members' `/v1/sync` drops it from `channels`.
- Removed with accounts: human tokens, device pairing, `/pair?c=`, owner mode, `RPLY_ADMIN_TOKEN`, the `/v1/admin` routes and the channel-level public key (secret blocks always carry the requesting agent's key). The migrations were squashed at the same time, so servers get set up again.

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
- **`rply guide`** teaches agents the CLI (topics: setup, basics, ask, blocks, html, pins, apps, previews, secrets, files; `all` skips setup; `--snippet` prints lines for AGENTS.md/CLAUDE.md). To make sure agents read it: `init`/`join` end with "Next: run `rply guide setup`", every command prints a stderr hint until the guide was read for the installed version (stored in `guide.json` next to the config, `RPLY_NO_GUIDE_HINT=1` turns it off), 400s on `/messages` and `/pins` point to `rply guide blocks`, and the join command the app shows ends with `rply guide`. Keep the guide in `packages/cli/src/commands/guide.ts` in sync when commands or blocks change.

## 10. Hosted version (later, plan for it now)

rply.sh hosting is not part of v1, but the design leaves room for it:
- Accounts work the same self-hosted and hosted (section 8); rply.sh runs with `RPLY_REGISTRATION=open` and email configured.
- Hosted needs **user accounts** for quotas, abuse prevention, recovery after losing a phone, and syncing the channel list to a new device. Probably passkeys or magic links, e.g. via better-auth.
- Prepared now: accounts, Postgres support, notifier interface so long-polling works across instances. See `TODO-hosted.md`.
- E2E would likely be the default on rply.sh ("we can't read your agents' messages").

## 11. Sketches (not final)

### CLI commands
```
rply init <server-url> [--name ..] [--e2e]   # creates channel, prints the claim link (+ QR in a TTY)
rply join <server-url> <code>           # join a channel created in the app (agent code)
rply rename <name>                      # name this agent shows in the app (init/join take --agent-name, default: hostname)
rply guide [setup|basics|ask|blocks|html|pins|apps|previews|secrets|files|all] [--snippet]   # usage guide for agents
rply pair                               # new claim link while the channel is unclaimed
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
rply app set <key> <file.html|url> [--title ..] | app list | app remove <key> | app commands   # apps (section 7d)
rply serve [--dir ..] [--on-message <cmd>] [--install|--uninstall]   # scripts for rply.call, wake the agent, background service
rply respond <call-id> [json] [--error ..]   # answer a call without a script
rply delete <message-id>
rply send "Weekly report" --image chart.png --file data.csv      # --image/--file repeatable, also on pin set
rply file upload <path> | file get <file-id> [--to path] [--force]
rply secret request NAME --to .env [--file] [--reason ".."] [--expires 1h] [--wait] | secret fetch <id> | secret cancel <id>
rply e2e enable
```
Output should be machine-friendly (JSON with `--json`) and self-describing (`--help`, perhaps a `describe` command that prints a JSON schema, as Agent Mail CLI does).

### Server API
The token decides the channel and the sender side, so most routes don't need a channel ID.
- `/v1/auth/*`: better-auth (sign-up/sign-in/sign-out, sessions, passkeys, magic links, password reset)
- `GET /v1/channels` (user) → `{ channels: ChannelEntry[] }` (channel + `role` + `read_seq`); `POST /v1/channels` → with a session: owned channel + agent code; without a session: unclaimed channel + agent token + claim code; `POST /v1/channels/claim { code }` (user)
- `POST /v1/pairings` → agent: new claim code while unclaimed; owner: new agent code. `POST /v1/agents/join` (agent code) → agent token
- `GET /v1/account/export` (user) → JSON download of the account's data
- `DELETE /v1/channel` (owner), `PUT /v1/channel/read { seq }` (human), `GET /v1/storage`, `GET|PUT /v1/storage/:key` (human: app storage)
- `GET /v1/channel` (either side) → channel info; `GET /v1/agents` (either side) → agent tokens `{ id, label, avatar, created_at, last_seen_at, current, serve }`; `DELETE /v1/agents/:id` (owner) revokes one; `PATCH /v1/agents/:id { label?, avatar? }` (human) renames it or sets its bird; `PATCH /v1/agent { label }` (agent) renames itself
- Human-side channel routes take a session plus `X-Rply-Channel: <channel id>`
- `GET /v1/info` (no auth) → `{ needs_setup, registration, email, passkeys, files, push }`, used by the apps to show the right sign-in options
- `POST /v1/messages` (agent or human; `reply_to` + `answers` answers a question), `GET /v1/messages?since=&wait=&sender=&pinned=1&peek=1` (without `since`: latest page, no waiting; the agent reading human messages marks them seen unless `peek=1`)
- `PUT|PATCH /v1/messages/:id` (agent edits), `POST /v1/messages/:id/cancel` (agent cancels a question), `POST /v1/messages/:id/state` (agent: seen|working|done on a human message)
- `GET /v1/asks` (agent: open questions), `GET /v1/asks/:id?wait=60` (agent: long-poll until answered, expired or cancelled → `{ message, answer }`)
- `GET /v1/pins`, `PUT|PATCH|DELETE /v1/pins/:key` (agent; the human may DELETE apps; keys are 1-32 of `a-z0-9_-`), `POST /v1/messages/:id/unpin` (either side, moves it into the thread), `DELETE /v1/messages/:id` (agent, soft delete)
- `POST /v1/sync` (user; cursor over the `changes` log of all their channels, long-polls; returns changed messages and the current `channels` id list, and also wakes when that list changes)
- `PUT /v1/channel/key` (agent: upload the X25519 public key), `POST /v1/secrets` (agent: create a request + secret message), `GET /v1/secrets/:id?wait=` (agent: long-poll; returns the ciphertext once provided), `POST /v1/secrets/:id/delivered|cancel` (agent), `POST /v1/secrets/:id/fulfil|decline` (human)
- `POST /v1/files?name=` (either side, raw body), `GET /v1/files/:id` (either side of the file's channel)
- `GET /v1/unfurl?url=` (either side) → link preview `{ url, title, description, image, icon, site }`
- `PUT /v1/push/subscription` (user), `DELETE /v1/push/subscription { endpoint }`
- `POST /v1/calls`, `GET /v1/calls/:id?wait=` (human), `GET /v1/calls?wait=&commands=` (agent, `serve`), `POST /v1/calls/:id/result` (agent); section 7d
- later: `POST /v1/devices` (mobile push), `/mcp`

### Data model
```
channels        id, name, e2e, created_at
user, session, account, verification, passkey   -- better-auth's tables (camelCase columns, its own date types)
channel_members channel_id, user_id, role (owner|member), read_seq, created_at
app_storage     user_id, channel_id, app_key (pin key or message id), value (JSON text, max 256 KB), updated_at
agent_tokens    id, channel_id, token_hash, label (hostname), public_key, avatar (BirdLook JSON | null), created_at, last_seen_at, revoked_at
pairing_codes   code_hash, channel_id, role (human|agent), expires_at, used_at
messages        seq (creation order, agent inbox cursor), id, channel_id, sender ('agent'|'human'), agent_id (the agent
                token that sent it; pins: the last writer), enc, body (JSON text or ciphertext), reply_to, pin (null | key),
                state (human msgs: seen|working|done), state_note, state_agent_id (who acked), mentions (JSON agent ids | null),
                created_at, updated_at, deleted_at
asks            message_id, channel_id, status (open|answered|expired|cancelled), expires_at, answer_id, closed_at
changes         seq, channel_id, message_id, created_at     -- one row per insert/edit/state/ask change, drives sync
secret_requests id, channel_id, message_id, name, target, mode (env|file), status (open|provided|delivered|declined|cancelled),
                ciphertext (only while provided), public_key (the requesting agent's), expires_at, created_at, closed_at
files           id, channel_id, message_id (first referencing message), uploader, name, mime, size, created_at, deleted_at
settings        key, value                                   -- e.g. the VAPID keypair
push_subscriptions id, user_id (cascade), endpoint, p256dh, auth, created_at
-- later:
devices         user_id, push_token, platform, created_at   -- mobile push
```

### Messages, blocks and questions (decided)
- **Blocks** are an open list of `{ type, id?, ...fields }`. Display blocks: `markdown`, `heading`, `code`, `link`, `progress`, `keyvalue`, `table`, `html`, `image`, `file` (section 7b). Input blocks (need an `id`): `choice` (options with `description`/`danger`, `multi`, `other`, `default`), `text_input`, `number_input`, `toggle`, `confirm`, and `html` with `"question": true`. The server validates known types and **accepts unknown types**; apps render unknown types as an "update the app" placeholder, so new block types don't need a coordinated release.
- **Questions**: an agent message containing input blocks is an ask (detected from plaintext, or declared with `ask: { expires_at }` for E2E). One message can hold several questions. The human answers **once per message** with `{ reply_to, body: { answers: { <block id>: value } } }`; the first answer wins (later ones get 409), expired and cancelled questions also refuse answers. `default` values live in the blocks and are applied by the CLI on expiry. Apps auto-submit when a message has exactly one simple input (single choice, confirm, html), otherwise they show one "Send answers" button.
- **Embed events vs answers**: inside an `html` block, `rply.send(value, label?)` sends an **event** any number of times: a human message `{ reply_to, body: { event: { block_id, value, label } } }` that is not an answer. It reaches the agent through `inbox`/`listen` (printed as `event "label" from <block> in message <id>: <json>`), and the apps show it as a compact "Sent: label" line. `rply.reply(value)` answers a question and only applies when the block is marked `"question": true` (which requires an `id`). An `id` alone doesn't make an html block a question. Events can only point at agent messages, and replying with an event to an open question doesn't answer it.
- The embed bridge (prepended to the agent's HTML in all three clients) starts with `<!doctype html><meta charset="utf-8">` so embeds don't render in quirks mode, and reports `document.body`'s height through a `ResizeObserver` (`rply.resize` is automatic). On web the parent listens with `useLayoutEffect` so the first measurement isn't missed.
- **Link previews**: bare URLs in markdown get previews from `GET /v1/unfurl?url=` (either side; `routes/unfurl.ts`). The server fetches the page itself: http(s) only, private/local addresses refused (checked on every redirect, max 3), 5s timeout, first 512 KB, HTML only. It reads `og:`/`twitter:` tags, `<title>`, `description` and the icon link (`/favicon.ico` as fallback), and caches results in memory (24h, failures 1h, 1000 entries). `splitUrlLines` (helpers) splits text into markdown parts and URLs alone on a line (max 3, not inside code fences): those render as cards (icon + site, 2-line title, 1-line description, thumbnail); other bare URLs inside text render as chips (web: icon + title; mobile: the title as a text link). Without metadata both fall back to `shortUrl`. `[label](url)` links keep their label and get the site icon in front (from the same preview). Icons and images load directly from the linked site (`referrerPolicy="no-referrer"` on web) and hide when they fail. Human messages aren't markdown, so they get no previews.
- Long content never widens the thread: the web thread column has `min-w-0`, markdown uses `overflow-wrap: anywhere`, markdown tables and code scroll inside their own box, and mobile tables with more than 3 columns scroll horizontally with fixed-width cells.
- Links in embeds: on web the iframe sandbox adds `allow-popups allow-popups-to-escape-sandbox`, and the bridge (parent transport only) turns clicks on http(s) links into `target=_blank rel=noopener` so they open in a new, unsandboxed tab instead of navigating the frame. Native blocks navigation and opens http(s) links externally.
- All three clients build the embed document with `embedDocument(block, transport, theme)` from `@rply/schema/helpers`. It sets `data-theme` (the app's theme, not the system's; the web app updates it live with a `{ rply: "theme" }` message) and default styles for buttons, inputs, links and tables. Agents can use the CSS variables `--rply-fg`, `--rply-muted`, `--rply-border`, `--rply-surface` and `--rply-accent` to match the app in light and dark mode.
- **Editable messages**: agents can `PATCH` (title/text/blocks, or `block_patches` merged by id) or `PUT` (full replace, for E2E) their own messages. Every change writes a `changes` row, and `/v1/sync` returns the current state of changed messages, so edits, ask status and acknowledgements reach all clients live.
- **Pinned messages instead of a status page**: an agent pins messages by key (`PUT /pins/:key`). They float at the top of the chat in both apps (collapsible) and are kept out of the thread. `status` is just a conventional key. The agent's `pin remove` soft-deletes the message (`deleted_at`). The human can unpin from the apps (`POST /messages/:id/unpin`), which clears `pin` so the message moves into the thread at its original position; the agent's next `pin patch` then 404s and `pin set` pins a fresh message. agents can also delete any message they sent, which withdraws an open question. Sync delivers deletions as messages with `deleted_at` set, and clients drop them.
- **Acknowledgements**: reading the inbox (without `peek`) marks human messages `seen`; the agent sets `working` / `done` with `rply ack`.

## 12. Development

- Node 24+ runs the TypeScript directly (type stripping), so there is no build step for the server. Use `.ts` extensions in relative imports and only erasable syntax (no enums, no parameter properties).
- `npm run dev:server` (watch mode, `rply.db` in the cwd) plus `npm run dev:web` (Vite on 5173, proxies `/v1` to 8080 with `changeOrigin: false`, so the server sees the browser's host; otherwise sign-in fails with "Invalid origin"). `npm run build` builds the web app into `apps/web/dist`, which the server serves at `/` with an SPA fallback.
- `npm test`, `npm run typecheck`. `RPLY_TEST_DATABASE_URL=postgres://… npm test -w @rply/server` runs the server tests against Postgres, each test in a fresh schema (e.g. `docker run --rm -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:17-alpine`).
- Server env (limits in 7e): `PORT` (8080), `RPLY_DB` (path to the SQLite file), `RPLY_DATABASE_URL` (`postgres://…`, wins over `RPLY_DB`; files then default to off unless `RPLY_FILES_DIR` or S3 is set), `RPLY_URL` (public URL, for passkeys and email links), `RPLY_REGISTRATION`, `RPLY_AUTH_SECRET`, `RPLY_RESEND_API_KEY` + `RPLY_EMAIL_FROM`, `RPLY_TRUSTED_ORIGINS` (other origins allowed on the auth routes), `RPLY_WEB_DIR` (defaults to `apps/web/dist`), plus the files (7b) and push (7c) variables.
- Web app design rules (tokens, layout, components, do's and don'ts) live in `apps/web/DESIGN.md` (Google's DESIGN.md format, lint with `npx @google/design.md lint apps/web/DESIGN.md`). Read it before UI work and update it when the design changes.
- Web app: React + Vite + Tailwind v4 + shadcn (radix, nova preset, components in `src/components/ui`). Inter is the font everywhere. `src/index.css` defines the design tokens: a warm `gray-50…950` scale, semantic colors mapped onto it (plus `sidebar`), and an app-sized typescale (`text-sm` 13px, `text-base` 14px). Use these instead of raw colors or `text-[..]` sizes. Layout: a darker sidebar separated from the content by a single border. Prefer background tints (`bg-muted`) over borders; keep borders for form controls and table rows + TanStack Query + wouter. The session is better-auth's cookie (`src/lib/auth.ts`, its React client with the passkey and magic-link plugins; `App.tsx` shows `AuthPage` until there's a session, and `/reset-password` works signed out). The channel list (`ChannelEntry`: channel + `role` + `read_seq`) is a query on `GET /v1/channels` (`src/lib/channels.ts`); `markRead` updates `read_seq` optimistically and `PUT`s it. Requests use `auth(entry)`, which adds `X-Rply-Channel`. App storage is one `GET /v1/storage` query per channel plus debounced `PUT`s (`src/lib/apps.ts`); html blocks wait for it before building the embed document. One `/v1/sync` long-poll loop (`src/lib/sync.ts`) upserts changed messages into the query cache (`applySynced`) and refetches the channel list when sync reports a different set of channel ids. The only localStorage left is per browser on purpose: the push endpoint (`rply.push`), the trusted secret keys (`rply.keys`) and the theme. Signing out drops the push subscription. Pages: `AuthPage` (first-run setup, sign in/up, forgot password), `ClaimPage` (`/claim?c=`), `AddChannelPage` (create here with an agent code, or claim a channel the agent made), `SettingsPage` (account, theme, password, passkeys, data export, delete account). Blocks render through `components/blocks/MessageBlocks.tsx` (question state, auto-submit vs "Send answers", answered/expired/cancelled), `Inputs.tsx` and `HtmlBlock.tsx` (sandboxed `iframe` with `sandbox="allow-scripts"` and `srcdoc`, plus a bridge exposing `rply.reply(value)` and `rply.resize(height)` through `postMessage`). Answer messages are hidden in the thread and shown inside their question.
- Server tests use `app.request()` against an in-memory database (`packages/server/test`).
- Shared client logic lives in `packages/schema/src/helpers.ts` (ask status incl. client-side expiry, defaults, collecting answers, required checks, the submit-on-tap rule, previews). Web, mobile and CLI import it from `@rply/schema`; keep UI-free logic there instead of duplicating it per app. `helpers.ts` imports only types from `index.ts` to avoid a require cycle.
- Mobile renders markdown with `react-native-marked` and `html` blocks in a `react-native-webview` WebView (same `rply.reply` / `rply.resize` bridge via `ReactNativeWebView.postMessage`; navigation away is blocked and http(s) links open externally). `HtmlBlock.web.tsx` uses a sandboxed iframe for the Expo web build. If changes don't show up in Expo, restart with `npx expo start --clear` (stale Metro cache).
- CLI commands whose main argument is free text (`send`, `ask`, `edit`, `pin set/patch`) use `allowUnknownOption()` so text starting with `-` (markdown lists) isn't parsed as an option.
- Mobile app (`apps/mobile`, Expo SDK 57): Expo Router (routes in `src/app`), Uniwind for Tailwind v4 classes (`metro.config.js`, `src/global.css`, generated `src/uniwind-types.d.ts`), TanStack Query, expo-secure-store. Run with `npm run dev:mobile` and open in Expo Go, or press `w` for web (storage falls back to localStorage there). Add native packages with `npx expo install` inside `apps/mobile`. `apps/mobile/AGENTS.md` has Expo's own guidance: check the SDK 57 docs instead of relying on memory.
- Unlike the web app, the mobile app talks to several servers. It keeps one bearer session per server in SecureStore (`src/lib/sessions.ts`: `{ server, token, email }`, sign-in/up against `/v1/auth/*/email`, rply.sh by default with "Use another server"). Email + password only for now: native passkeys need app-domain association and magic links would sign in the browser, not the app. `useChannels` (`src/lib/channels.ts`) fetches `GET /v1/channels` per session into `ServerChannel { server, token, channel }`, drops sessions the server answers with 401, and `src/lib/sync.tsx` runs one sync loop per session. Screens: `index` (sign-in when there's no session, else the inbox), `add` (create with a shareable agent prompt, or claim a link/code), `account` (sessions, sign out, sign in to another server). The Expo web build runs on another origin, so the server needs `RPLY_TRUSTED_ORIGINS=http://localhost:8081` for its auth routes in development.
- The whole repo uses one React version, pinned by root `overrides` to what Expo requires (19.2.3). Two copies of React in the mobile bundle break hooks, so bump it together with the Expo SDK.
- The API sends permissive CORS headers (`*`). That's safe because auth is bearer tokens, not cookies, and it lets the Expo web build and future multi-server web clients reach any server.
- Deploy: the root `Dockerfile`. Railway is defined in `.railway/railway.ts` (Railway IaC, applied with `railway config plan` / `railway config apply`; `railway.json` is deprecated). It declares the service, the Dockerfile build, the healthcheck and a volume at `/data`. `RPLY_URL` is `preserve()`d, so set it in the Railway dashboard. Generate the public domain in the dashboard, since IaC doesn't manage generated domains. Run one replica only (SQLite).
- CLI (`packages/cli`, commander): run locally with `npm run rply -- <command>`. Config lives in `~/.config/rply/config.json` (mode 0600; override the path with `RPLY_CONFIG`) as `{ default, channels: { <key>: { server, token, channel, inbox_cursor } } }`. One machine can hold several channels. `init` saves each under `--channel <key>` or a slug of `--name`, and the first becomes the default. Other commands pick a channel with `--channel` / `RPLY_CHANNEL`, otherwise the default. `rply channels` lists them, and `rply channels use|remove` change the default or forget one. Old single-channel config files are migrated when read. `RPLY_SERVER` + `RPLY_TOKEN` override it (for CI). Long waits poll in 55s chunks and retry through network errors and 5xx, so they survive server restarts. Exit code 2 means timeout. The QR code only prints when stdout is a TTY, so it doesn't fill an agent's context.
- `inbox` and `listen` skip answers to questions (messages with `reply_to`); those come through `ask --wait` or `rply wait <id>`. `ask` without `--choices`/`--confirm`/input blocks adds a `text_input` (id `answer`). With `--wait`, one question prints its value, several print a JSON object; exit 2 = expired without default or timed out, 3 = cancelled. `--timeout` also sets the question's expiry unless `--expires` is given.
- Migrations were squashed into a single `0001_init` on 2026-10-12 (together with accounts; no data to keep). `migrate()` refuses databases whose `kysely_migration` lists names it doesn't know (i.e. created before the squash) with an error saying to delete them. From here on they're additive again: `0002_drop_api_keys` removes the per-user API keys (dropped as too rare to keep; agents create channels with claim links instead). The migration table lives in the connection's current schema on Postgres.
- `@rply/schema` has three entry points: `.` (zod schemas and types), `./helpers` (UI-free logic, imports only types) and `./crypto` (sealed box, keypairs, fingerprints; `@noble/*`). The CLI must import runtime values only from `./helpers` and `./crypto`, never from `.`, or zod ends up in its bundle (~170 KB without, ~630 KB with).
- Mobile polyfills `crypto.getRandomValues` from `expo-crypto` (`src/lib/polyfills.ts`, imported first in `_layout.tsx`) because the `@noble` libraries need it. Both apps render secret cards through `SecretBlock`, which gets the channel from `ChannelContext` (provided around the thread and pins).
- Publishing the CLI: `npm run build -w @rply/cli` bundles everything with esbuild into `packages/cli/dist/rply.js` (Node won't strip types inside `node_modules`). All runtime libraries are devDependencies because they're inlined, so the published package has no dependencies. `prepublishOnly` runs the build. To release, bump `version` in `packages/cli/package.json`, then `npm publish -w @rply/cli`. The npm package is `@rply/cli` (npm blocked the unscoped name `rply` as too similar to existing packages), but the command it installs is still `rply`.
- Website (`apps/site`): Astro + Starlight + Tailwind v4 for rply.sh. The homepage (`src/pages/index.astro`, layout `layouts/Page.astro`, components in `src/components`) uses the web app's design: `src/styles/global.css` copies the app's gray scale and `brand-*` periwinkle, Inter (opsz) and Geist Mono, plus `btn`/`btn-primary`/`btn-outline` utilities. The hero animates a laptop (`Desktop.astro`) and phone (`Phone.astro`) through CSS state classes (`s-drafted`, `s-ask`, `answered`, `done`) driven by a script in the page. Clicking that graphic (`.demo-open`) morphs it into a fullscreen interactive demo with a View Transition (`components/demo/`: `Demo.astro` is the shell, `demo.ts` the step engine, `views.ts` the HTML templates for messages, the mock pricing site, the stats and preview apps). It's a scripted walkthrough split into two machines: a dark "Agent's machine" pane (dotted grid, host label) with the agent's terminal, and "Your laptop" (brand-colored macOS-style wallpaper and menu bar) with the web app in a browser window. The agent's pane starts alone and the laptop slides in (`with-browser`) once the claim link is opened. On the homepage the graphic shows a brand-colored "Try the interactive demo" pill with a soft glow behind it; hover only fades opacity and brightness, nothing moves. Seven steps (setup prompt, claim, questions, screenshots, stats app, dev server preview, ship); each step waits for the highlighted, pulsing click (`interact`), with no step text or navigation, and Replay on the end screen starts over. Icons live in `components/icons.ts`, shared by `Icon.astro` and the demo. The closing box has a canvas flock of birds (`Flock.astro`, bird path shared in `components/bird.ts`) that scatters from the pointer and bursts on click. Hosting options and the agent setup prompts live in `components/setup.ts` (hosted app.rply.sh first). Logos come from `simple-icons`, plus `public/logos/` for ones it lacks (OpenAI, OpenClaw, exe.dev). Astro passes a parent's scoped class as `class` to child components, so components with a default size (`Icon`, `Logo`) only apply it when the given class has no `size-`. Docs are Markdown in `src/content/docs/docs/` and served under `/docs/`, with the sidebar groups defined in `astro.config.mjs`. They're themed to match the app: `src/styles/docs.css` maps the app's grays and periwinkle onto Starlight's `--sl-color-*` variables for both themes and restyles the sidebar, asides, TOC and pagination (plain CSS, which beats Starlight's layered styles); `components/docs/` overrides `Header` (title left; search, GitHub, theme and "Go to app" right), `SiteTitle` (bird + "rply.sh / Docs"), `SocialIcons` (GitHub), `ThemeSelect` (a system/light/dark switch on Starlight's `starlight-theme` localStorage key, plus "Go to app") and `PageTitle` (adds "Copy page" with the raw Markdown, "Open in ChatGPT" and "Open in Claude"); LLM access: `starlight-llms-txt` (configured in `astro.config.mjs`) generates `/llms.txt` (product summary, agent quick start, links to the homepage, app, GitHub and npm), `/llms-full.txt`, `/llms-small.txt` and one `/_llms-txt/<section>.txt` per sidebar section (keep its `sections` list in sync with the sidebar); `src/pages/docs/[...slug].md.ts` serves every docs page as Markdown at `<page>.md` (linked from each page's `<head>` by the `Head` override and used by the "Open in" prompts); the homepage links `/llms.txt` in its `<head>` and footer; SEO: `layouts/Page.astro` sets the homepage's description, canonical, Open Graph/Twitter tags (`public/og.png`, 1200x630) and JSON-LD, Starlight handles canonical/OG for docs (plus the shared `og:image` via `head` in `astro.config.mjs`; give docs pages a `description` in their frontmatter, otherwise they fall back to the site description), Starlight's built-in `@astrojs/sitemap` writes `sitemap-index.xml` for all pages and `public/robots.txt` points to it; docs pages don't load Tailwind, so their components style themselves with plain CSS; code blocks use Expressive Code's `github-dark-default` on gray-950 in both themes (config in `astro.config.mjs`; the dev server needs a restart after changing it). Run with `npm run dev:site` / `npm run build:site`. The site lists `cookie@^2` as a direct dependency because the web app's tooling hoists `cookie@0.7` to the root, which breaks Astro's prerender build.
- Product video (`apps/video`, Remotion + Tailwind v4 with the site's tokens): a 51s 1080p piece. The agent is a dark activity log on a VM (commands appear as it runs them, never typed); the web app and phone are the human side. Birds (the site's flock and flutter) carry every message between them, and the camera follows. Headlines are two-tone (black, then gray) in world space above the devices, with a white spotlight dimming everything but the detail being described. The intro is the flock converging into the app icon; the outro is a ring of agent logos sending birds into one inbox. Every beat, log line, flight, camera move and headline is a time in seconds in `timeline.ts`; components derive their state from `t`. Cursor, finger, spotlight and flight targets are world coordinates measured from rendered stills, so re-check them after layout changes. `npm run dev:video` opens Remotion Studio, `npm run render:video` writes `apps/video/out/rply.mp4`.
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
