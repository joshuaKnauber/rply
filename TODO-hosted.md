# TODO: hosted version (rply.sh)

Everything needed to run a public, multi-user rply on rply.sh. Self-hosting stays exactly as it is: one Docker image with SQLite and no accounts.

## Where to run it

### Decision
- **App:** the existing Docker image on Railway (Hobby, $5 including $5 of usage, then usage-billed). Set a usage limit in the dashboard.
- **Database:** PlanetScale Postgres, $5 single node, in the region closest to the Railway region.
- **Files:** Cloudflare R2 (free up to 10 GB, no egress fees), plus Cloudflare for DNS.
- Fly.io (~$3.19/month fixed) is the fallback if Railway's usage billing or latency to PlanetScale becomes a problem.
- Hold off on Workers for now.

### Setup
- [ ] PlanetScale Postgres database in the region nearest Railway's (Railway EU is Amsterdam). `RPLY_DATABASE_URL` as a Railway variable.
- [ ] R2 bucket plus an API token scoped to it. Set `RPLY_S3_BUCKET`, `RPLY_S3_ENDPOINT` (`https://<account>.r2.cloudflarestorage.com`), `RPLY_S3_ACCESS_KEY_ID` and `RPLY_S3_SECRET_ACCESS_KEY` on Railway.
- [ ] Remove the `/data` volume from `.railway/railway.ts` once nothing is stored on disk.
- [ ] `app.rply.sh` as a Railway custom domain, DNS on Cloudflare.
- [ ] Railway usage limit and billing alerts; PlanetScale and R2 billing alerts.

### Why not Cloudflare Workers (yet)
- rply's core is held connections plus in-memory state: the long-poll notifier, the `serve` registry, waiting script calls and push presence. Workers are stateless, so all of that would have to move into Durable Objects.
- A Durable Object that holds a pending long-poll is billed for wall-clock time at 128 MB. That's ~337k GB-s, or **~$4/month for every object that never goes idle**. Every channel running `rply serve` never goes idle, so 1,000 channels ≈ $4,000/month.
- Making Workers cheap means switching the CLI and the apps from long-polling to WebSockets with the Hibernation API, because idle hibernated sockets aren't billed for duration.
- The server would also need porting off Node APIs: `node:sqlite`, `fs` file storage, `node:dns` in unfurl, `web-push` and `@hono/node-server`.
- That's a transport rewrite plus a second runtime to maintain next to the self-hosted Node server.
- Worth revisiting if global latency or scale-to-zero ever matters more than simplicity. The design would be one Durable Object per account holding hibernated WebSockets.

### Why the Node container works
- It's the same image self-hosters run.
- One Node process holds thousands of idle long-polls cheaply, a few KB each.
- Deploy restarts are already survivable: the CLI retries through 5xx and network errors, and `serve` re-registers within seconds.

### PlanetScale
Fine, as long as it's **Postgres, not MySQL**. Kysely's Postgres dialect is already the plan, and MySQL would be a third dialect.
- Start on the $5 single node (1/16 vCPU, 512 MB, PITR backups). Move to the $15 3-node HA cluster once people pay.
- Put the app in the same region as the database.
- Alternatives if it doesn't fit: Neon (free tier, scale to zero) or the platform's own Postgres.
- Hyperdrive's pooling doesn't matter for a single Node process: connect directly and use a small `pg` pool.

### Cloudflare's role
- DNS and proxy for `app.rply.sh` (its 100s proxy timeout is fine for 55–60s polls).
- R2 for files: the existing S3 adapter works, and there's no egress cost.
- The Astro site on Workers static assets.

## Rough resources

Assumptions per active channel:
- `serve` makes 2 long-polls (calls plus `--on-message`).
- About 1 open app tab.
- Together that's ~3 polls per 55s, ~4.7k requests/day or ~140k/month.

| active channels | concurrent conns | requests/s | DB queries/s (before) | DB queries/s (now) |
|---|---|---|---|---|
| 100 | ~300 | ~5 | ~15 | ~5 |
| 1,000 | ~3,000 | ~55 | ~165 | ~60 |
| 10,000 | ~30,000 | ~550 | ~1,650 | ~600 |

- **Auth** used to run an `UPDATE … last_seen_at` plus a channel select on every request. It's now one select, plus a write at most once a minute per token (the "now" column).
- **Up to ~1–2k active channels**: one small instance (1 shared vCPU, 512 MB–1 GB) plus PlanetScale $5–15 plus R2 within its free 10 GB. Roughly **$15–40/month all-in**, including email and error tracking free tiers.
- **Beyond that**: a bigger single instance gets far. More than one instance needs the work under "Scaling past one instance".
- **Storage**: messages are small. Apps go up to 256 KB per pin and files up to 25 MB each, so files dominate storage. That makes per-account file quotas the main storage control.
- **Full Workers for comparison**:
  - Requests are cheap: ~140M/month at 1k channels ≈ $40 Workers + $20 DO requests.
  - Durable Object duration without hibernation is the problem: ~$4/channel/month.

