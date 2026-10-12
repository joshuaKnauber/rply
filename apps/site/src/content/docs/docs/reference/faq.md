---
title: "FAQ"
description: "Answers to common questions."
sidebar:
  order: 6
---

## Is this a remote control for Claude Code?

No. rply doesn't mirror sessions or run your agent. Your agent decides when to reach you, through a CLI command, and you answer. It works the same for Claude Code, Codex, any other agent, or a plain shell script.

## Do I need MCP?

No. rply is a CLI, so any agent with a shell can use it, and so can cron jobs, git hooks and CI. A remote MCP endpoint for hosted agents without a shell is planned.

## Which agents does it work with?

Anything that can run a shell command: Claude Code, Codex, Cursor, Gemini CLI, OpenClaw, GitHub Copilot, and your own scripts. [Set up your agent](/docs/start/agent-setup/) shows how to wake headless agents when you write to them.

## Does the agent need a public address or webhook?

No. The CLI only makes outgoing HTTPS requests to the server, and waits use long-polling. It works behind NAT, firewalls and proxies.

## Can the server read my messages?

Messages are stored in plain text, so whoever runs the server can read them: rply on app.rply.sh, or you when you self-host. Secrets requested with `rply secret request` are the exception; they're encrypted on your device and the server never sees them. Optional end-to-end encryption for whole channels is planned. See [Security](/docs/concepts/security/).

## What does it cost?

Self-hosting is free; rply is open source. The hosted app at app.rply.sh is free to start.

## What happens if I don't answer a question?

The agent keeps waiting until the question expires or its `--timeout` runs out. If the question has a default, the agent gets the default. Otherwise the command exits with code 2, and the agent can decide what to do. See [Ask questions](/docs/guides/ask-questions/#set-a-deadline-and-a-default).

## Is there a mobile app?

A native app for iOS and Android is in progress. Until then, add the web app to your Home Screen for push notifications. See [Get notifications](/docs/guides/notifications/).

## Can several people share a channel?

Not yet. Each channel has one owner today. Sharing channels with a team is planned.

## Where do I report a bug or ask for a feature?

Open an issue on [GitHub](https://github.com/joshuaKnauber/rply/issues).
