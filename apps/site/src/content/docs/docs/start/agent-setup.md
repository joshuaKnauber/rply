---
title: "Set up your agent"
description: "Teach your agent to use rply and get woken up when you write to it."
sidebar:
  order: 3
---

Once an agent is set up, it reports to you on its own, asks when a decision is yours, and starts working when you send it a message, even when nobody has a session open.

## The short way: give your agent the setup prompt

The quickest setup is to let the agent do it. Paste this into Claude Code, Codex or any agent with a shell:

```text
Connect yourself to rply (https://rply.sh) so you can send me updates and ask me questions.

1. Install the CLI: npm install --global @rply/cli
2. Create your channel: rply init https://app.rply.sh --name "<a name for you>"
   Show me the claim link it prints and wait until I've opened it and signed in.
3. Run rply guide setup and follow it from step 3.

If you're Hermes Agent, use the rply plugin instead of the CLI:
- hermes plugins install https://github.com/joshuaKnauber/rply/tree/main/integrations/hermes --enable
- hermes rply init https://app.rply.sh --name "<a name for you>"
- Show me the claim link it prints, then run hermes gateway restart (or hermes gateway install if the gateway isn't installed yet).
```

The same prompt is behind the **Copy setup prompt** button on [rply.sh](https://rply.sh). If you created the channel in the app instead, the app shows a prompt with a one-time agent code; the agent runs `rply join` (or `hermes rply join`) with it instead of `rply init`.

Agents with an [integration](/docs/integrations/), like Hermes Agent, connect through it instead of the CLI, which is why the prompt has a separate branch for them.

The rest of this page explains what the agent does, so you can do it by hand or check its work.

## What `rply guide setup` walks through

`rply guide setup` prints a checklist written for agents. The steps are:

### 1. Install the CLI globally

```sh
npm install --global @rply/cli
```

Use a global install rather than `npx`. The background service in step 5 needs a stable path to the `rply` command.

### 2. Connect to a channel

Either join a channel you created in the app, using the agent code it shows:

```sh
rply join https://app.rply.sh K7QX-M2PD --agent-name "seo-bot"
```

or create one and send you the claim link:

```sh
rply init https://app.rply.sh --name "SEO bot" --agent-name "seo-bot"
```

`--agent-name` is how this agent appears in the channel's agent list. It defaults to the machine's hostname.

### 3. Learn the commands and remember them

The agent reads the full guide with `rply guide all`, then adds a short instructions block to the file its future sessions read, such as `AGENTS.md` or `CLAUDE.md`:

```sh
rply guide --snippet >> AGENTS.md
```

The snippet looks like this:

```md
## Talking to the human (rply)

This agent reports to its human through the `rply` CLI. Run `rply guide` once per session before using it.
- Send progress with `rply send`, keep `rply status` up to date, and check `rply inbox` for new instructions.
- Ask with `rply ask ... --wait` when a decision is the human's.
- Request credentials with `rply secret request`, never through messages.
- To let the human try a running web app (e.g. a dev server), see `rply guide previews`; ask them how to expose it first.
- When you were started because of new rply messages, run `rply inbox` first and answer through rply.
- If `rply` is missing, reinstall it with `npm install --global @rply/cli` (the package is @rply/cli, not rply).
- If an rply integration for your agent framework is installed (a plugin or messaging platform), follow its instructions where they differ from these.
```

### 4. Pick a wake command

Most agents don't run all the time. rply starts the agent when you write to it, using one shell command that runs the agent headless in its project. For example:

```sh
# Claude Code
claude -p "You have new messages in rply. Run rply inbox and handle them."

# Codex
codex exec "You have new messages in rply. Run rply inbox and handle them."
```

Use your agent's non-interactive mode, with permissions that let it work unattended, and run the command once by hand to check it works.

### 5. Install the background service

From the agent's project directory:

```sh
cd ~/projects/acme-seo
rply serve --install --on-message 'claude -p "You have new messages in rply. Run rply inbox and handle them."'
```

This installs `rply serve` as a background service (systemd on Linux, launchd on macOS) that restarts on crash and reboot. It does two things:

- **Wakes the agent.** When you write, it runs the `--on-message` command in the project directory, with the new messages as JSON on stdin. It runs one at a time; messages that arrive during a run trigger one more run afterwards. Runs stop after an hour by default; raise that with `--on-message-timeout 4h`, or `0` for no limit.
- **Runs command scripts for apps.** See [Build an app](/docs/guides/apps/).

If the channel has other agents, they can all use `--on-message`: each is woken for messages that mention it or nobody (see [Several agents in one channel](/docs/guides/channels/#several-agents-in-one-channel)). Remove the service with `rply serve --uninstall`.

:::caution
Don't start the agent in the background from the wake command. Runs would overlap. If runs take longer than an hour, raise `--on-message-timeout` instead.
:::

### 6. Check that it works

The agent sends a test message:

```sh
rply send "Setup done. Reply to this message to check I get woken up."
```

Reply in the app. If the agent is woken and answers, the setup is complete.

## Troubleshooting

- **Nothing happens when you reply.** Check the service log at `~/.config/rply/logs/<channel>.log` (next to your config file). Make sure the wake command works when you run it by hand from the project directory.
- **No service manager** (some containers and sandboxes). Run `rply listen` in a long-running process instead. It prints your messages as they arrive.
- **The agent can't do something.** A good setup prompt tells the agent to say so with `rply send` rather than pretend. Fix the permissions and run `rply guide setup` again.

## Next steps

- [Take instructions from the app](/docs/guides/instructions/) covers the inbox and acknowledgements in detail.
- [Use several channels](/docs/guides/channels/) if one machine runs several agents.
