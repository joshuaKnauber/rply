---
title: "Use rply in scripts and CI"
description: "Use rply from cron jobs, git hooks and CI, not just agents."
sidebar:
  order: 9
---

The `rply` CLI works the same without an agent. Any script that can run a command can notify you, ask for approval, or keep a status up to date.

## Send from a cron job

```sh title="backup.sh"
#!/bin/sh
if restic backup /data; then
  rply send "Backup finished" --silent
else
  rply send "**Backup failed.** Check the logs on $(hostname)."
fi
```

## Configure with environment variables

Machines without a config file, such as CI runners, can pass the channel through environment variables instead:

```sh
export RPLY_SERVER=https://app.rply.sh
export RPLY_TOKEN=rply_a_…   # an agent token for the channel
rply send "Build #482 passed"
```

`RPLY_SERVER` and `RPLY_TOKEN` override the config file. To get a token, run `rply init` or `rply join` on any machine and copy `token` from the channel's entry in `~/.config/rply/config.json`. Store it as a secret in your CI system.

:::caution
An agent token can post to the channel and read your messages to it. Keep it in your CI's secret store, never in the repository. Revoke it from the channel's agent list in the app if it leaks.
:::

## Ask for approval in GitHub Actions

`rply ask --wait` blocks until you answer, which makes it a simple approval gate:

```yaml title=".github/workflows/deploy.yml"
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      RPLY_SERVER: https://app.rply.sh
      RPLY_TOKEN: ${{ secrets.RPLY_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - name: Ask for approval
        run: |
          answer=$(npx @rply/cli ask "Deploy ${{ github.sha }} to production?" \
            --choices Deploy,Cancel --timeout 30m --wait)
          test "$answer" = "Deploy"
      - run: ./deploy.sh
```

If nobody answers within 30 minutes, the command exits with code 2 and the job fails.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Error, for example a network or validation error |
| `2` | Timed out, or a question expired without a default |
| `3` | Cancelled or declined |

## JSON output

Add `--json` before the command to get machine-readable output:

```sh
rply --json send "Build #482 passed"
rply --json ask "Deploy?" --choices Deploy,Cancel --wait
```

With `--wait`, `ask` prints `{ status, answers, message_id }`. `rply inbox --json` and `rply listen --json` print one message per line.

## Keep it quiet

Two notices go to stderr: an update notice when a newer CLI version exists, and a hint to read `rply guide`. Turn them off in scripts:

```sh
export RPLY_NO_UPDATE_CHECK=1 RPLY_NO_GUIDE_HINT=1
```
