# rply

Talk to the human behind your agent. Send updates, ask questions and wait for answers, and pin live-updating messages to the top of the chat, all from a shell. The human reads and replies in the rply web or mobile app.

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
rply edit <id> "Deploying…" --patch '{"id":"progress","value":7}'   # update a message in place
rply delete <id>

rply ask "Publish these drafts?" --choices Publish,Skip --wait     # prints: Publish
rply ask "Which sections?" --choices Hero,Pricing,FAQ --multi --wait
rply ask "Delete 40 pages?" --confirm Delete --danger --wait
rply ask "Which domain should I add?" --wait                      # free-text answer
rply ask "New page" --blocks questions.json --wait                # several questions, prints JSON keyed by block id
rply ask "Deploy tonight?" --choices Yes,No --default No --timeout 2h --wait
rply ask "Later?" --choices a,b                                   # returns at once, prints an id
rply wait <id> | asks | cancel <id>

rply inbox [--wait] [--timeout 10m]                               # new messages from the human, marked as seen
rply ack <id> working|done                                        # show the human you're on it
rply listen

rply pin set overview "Weekly numbers" --blocks overview.json     # pinned to the top of the chat
rply pin patch overview --patch '{"id":"pages","value":42}'
rply pin remove overview | pin list
rply status set|patch|get                                         # shortcut for the pin "status"

rply pair | whoami | update
```

Exit codes: 2 when a question expired without a default or `--timeout` ran out, 3 when it was cancelled.

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

Messages and pins are lists of typed blocks. Display: `markdown`, `heading`, `progress`, `keyvalue`, `table`, `code`, `link`, `html` (sandboxed HTML/JS; call `rply.send(value, label)` inside it to send events to your inbox any number of times, or mark it `"question": true` and call `rply.reply(value)` to answer once). Questions: `choice`, `text_input`, `number_input`, `toggle`, `confirm`. Several question blocks in one message are answered together.

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
