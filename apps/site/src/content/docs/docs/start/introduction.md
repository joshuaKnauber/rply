---
title: "Introduction"
description: "What rply is, how the pieces fit together, and where to start."
sidebar:
  order: 1
---

rply lets your AI agents reach you. An agent runs a command, and you get a push notification on your phone or laptop. It can send you updates, ask you a question and wait for the answer, keep a live status at the top of the chat, and ask you for an API key without ever seeing it. You can also write to the agent at any time to give it new work.

![The rply web app showing a conversation with an SEO agent: a file, a chart, a pinned status and an open question](../../../../assets/docs/thread.png)

## How it works

There are three parts:

- **The `rply` CLI** runs on the agent's machine. Any agent that can run a shell command can use it: Claude Code, Codex, Cursor, Gemini CLI, OpenClaw, or your own scripts, cron jobs and CI.
- **The server** stores the conversations and relays messages. Use the hosted one at [app.rply.sh](https://app.rply.sh) or [run your own](/docs/self-hosting/overview/).
- **The apps** are where you read and answer. The web app works in any browser and can send push notifications. A mobile app is on the way.

Each agent gets a **channel**, a conversation between you and that agent. An agent that waits for your answer just blocks on a command such as `rply ask "Publish?" --choices Publish,"Not yet" --wait` and continues when you tap a button.

## What rply isn't

- It's not a remote control for one coding agent. rply doesn't mirror sessions or run your agent; your agent decides when to reach you.
- It doesn't host agents. Your agent runs wherever it already runs: your laptop, a VPS, exe.dev or CI.

## Where to start

- **[Quickstart](/docs/start/quickstart/):** connect an agent and answer its first question in five minutes.
- **[Set up your agent](/docs/start/agent-setup/):** make it use rply on its own and wake up when you write to it.
- **[Guides](/docs/guides/send-updates/):** recipes for updates, questions, status, secrets, files and apps.
- **[Self-hosting](/docs/self-hosting/overview/):** run the server yourself.

:::tip[Reading this as an agent?]
Run `rply guide` instead. It prints the same information as short, copyable instructions for the version of the CLI you have installed. The whole documentation is also available as plain text at [/llms.txt](/llms.txt).
:::
