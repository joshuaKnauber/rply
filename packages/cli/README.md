# rply

Talk to the human behind your agent. Send updates, ask questions and wait for answers, and keep a live status page, all from a shell. The human reads and replies in the rply web app (and soon the mobile app).

rply is self-hosted: you run the server (one Docker image with SQLite), and agents talk to it through this CLI.

## Setup

```sh
npm install --global @rply/cli    # installs the `rply` command
rply init https://your-rply-server --name "SEO bot" [--server-token <admin token>]
```

`init` creates a channel and prints a one-time pairing link (and a QR code when run in a terminal). Open it to add the channel to your inbox. Use `rply pair` to add another device.

Or run it without installing: `npx @rply/cli <command>`.

## Commands

```sh
rply send "Deployed **3** pages" [--title Update] [--blocks blocks.json]
rply ask "Publish these drafts?" --buttons Yes,No --wait      # prints: Yes
rply ask "Which domain should I add?" --wait                  # free-text answer
rply ask "New project" --form fields.json --wait              # prints the answers as JSON
rply ask "Deploy tonight?" --buttons Yes,No                   # returns at once, prints an id
rply wait <id> [--timeout 1h]                                 # answer to an earlier ask
rply inbox [--wait] [--timeout 10m]                           # new messages from the human
rply listen                                                   # stream messages as they arrive
rply status set status.json                                   # replace the status page
rply status patch '{"id":"pages","value":42}'                 # update one block by id
rply status get
rply pair | whoami | update
```

## Several channels

One machine can post to several channels, e.g. one per agent or project. `init` saves each channel under a short name (a slug of `--name`, or `--channel <name>`), and the first one becomes the default.

```sh
rply init https://your-rply-server --name "Shop agent" --channel shop
rply send "Order synced" --channel shop    # or RPLY_CHANNEL=shop
rply channels                              # list them, * marks the default
rply channels use shop                     # change the default
rply channels remove shop                  # forget it on this machine
```

Add `--json` to any command for machine-readable output. Exit code 2 means a `--timeout` ran out.

## Blocks

Messages and status pages are lists of typed blocks: `markdown`, `heading`, `buttons`, `form`, `progress`, `keyvalue`, `table`, `code`, `link`.

```json
[
  { "type": "heading", "text": "SEO overview" },
  { "type": "progress", "id": "pages", "value": 12, "max": 20, "label": "Pages published" },
  { "type": "keyvalue", "items": [{ "key": "Projects", "value": "3" }] }
]
```

## Environment

- `RPLY_SERVER` and `RPLY_TOKEN` replace the config file, which suits CI.
- `RPLY_CHANNEL` picks a saved channel, like `--channel`.
- `RPLY_SERVER_TOKEN` supplies `init --server-token`.
- `RPLY_CONFIG` sets the config path (default `~/.config/rply/config.json`).
- `RPLY_NO_UPDATE_CHECK=1` turns off the daily update check.
