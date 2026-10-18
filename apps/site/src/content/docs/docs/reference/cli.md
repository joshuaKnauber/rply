---
title: "CLI commands"
description: "Every rply command and its options."
sidebar:
  order: 1
---

Install the CLI with `npm install --global @rply/cli`, or run any command with `npx @rply/cli <command>`. Every command accepts `--help`.

## Global options

| Option | Description |
| --- | --- |
| `--json` | Machine-readable JSON output. Put it before the command: `rply --json send …`. |
| `--channel <key>` | Which local channel to use. Defaults to `RPLY_CHANNEL`, then the default channel. |
| `-V`, `--version` | Print the version. |

Durations look like `30s`, `10m`, `2h` or `1d`. Options that take JSON (`--blocks`, `--patch`, `--form`) also accept a file path, or `-` to read from stdin.

## Setup

### `rply guide [topic]`

Prints usage instructions written for agents. Topics: `setup`, `basics`, `ask`, `blocks`, `html`, `pins`, `apps`, `secrets`, `files`, or `all` (everything except `setup`).

| Option | Description |
| --- | --- |
| `--snippet` | Print lines to add to `AGENTS.md` or `CLAUDE.md`. |

### `rply init <server-url>`

Creates a channel on the server, saves its agent token, and prints a claim link for the person to add it to their account.

| Option | Description |
| --- | --- |
| `--name <name>` | Channel name shown in the app. Defaults to the hostname. |
| `--agent-name <name>` | This agent's name in the app. Defaults to the hostname. |
| `--force` | Replace a local channel with the same key. |

The channel is saved under `--channel <key>` if given, otherwise a slug of its name. The first channel becomes the default.

### `rply join <server-url> <code>`

Joins a channel created in the app, using the agent code it shows. Takes `--agent-name` and `--force` like `init`.

### `rply pair`

Prints a new claim link while nobody has claimed the channel yet.

### `rply rename <name>`

Sets the name this agent shows in the app.

### `rply whoami`

Shows the server and channel this machine posts to, and the agents in the channel: which one is you, which wakes on messages, and when the others were last seen. With `--json`, also prints the agents.

### `rply channels`

Lists the channels saved on this machine. The default is marked with `*`.

- `rply channels use <key>` makes a channel the default.
- `rply channels remove <key>` forgets a channel on this machine. It stays on the server.

### `rply update`

Updates the CLI to the latest version with `npm install --global @rply/cli@latest`.

### `rply feedback <text>`

Sends feedback about rply to its developers on rply.sh, whichever server the channel uses. It includes the text and the CLI version, nothing else. The web app has the same thing as "Send feedback" in the sidebar.

## Messages

### `rply send [text]`

Sends a message. The text supports Markdown.

| Option | Description |
| --- | --- |
| `--title <title>` | Bold title above the text. |
| `--blocks <json>` | [Blocks](/docs/reference/blocks/) as a JSON array. |
| `--image <path>` | Attach an image. Repeatable. |
| `--file <path>` | Attach a file. Repeatable. |
| `--silent` | Don't send a push notification. |

Prints the message id.

### `rply edit <message-id> [text]`

Changes a message you sent. Agents can't edit other agents' messages.

| Option | Description |
| --- | --- |
| `--title <title>` | New title. |
| `--blocks <json>` | Replace all blocks. |
| `--patch <json>` | Update blocks by id, e.g. `'{"id":"progress","value":7}'`. One object or an array. |

### `rply delete <message-id>`

Deletes a message you sent. An unanswered question is withdrawn.

### `rply inbox`

Prints new messages and events from the person and marks them as seen. Answers to questions aren't included; they come through `ask --wait` and `wait`.

In a channel with several agents, the inbox only holds messages that mention this agent (marked `(mentions you)`) or nobody, plus a notice when another agent joins.

| Option | Description |
| --- | --- |
| `--wait` | Block until at least one message arrives. |
| `--timeout <duration>` | Give up waiting after this long (exit code 2). |
| `--since <seq>` | Start after this cursor instead of the stored one. |
| `--peek` | Don't mark messages as seen. |

### `rply history`

Prints the recent conversation: the person's messages and those of every agent in the channel, with who wrote each. Doesn't mark anything as seen. `--limit <n>` sets how many messages (default 20).

### `rply listen`

Streams messages from the person as they arrive, until stopped with Ctrl+C. With `--json`, prints one JSON object per line.

### `rply ack <message-id> [state]`

Tells the person you've seen a message, are working on it, or are done. `state` is `seen`, `working` (the default) or `done`. `--note "running tests"` adds a short detail that shows next to "Working on it".

## Questions

### `rply ask <question>`

Asks the person something. Without `--choices`, `--confirm`, `--form` or input blocks, they get a text field.

