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
7. **Status page per channel**: agent publishes or updates a live page made of the same components (replaces the custom exe.dev website).
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
packages/relay     push relay (later)
```

## 6. Component system

- Agents send **typed JSON blocks** validated by zod. The apps render only a known set; **no agent-supplied HTML or JS** runs in v1 (Agent Dash makes the same choice).
- Initial component set (subject to change):
  - `text` / `markdown`
  - `heading`
  - `buttons` (choices; tapping one sends a reply event with its value)
  - `form` (text, number, select, toggle, textarea fields; submit returns structured JSON)
  - `progress` (value plus label)
  - `table`
  - `keyvalue` / `stat` (for status pages)
  - `link`
  - `image` (URL or uploaded)
  - `code`
  - `secret_request` (special, see below)
- **Status page** = an ordered list of blocks that the agent replaces or patches (`status set`, `status patch`).
- Every interactive element carries an ID, so replies come back to the agent as structured events: `{ "message_id", "element_id", "value" }`.
- With E2E on, the server can't validate blocks. Clients validate after decrypting and show unknown or invalid blocks as a placeholder.

## 7. Secrets (core differentiator)

Goal: the human can give an agent credentials (API keys etc.) **without the value ever entering the agent's LLM context or being readable by the server**.

Flow:
1. On `init`, the CLI generates a **keypair** and registers the public key with the server for that channel.
2. The agent runs, e.g., `rply secret request OPENAI_API_KEY --to .env --reason "for keyword research API"`.
3. The app shows a dedicated, masked secret field (never shown in chat history), labelled with the channel, the reason and the target path.
4. The app **encrypts the value to the CLI's public key** (sealed box) and sends the ciphertext. The server only relays it and **deletes it after delivery**. This is independent of channel E2E: even other paired devices can't read a delivered secret.
5. The CLI decrypts it and writes it directly:
   - `.env` mode: add or update `KEY=value`, preserving the rest of the file
   - whole-file mode
   - OS keychain mode (later)
   - file permissions `0600`
6. The CLI prints / returns only metadata: `OPENAI_API_KEY written to .env`. **Never the value**, not on stdout, not in logs, not in MCP tool results.
7. Requests are **single use** and **expire**.

Documented limitation: this keeps secrets out of the conversation and off the server, but an agent with shell access can still read the file. `run --with-secrets -- cmd` (environment injection, nothing on disk) is the stronger option for later.

The remote MCP endpoint **cannot** deliver secrets to files (the server can't write on the agent's machine, and returning the value would put it into context), so `request_secret` is either missing there or clearly marked as delivering into context.

## 8. Channels, auth and E2E (decided)

### Channels, modelled on ntfy
ntfy has no accounts: the topic name is the identity and the app keeps a local list of (server, topic). rply keeps that model with one change. Human messages are instructions to an agent with shell access, so a leaked secret must not let someone command the agent. Each channel therefore has **two kinds of credentials**:

| credential | held by | can |
|---|---|---|
| agent token `rply_a_…` | CLI on the agent machine | post as agent, read human messages, set status, request secrets |
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

### Server tokens (who may create channels)
- Self-host: if `RPLY_ADMIN_TOKEN` is unset, channel creation is open (fine for a private instance). If it is set, `init` needs `--server-token`.
- Server tokens `rply_k_…` live in an `api_keys` table; the env var seeds one row. The hosted version uses the same slot for per-account API keys, so the CLI does not change.

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
- Ship a short **skill / `AGENTS.md` snippet** that teaches agents how to use the CLI.

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
rply pair                               # new pairing code for another device
rply send "Deployed 3 new pages" [--title ..] [--priority high] [--blocks file.json]
rply ask "Publish these 5 pages?" --buttons yes,no [--wait] [--timeout 1h]
rply ask --form form.json --wait        # returns JSON answer on stdout
rply wait <message-id> [--timeout 1h]   # answer to an earlier ask without --wait
rply whoami
rply channels [use|remove <name>]    # several channels per machine, --channel <name> on any command
rply status get
rply inbox [--wait] [--since <cursor>]  # read human → agent messages
rply listen                             # stream incoming messages (JSONL)
rply status set status.json             # replace the status page
rply status patch '{"id":"pages","value":42}'
rply secret request NAME --to .env [--reason ".."] [--wait]
rply e2e enable
```
Output should be machine-friendly (JSON with `--json`) and self-describing (`--help`, perhaps a `describe` command that prints a JSON schema, as Agent Mail CLI does).

### Server API (rough)
The token decides the channel and the sender side, so most routes don't need a channel ID.
- `POST /v1/channels` (server token if required) → channel, agent token, pairing code
- `POST /v1/pairings` (agent) → new pairing code; `POST /v1/pairings/claim` (code) → human token
- `GET /v1/channel` (either token) → channel info
- `GET /v1/info` (no auth) → `{ server_token_required }`, used by the web app to show the right setup command
- `POST /v1/messages` (agent or human), `GET /v1/messages?since=&wait=&sender=` (without `since`: latest page, no waiting)
- `GET /v1/messages/:id/replies?wait=60` (agent waiting on an ask)
- `PUT /v1/status`, `PATCH /v1/status`, `GET /v1/status`
- `POST /v1/sync` (client sends all its human tokens plus a cursor, long-polls for events across those channels, so the web app needs one open request rather than one per channel)
- later: `POST /v1/secrets/requests`, `POST /v1/secrets/:id/fulfil`, `GET /v1/secrets/:id?wait=`, `POST /v1/devices`, `/mcp`

