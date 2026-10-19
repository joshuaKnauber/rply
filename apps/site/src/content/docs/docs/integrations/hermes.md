---
title: "Hermes Agent"
description: "Talk to Hermes Agent from rply: messages, files, approvals, secrets, scheduled jobs and a dashboard, through a Hermes messaging platform plugin."
sidebar:
  order: 2
---

[Hermes Agent](https://hermes-agent.nousresearch.com) talks to you through messaging platforms like Telegram or Discord. The rply plugin adds rply as one of them. Once it's set up, you write to Hermes in the rply app on your phone or laptop and it answers there, with push notifications, buttons for its questions, and a dashboard for its scheduled jobs.

## What you get

- **Messages both ways.** Your messages go straight to Hermes, and its replies arrive as rply messages with markdown. Under your message you see Seen, Working on it (with what it's doing right now, like "running terminal") and Done.
- **Files both ways.** Send Hermes screenshots or documents, and get its charts and files back with previews.
- **Questions with buttons.** When Hermes asks you to choose, you get the options as a question, including multi-select and an "other" field.
- **Approvals.** When Hermes wants to run a command that needs your OK, you get Approve once, Approve for this session, Always approve and Deny. If nobody answers before Hermes' approval timeout, the command doesn't run.
- **Secrets.** Hermes asks for API keys with the `rply_request_secret` tool. You type the key into a masked field, it's encrypted on your device, and the plugin saves it to Hermes' `.env`. Hermes only learns that it was saved.
- **Scheduled jobs.** Jobs created with `--deliver rply` send their results to the channel. A pinned "Scheduled jobs" table shows every job's last run, result and next run.
- **A dashboard.** A Hermes app under the channel shows your model, jobs, recent sessions and token use, with buttons to run, pause and resume jobs.
- **Profiles.** Each Hermes profile joins the channel as its own agent. Mention one with `@name`; messages without a mention go to all of them.

## Set it up

You need Hermes Agent 0.22.2 or newer and an rply account, for example on [app.rply.sh](https://app.rply.sh).

### Let Hermes do it

In the rply app, create a channel and copy the setup prompt it shows, then paste it into Hermes. The prompt has a branch for Hermes: it installs the plugin, connects with the channel's agent code and restarts the gateway.

### Or by hand

1. Install and enable the plugin:

   ```sh
   hermes plugins install rply-platform --enable
   ```

2. In the rply app, create a channel for Hermes. The app shows an agent code. For a channel you already have, open it and choose **Add an agent**.

3. Run Hermes' gateway setup, pick **rply** and enter the code:

   ```sh
   hermes gateway setup
   ```

   Leave the code empty to create a new channel instead. Setup then prints a link that adds the channel to your rply account.

   Without the menu, the same works as one command: `hermes rply join <server-url> <code>`, or `hermes rply init <server-url> --name "<channel name>"` to create a channel.

4. Restart the gateway, or install it if you haven't yet:

   ```sh
   hermes gateway restart    # or: hermes gateway install
   ```

Hermes posts "Gateway online" to the channel when it's connected. Write it a message to try it.

To send a scheduled job's results to rply, create it with `--deliver rply`:

```sh
hermes cron create --name "Morning summary" --deliver rply "0 8 * * *" "Summarize what happened yesterday."
```

## Several profiles

Every profile has its own copy of the plugin and its own rply agent. Set each one up against the same channel with an agent code of its own:

```sh
hermes -p research plugins install rply-platform --enable
hermes -p research rply join https://app.rply.sh <code>
hermes gateway restart
```

The agent is named after the profile, and its pins and dashboard get the profile name too, like "Scheduled jobs · research". A profile created with `hermes profile create --clone` already has the plugin. Update the plugin in every profile when a new version comes out.

## Settings

Setup writes these to the profile's `.env`:

| Variable | Meaning |
| --- | --- |
| `RPLY_TOKEN` | The agent token for the channel. |
| `RPLY_SERVER` | The rply server, `https://app.rply.sh` unless you self-host. |
| `RPLY_ALLOWED_USERS` | The channel id. Only members of the channel can post to it, so it's the one user Hermes accepts. |

Hermes announces restarts in the channel ("Hermes is restarting", "Gateway online"). To turn that off for rply, run this for each profile (add `-p <name>` for named ones) and restart the gateway:

```sh
hermes config set platforms.rply.gateway_restart_notification false
```

## If you used the CLI before

If Hermes was connected to rply through the CLI first, remove that setup so it doesn't run twice:

- Reinstall `rply serve` without `--on-message`, or uninstall it with `rply serve --uninstall`. Otherwise every message wakes a second Hermes run.
- Remove the rply lines from Hermes' instructions file (`~/.hermes.md` or similar). The plugin tells Hermes how to reply, and the CLI's lines would have it use `rply send` and `rply secret request` instead.

## Using the CLI next to the plugin

The [rply CLI](/docs/reference/cli/) adds custom questions, pins and apps. Install it with `npm install --global @rply/cli`. Inside Hermes it uses the plugin's connection automatically: Hermes sets `HERMES_HOME` to the profile, and the CLI reads `RPLY_SERVER` and `RPLY_TOKEN` from that profile's `.env`. Each profile stays one agent, and you never run `rply join` for Hermes. `rply serve` and `rply secret request` refuse to run there, since the plugin wakes Hermes and has its own secret tool.

## What the plugin does on your machine

- Keeps one long-running connection to your rply server for messages and dashboard calls.
- Reads Hermes' scheduled jobs and session list for the pinned table and the dashboard, and runs, pauses or resumes jobs when you press the dashboard's buttons.
- Stores the agent token in the profile's `.env`, its position in the channel and a keypair for secrets in the profile's `rply/` folder (the keypair with permissions `0600`).
- Saves secrets you send to the profile's `.env`.

It talks to no other service. Encrypted rply channels aren't supported yet; their messages are skipped.
