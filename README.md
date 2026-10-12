# rply

**ntfy for agents.** A self-hosted inbox between you and your AI agents.

![An agent asks a question, the human answers with one tap, and the agent's pinned status updates live](.github/assets/demo.gif)

Any agent with a shell (Claude Code, Codex, a cron script, CI) installs the `rply` CLI and can then:

- send you updates (markdown, tables, progress bars, images, files)
- ask questions and wait for your answer (choices, forms, confirmations, free text)
- pin live-updating status messages and full-page HTML apps to the top of its channel
- request secrets that go straight into a file on its machine, never through its context or the server
- get woken up when you write to it

You read and reply in one inbox for all your agents: a web app served by the server, and a mobile app (Expo, in progress).

rply is agent-agnostic and not a session mirror: it doesn't control or host your agent, it gives the agent a way to talk to you.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/desktop-dark.png">
  <img alt="rply web app: channels, an agent's report with a table, an open question and a pinned status" src=".github/assets/desktop-light.png" width="72%">
</picture>
<img alt="rply web app on a phone" src=".github/assets/mobile.png" width="22%">

## How it works

```
agent machine                    your server                 you
rply CLI  ── agent token ──▶  rply server (Docker,  ◀── human token ──  web / mobile app
                              SQLite, serves web app)
```

- One **channel** per agent (or per project). There are no user accounts: a channel has agent tokens (CLI) and human tokens (one per paired device).
- Pairing uses one-time codes, so no long-lived token ever ends up in the agent's output.

## Setup

### 1. Run the server

The server is one container with an SQLite database. Keep `/data` on a volume.

```sh
git clone https://github.com/joshuaKnauber/rply && cd rply
docker build -t rply .
docker run -d -p 8080:8080 -v rply-data:/data -e RPLY_ADMIN_TOKEN=<random secret> rply
```

Put it behind HTTPS (Caddy, Railway, exe.dev's proxy, …). Run one replica only. On Railway, `.railway/railway.ts` defines the service, healthcheck and `/data` volume; set `RPLY_ADMIN_TOKEN` in the dashboard and generate a domain.

Open the server URL in a browser to get the web app. With an admin token set, you can sign in with it there to see every channel.

| Variable | Default | |
|---|---|---|
| `PORT` | `8080` | |
| `RPLY_DB` | `/data/rply.db` in Docker | SQLite file |
| `RPLY_ADMIN_TOKEN` | unset | If set, creating channels needs it (`--server-token`). Unset means anyone who can reach the server can create channels. |
| `RPLY_FILES` | on | `off` disables attachments |
| `RPLY_FILES_DIR` | `files/` next to the database | or use S3: `RPLY_S3_BUCKET`, `RPLY_S3_ENDPOINT`, `RPLY_S3_ACCESS_KEY_ID`, `RPLY_S3_SECRET_ACCESS_KEY`, `RPLY_S3_REGION` |
| `RPLY_FILES_MAX_SIZE` / `RPLY_FILES_TOTAL_LIMIT` / `RPLY_FILES_RETENTION` | `25MB` / `5GB` / off | e.g. `RPLY_FILES_RETENTION=30d` |
| `RPLY_PUSH` | on | `off` disables web push. VAPID keys are generated on first start, or set `RPLY_VAPID_PUBLIC_KEY` / `RPLY_VAPID_PRIVATE_KEY` / `RPLY_VAPID_SUBJECT`. |

### 2. Connect an agent

On the agent's machine (Node 20+):

```sh
npm install --global @rply/cli
rply init https://your-rply-server --name "SEO bot" --server-token <admin token>
```

`init` creates the channel and prints a one-time pairing link (and a QR code in a terminal). Open it on your phone or laptop to add the channel to your inbox. `rply pair` makes a link for another device.

Or create the channel in the web app: it shows an agent code, and the agent runs `rply join https://your-rply-server <code>`.

### 3. Teach the agent

```sh
rply guide setup     # installs a background service that runs app scripts and wakes the agent when you write
rply guide           # commands, blocks, HTML, apps, secrets, files
rply guide --snippet >> CLAUDE.md   # or AGENTS.md
```

## For agents reading this

If you are an AI agent and your human wants to talk to you through rply:

1. Install the CLI: `npm install --global @rply/cli` (or use `npx @rply/cli`).
2. Connect: `rply init <server-url> --name "<your name>"` (ask your human for the server URL and, if needed, the server token via `--server-token` or `RPLY_SERVER_TOKEN`), or `rply join <server-url> <code>` if they gave you an agent code. Give them the pairing link that `init` prints.
3. Run `rply guide setup` and follow it, then read `rply guide`.
4. Add the output of `rply guide --snippet` to your `CLAUDE.md` / `AGENTS.md`.

The basics:

```sh
rply send "Deployed **3** pages"
rply ask "Publish these drafts?" --choices Publish,Skip --wait --timeout 2h   # prints the answer
rply inbox                                    # new messages from the human
rply ack <id> working|done
rply status set status.json                   # pinned status, a JSON blocks array
rply secret request OPENAI_API_KEY --to .env --reason "for keyword research" --wait
rply send "Weekly report" --image chart.png --file data.csv
```

Never put secrets in messages; use `rply secret request`. Add `--json` to any command for machine-readable output. Exit code 2 means timeout, 3 means cancelled. Full CLI reference: [packages/cli/README.md](packages/cli/README.md).

## Development

Node 24+ (the server runs TypeScript directly, no build step).

```sh
npm ci
npm run dev:server     # API on :8080, rply.db in the cwd
npm run dev:web        # web app on :5173, proxies /v1 to :8080
npm run dev:mobile     # Expo app
npm run rply -- <cmd>  # CLI from source
npm test && npm run typecheck
```

| Path | |
|---|---|
| `packages/server` | Hono API, SQLite (Kysely), serves the web app |
| `packages/cli` | the `rply` CLI ([`@rply/cli`](https://www.npmjs.com/package/@rply/cli)) |
| `packages/schema` | shared zod schemas, client helpers, crypto |
| `apps/web` | React + Vite inbox |
| `apps/mobile` | Expo app |
| `apps/site` | rply.sh website and docs (Astro + Starlight) |

`CLAUDE.md` has the full design notes (architecture, API, data model, decisions).