### Data model
```
channels        id, name, icon, agent_token_hash, agent_public_key, e2e, owner_id (null), created_at
human_tokens    id, channel_id, token_hash, label, created_at, last_seen_at, revoked_at
pairing_codes   code_hash, channel_id, expires_at, used_at
api_keys        id, token_hash, owner_id (null), label, created_at
messages        seq (cursor), id, channel_id, sender ('agent'|'human'), enc,
                body (JSON text or ciphertext), reply_to, created_at
status_pages    channel_id, body, enc, updated_at
-- later:
devices         human_token_id, push_token, platform, created_at
secret_requests id, channel_id, name, target, reason, ciphertext, status, expires_at
```
An ask is an agent message with interactive blocks. A tap or form submit is a human message with `reply_to` set and `{action: {element_id, value}}` in its body. The action lives inside the body so E2E covers form answers too; only `reply_to` stays visible to the server. "Answered" is derived from that; add a separate `asks` table only if expiry or single-answer rules need it.

## 12. Development

- Node 24+ runs the TypeScript directly (type stripping), so there is no build step for the server. Use `.ts` extensions in relative imports and only erasable syntax (no enums, no parameter properties).
- `npm run dev:server` (watch mode, `rply.db` in the cwd) plus `npm run dev:web` (Vite on 5173, proxies `/v1` to 8080). `npm run build` builds the web app into `apps/web/dist`, which the server serves at `/` with an SPA fallback.
- `npm test`, `npm run typecheck`.
- Server env: `PORT` (8080), `RPLY_DB` (path to the SQLite file), `RPLY_ADMIN_TOKEN` (optional), `RPLY_WEB_DIR` (defaults to `apps/web/dist`).
- Web app: React + Vite + Tailwind v4 + shadcn (radix, nova preset, components in `src/components/ui`) + TanStack Query + wouter. Paired channels live in localStorage (`src/lib/channels.ts`). One `/v1/sync` long-poll loop (`src/lib/sync.ts`) merges new messages and statuses into the query cache.
- Server tests use `app.request()` against an in-memory database (`packages/server/test`).
- Deploy: the root `Dockerfile`. Railway is defined in `.railway/railway.ts` (Railway IaC, applied with `railway config plan` / `railway config apply`; `railway.json` is deprecated). It declares the service, the Dockerfile build, the healthcheck and a volume at `/data`. `RPLY_ADMIN_TOKEN` is `preserve()`d, so set it in the Railway dashboard. Generate the public domain in the dashboard, since IaC doesn't manage generated domains. Run one replica only (SQLite).
- CLI (`packages/cli`, commander): run locally with `npm run rply -- <command>`. Config lives in `~/.config/rply/config.json` (mode 0600; override the path with `RPLY_CONFIG`) as `{ default, channels: { <key>: { server, token, channel, inbox_cursor } } }`. One machine can hold several channels. `init` saves each under `--channel <key>` or a slug of `--name`, and the first becomes the default. Other commands pick a channel with `--channel` / `RPLY_CHANNEL`, otherwise the default. `rply channels` lists them, and `rply channels use|remove` change the default or forget one. Old single-channel config files are migrated when read. `RPLY_SERVER` + `RPLY_TOKEN` override it (for CI), and `RPLY_SERVER_TOKEN` feeds `init --server-token`. Long waits poll in 55s chunks and retry through network errors and 5xx, so they survive server restarts. Exit code 2 means timeout. The QR code only prints when stdout is a TTY, so it doesn't fill an agent's context.
- `inbox` and `listen` skip answers to asks (messages with `reply_to`). Those come through `ask --wait` or `rply wait <id>`. `ask` without `--buttons`/`--form` sends a one-field form (element id `answer`) and prints the plain string.
- Publishing the CLI: `npm run build -w @rply/cli` bundles everything with esbuild into `packages/cli/dist/rply.js` (Node won't strip types inside `node_modules`). All runtime libraries are devDependencies because they're inlined, so the published package has no dependencies. `prepublishOnly` runs the build. To release, bump `version` in `packages/cli/package.json`, then `npm publish -w @rply/cli`. The npm package is `@rply/cli` (npm blocked the unscoped name `rply` as too similar to existing packages), but the command it installs is still `rply`.
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
6. **Push**: relay service plus wake-and-fetch, Expo notifications.
7. **Secrets**: keypair on init, sealed-box encryption in the apps, `.env` writer, expiry.
8. **Packaging**: one-line install, exe.dev / Hetzner / Railway guides, agent skill snippet.
9. **Later**: hosted rply.sh with accounts and Postgres, remote MCP, `run --with-secrets`, MCP Apps.

## 15. Open questions

- Exact component set for v1.
- Multi-user / team support: when?
- Retention policy for messages on the server.
- Should the web app support channels from several servers (needs CORS), or only its own server?