## Accounts and ownership
Decided 2026-10-12. Accounts on every server, self-hosted included, modelled on Plausible CE. They replace human tokens, device pairing, owner mode and the admin token.

### Sign-in
- better-auth on our Kysely instance (SQLite and Postgres). Its tables go into our own numbered migrations.
- Email + password as the baseline, passkeys as an option. Magic link, email verification and password reset only when email is configured (`RPLY_EMAIL_*`, Resend or SMTP; rply.sh configures it).
- Without email: a server command resets a password (`docker exec … reset-password <email>`).
- The first user to register owns the instance. After that `RPLY_REGISTRATION=invite|open|closed` (`invite` by default, `open` on rply.sh). The instance owner only sees their own channels.
- Web: better-auth's httpOnly session cookie (same origin, `SameSite=Lax`), so no token in localStorage. Mobile: bearer sessions via better-auth's Expo plugin in SecureStore, one per server. CORS `*` stays for bearer requests.

### Data
- `channel_members (user_id, channel_id, role owner|member)`; channels without a member are unclaimed.
- Read positions are `channel_members.read_seq`, so unread counts match across devices.
- `app_storage (user_id, channel_id, app_key, value, updated_at)`, primary key on the first three, value max 256 KB, cascades with user and channel. `app_key` is the pin key or the message id. Clients load it with the app and write it debounced; per user, not shared (shared data is the agent's, fetched with `rply.call`).
- `api_keys.owner_id` set: per-user API keys created in settings.
- Push subscriptions belong to a session/user instead of human tokens.
- Stays on the device on purpose: E2E channel keys and the trusted secret keys (`rply.keys`), since both protect against the server; plus the theme.
- Removed: `human_tokens`, human pairing codes, `/pair?c=`, owner mode, `rply.admin`, `RPLY_ADMIN_TOKEN`, "Remove from this browser". Existing data doesn't need migrating; servers are set up again.

### Flows
- **App first (main path):** sign in → New channel → you're the owner → the app shows the prompt with a one-time agent code (1h) → `rply join <server> <code>` → `rply guide setup`. The channel shows "Waiting for an agent" until one joins. "Add an agent" issues new codes (second agent, lost config).
- **Agent first:** `rply init <server> --name ..` creates an unclaimed channel and prints a claim link (QR in a TTY). Opening it signed in (or after registering) adds the channel to the account. The agent can post meanwhile. Unclaimed channels are deleted after 1 hour; creation is rate-limited per IP. `rply pair` reprints the claim link while unclaimed.
- **Headless (CI):** `rply init --api-key rply_k_…` creates the channel owned by that key's user.
- **Another device:** just sign in.
- **Sharing (later, schema ready):** the owner creates an invite link; the invitee signs in or registers through it even when registration is invite-only and becomes a `member` (read and reply; only owners delete the channel or manage agents).
- **Agents:** unchanged, `rply_a_` tokens, no login, `--channel` for several channels per machine.

### Build steps
- [x] Server: better-auth with migrations for its tables plus `channel_members` (with `read_seq`, no separate reads table) and `app_storage`; registration modes; optional email (Resend); reset-password command.
- [x] Server: session auth on the human routes (`X-Rply-Channel`), `/v1/sync` over the user's channels, claim links + unclaimed expiry + rate limit, API keys, push per user, origin check for cookie writes; removed human tokens, device pairing and admin routes.
- [ ] SMTP as a second email option for self-hosters.
- [x] Web: sign in/register (first-run owner setup), claim page, channel list and read positions from the server, app storage via the API, settings (password, passkeys, API keys, sign out); only the push endpoint, trusted secret keys and theme stay in localStorage.
- [x] CLI: `init` prints the claim link, `--api-key`, `pair` reprints the claim link, guide and onboarding prompt updated.
- [x] Mobile: rply.sh by default with "Use another server", sign in, sessions per server; device pairing dropped. Email + password only (no passkeys or magic links in the app yet).
- [x] Docs: CLAUDE.md sections 8 and 11, README, site outlines and setup prompts.
- [ ] Invites: channel members and registration through an invite link (`RPLY_REGISTRATION=invite` acts as closed until then).
- [ ] Passkeys and sign-in links in the mobile app.
- [ ] Convert the Railway SQLite database by hand once the clients are done (keep its data): create the new tables, move channels to the owner's account, drop the old columns/tables, and leave `kysely_migration` with only `0001_init`.
- [ ] Default server: `rply join <code>` and `init` without a URL point at rply.sh.
- [ ] Account deletion (deletes owned channels, files, push subscriptions) and data export.

## Database (Postgres)
- [x] Postgres dialect next to SQLite, picked by env (`RPLY_DATABASE_URL`).
- [x] Migrations that run on both dialects (`seqColumn`), migration table in the current schema.
- [x] Skip the `rply.db.bak-<version>` copy on Postgres (rely on PITR instead).
- [x] Cursors stay gapless under concurrent inserts (`inSeqOrder` advisory lock).
- [x] Server tests run against Postgres with `RPLY_TEST_DATABASE_URL`.
- [ ] Run the server tests against both dialects in CI (a Postgres service container).
- [ ] Try it against PlanetScale itself: connection limits, SSL (`?sslmode=require`), latency from Railway.
- [ ] A way to move a self-hosted SQLite database to Postgres (export/import script), if anyone needs it.
- [x] Auth: one joined token + channel query per request (no cache, so revoking stays instant) and `last_seen_at` written at most once a minute.
- [ ] Indexes for account-level queries (`channels.owner_id`, sync over many channels).

## Limits, quotas, abuse
- [ ] Per-account limits: channels, agents per channel, messages per minute, file storage total (replaces the global `RPLY_FILES_TOTAL_LIMIT`), app/pin size, calls per minute.
- [ ] Rate limiting per token and per IP: pairing claims (codes are short), unfurl, sign-in, channel creation.
- [ ] Unfurl is an open fetcher for anyone with a token: rate limit it per account and keep the cache.
- [ ] Message and file retention for free accounts (e.g. 90 days), using the existing retention sweep made per account.
- [ ] Abuse handling: way to report a channel, admin tools to suspend an account, terms that forbid using channels to distribute malware or phishing (html apps and files are served from our origin, inside the sandbox / as attachments).
- [ ] Request body limits are global today (256 KB, 5 MB for call results, 25 MB files); review them for a shared instance.

## Realtime and calls
- [ ] Single instance first: keep the in-memory notifier, serve registry and call waiters.
- [ ] Graceful shutdown on deploy: answer open long-polls immediately, so clients reconnect to the new instance instead of hanging.
- [ ] Zero-downtime deploys are not possible with a single in-memory instance. Accept a few seconds of reconnects, and document it on the status page.

### Scaling past one instance (later)
- [ ] Notifier over Postgres `LISTEN/NOTIFY` on a dedicated direct connection (not through a pooler).
- [ ] The serve registry and script calls need routing: either pin each channel to one instance (e.g. Fly `fly-replay` by channel id) or move the call queue into Postgres.
- [ ] Push presence (`viewing`) moves to the same place.

## Push
- [ ] Web push: one VAPID keypair for rply.sh via env (already supported).
- [ ] Mobile push: hosted can send through Expo directly, since it's our server and our credentials. Build the relay (CLAUDE.md section 5) as a separate small service for self-hosters, run next to rply.sh.
- [ ] E2E channels: generic notification text.

## Files
- [ ] R2 bucket via the existing S3 config.
- [ ] Per-account quota (see limits) and the 24h unreferenced-upload sweep (already built).

## Billing (only if there's a paid tier)
- [ ] Decide free vs paid limits (channels, storage, retention, history).
- [ ] Merchant of record (Polar, Lemon Squeezy, Paddle) so VAT is handled, or Stripe Billing.
- [ ] Enforce limits from the plan, show usage in the app.

## Security and privacy
- [ ] Decide whether E2E is the default on rply.sh ("we can't read your agents' messages"). Its costs are listed in CLAUDE.md section 8: no curl, no server-side validation, no remote MCP, generic push text.
- [ ] The web app's code is served by us, so on hosted "the server can capture secrets as they're typed" means "rply.sh can". Say so plainly in the security docs.
- [ ] Security headers on the app (CSP for the web app itself, HSTS), on top of what files already send.
- [ ] Secrets in env only (`RPLY_AUTH_SECRET`, VAPID, R2 keys, DB URL); an internal admin role for rply.sh operators (the instance owner is just the first user).
- [ ] Privacy policy, terms, legal notice where required, a DPA for business users. List subprocessors (PlanetScale, Cloudflare, the host, the email provider, Expo).

## Ops
- [ ] Environments: production plus staging with its own database.
- [ ] Deploy pipeline: build image, run migrations on start (already built), health check (already in the Railway config).
- [ ] Backups: PlanetScale PITR, plus a periodic `pg_dump` to R2 kept outside PlanetScale.
- [ ] Error tracking (Sentry or similar), structured logs, uptime checks, a public status page.
- [ ] Metrics: open long-polls, requests/s, DB latency, push failures, storage per account.
- [ ] Transactional email for sign-in (Resend, Postmark).

## Clients and docs
- [ ] Web app: sign-in and sign-up, account settings (usage, delete account, API keys), and a channel list from the account instead of localStorage.
- [ ] Site: pricing page (if paid), "rply.sh hosted vs self-host" docs, security page.
- [ ] Guide and onboarding prompt: the hosted URL as the default in examples.