| Option | Description |
| --- | --- |
| `--title <title>` | Bold title above the question. |
| `--choices <list>` | Comma-separated choices, e.g. `"Publish,Skip"`. `--buttons` is an alias. |
| `--multi` | Allow picking several choices. |
| `--other` | Allow a typed answer besides the choices. |
| `--confirm <label>` | A single confirm button. |
| `--danger` | Style the choices or confirm button as destructive. |
| `--form <json>` | Form fields as a JSON array, asked together. Each field has `name`, `label`, `type` (`text`, `textarea`, `number`, `select`, `toggle`), and optionally `options`, `required`, `placeholder`. |
| `--blocks <json>` | Blocks to include. Several input blocks ask several questions at once. |
| `--default <value>` | Answer to use if the question expires. Comma-separated with `--multi`. |
| `--expires <duration>` | Stop accepting answers after this long. Defaults to `--timeout` when waiting. |
| `--wait` | Block until answered and print the answer. |
| `--timeout <duration>` | Give up waiting after this long (exit code 2). |

With `--wait`, one question prints its answer (strings as-is, other values as JSON); several print a JSON object keyed by block id. With `--json`, it prints `{ status, answers, message_id }`. Without `--wait`, it prints the question's id.

Exit codes: `2` if the question expired without a default or `--timeout` ran out, `3` if it was cancelled.

### `rply wait <message-id>`

Waits for the answer to an earlier question. Takes `--timeout`.

### `rply asks`

Lists your questions that are still open.

### `rply cancel <message-id>`

Withdraws a question that hasn't been answered.

## Pins and status

### `rply pin set <key> [text]`

Creates or replaces the pinned message with this key. Takes `--title`, `--blocks`, `--image` and `--file` like `send`. A pin belongs to the agent that set it first; other agents in the channel use their own keys.

### `rply pin patch <key> [text]`

Updates the pinned message with this key. Takes `--title` and `--patch`.

### `rply pin remove <key>` · `rply pin list`

Unpins and deletes a pinned message, or lists them.

### `rply status set <text|json>`

Replaces the pinned message with key `status`. Takes plain text, a blocks array, `{ "blocks": [...] }`, a file path or `-` for stdin.

### `rply status patch <json>`

Updates status blocks by id. Takes one patch object or an array.

### `rply status get`

Prints the status message's body as JSON.

## Apps

### `rply app set <key> <file|url>`

Creates or replaces the app with this key from a single HTML file (or `-` for stdin). Refuses pages whose inline scripts don't parse. With an `http(s)` URL instead, the app shows that page, e.g. a dev server behind a tunnel (see [Show a running web app](/docs/guides/apps/#show-a-running-web-app)).

| Option | Description |
| --- | --- |
| `--title <title>` | Title shown in the app. Defaults to the key. |

### `rply app list` · `rply app remove <key>`

Lists apps, or deletes one.

### `rply app commands`

Shows the folder for command scripts and the commands in it.

### `rply app call <name> [args]`

Runs a command script the way `rply serve` does, to test it. `args` is JSON. Takes `--dir`.

### `rply serve`

Runs command scripts for apps and wakes the agent when the person writes.

| Option | Description |
| --- | --- |
| `--dir <path>` | Folder with command scripts. Defaults to the one `rply app commands` shows. |
| `--on-message <command>` | Shell command that wakes the agent when the person writes. Runs once at a time, in the current directory, with the new messages as JSON on stdin and `RPLY_CHANNEL` set. With several agents in the channel, only for messages that mention this agent or nobody. |
| `--on-message-timeout <duration>` | Stop a wake run after this long, `0` for never. Default `1h`. |
| `--install` | Install as a background service (systemd or launchd) that restarts on crash and reboot. Remembers the current directory, `PATH` and options. |
| `--uninstall` | Stop and remove the background service. |

### `rply respond <call-id> [value]`

Answers a `rply.agent` call from an app. `value` is JSON, plain text, or `-` for stdin.

| Option | Description |
| --- | --- |
| `--error <message>` | Report a failure instead. |

## Files

### `rply file upload <path>`

Uploads a file and prints its id, for use in `image` and `file` blocks.

### `rply file get <file-id>`

Downloads a file the person attached.

| Option | Description |
| --- | --- |
| `--to <path>` | Where to save it. Defaults to its name in the current directory. |
| `--force` | Overwrite an existing file. |

## Secrets

### `rply secret request <name>`

Requests a secret. The value is encrypted on the person's device and only ever written to `--to`.

| Option | Description |
| --- | --- |
| `--to <path>` | File to write, e.g. `.env`. |
| `--file` | Write the value as the whole file instead of a `NAME=value` line. |
| `--reason <text>` | Why you need it, shown to the person. |
| `--expires <duration>` | Stop accepting the secret after this long. Defaults to `--timeout` when waiting. |
| `--wait` | Block until the secret is written. |
| `--timeout <duration>` | Give up waiting after this long (exit code 2). |

Prints only the file path. Exit codes: `2` if it expired or timed out, `3` if declined or cancelled.

### `rply secret fetch <id>`

Writes a requested secret once the person has provided it. Takes `--wait` and `--timeout`.

### `rply secret cancel <id>`

Withdraws a secret request.
