---
title: "CLI configuration"
description: "The config file, environment variables and exit codes."
sidebar:
  order: 2
---

## Config file

The CLI stores its channels in `~/.config/rply/config.json` (or `$XDG_CONFIG_HOME/rply/config.json`). The file is created with permissions `0600`, since it contains agent tokens.

```json
{
  "default": "seo-bot",
  "channels": {
    "seo-bot": {
      "server": "https://app.rply.sh",
      "token": "rply_a_…",
      "channel": "jaempdfnr440qf09",
      "inbox_cursor": 42
    }
  }
}
```

- `default` is the channel commands use without `--channel`.
- `inbox_cursor` remembers which messages `rply inbox` has already shown.
- Once the agent requests a secret, the channel also stores a `secret_key`, the private key used to decrypt secrets.

Next to the config file are:

- `commands/<channel>/`, the command scripts for apps
- `logs/<channel>.log`, the log of the background service installed with `rply serve --install`
- `guide.json` and `update-check.json`, which remember whether the guide hint and update notice were shown

## Environment variables

| Variable | Description |
| --- | --- |
| `RPLY_CHANNEL` | Channel key to use, like `--channel`. |
| `RPLY_CONFIG` | Path to the config file. |
| `RPLY_SERVER`, `RPLY_TOKEN` | Server URL and agent token. Together, they replace the config file, e.g. in CI. Secrets don't work this way. |
| `RPLY_NO_UPDATE_CHECK` | Set to `1` to skip the daily check for a newer CLI version. |
| `RPLY_NO_GUIDE_HINT` | Set to `1` to hide the hint to read `rply guide`. |

`rply serve` sets these for the scripts and commands it runs:

| Variable | Set for | Description |
| --- | --- | --- |
| `RPLY_CHANNEL` | Command scripts and `--on-message` | The channel key. |
| `RPLY_CALL_NAME` | Command scripts | The command name. |
| `RPLY_CALL_ID` | Command scripts | The call's id. |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `1` | Error, e.g. a network failure, invalid input, or a missing channel. |
| `2` | Timed out, or a question or secret request expired without a default. |
| `3` | Cancelled or declined. |

## Output

- Normal output goes to stdout. Notices from rply itself, like the update notice, go to stderr.
- `--json` (before the command) prints JSON instead. `rply inbox --json` and `rply listen --json` print one message per line: `{ id, seq, sender, created_at, reply_to, state, enc, body }`.
- The QR code for claim links is only printed when stdout is a terminal, so it doesn't end up in an agent's context.

## Network behavior

Long waits are split into requests of up to 55 seconds. The CLI retries through network errors and server errors, so `--wait` commands survive a dropped connection or a server restart.
