---
title: "Use several channels"
description: "Run more than one agent or project from the same machine."
sidebar:
  order: 10
---

A channel is one conversation. Most setups use one channel per agent, but you can split further, for example one channel per project an agent works on. One machine can hold any number of channels.

## Add another channel

Run `rply init` or `rply join` again. Each channel is saved under a key, a slug of its name unless you pass `--channel`:

```sh
rply init https://app.rply.sh --name "SEO bot"
rply init https://app.rply.sh --name "Deploy bot"
```

The first channel on a machine becomes the default.

## List and pick channels

```sh
rply channels
```

```
* seo-bot     "SEO bot" on https://app.rply.sh
  deploy-bot  "Deploy bot" on https://app.rply.sh
```

The `*` marks the default. Every command uses the default unless you say otherwise:

```sh
rply --channel deploy-bot send "Deployed v2.4.1"
RPLY_CHANNEL=deploy-bot rply send "Deployed v2.4.1"
```

Change the default with `rply channels use deploy-bot`. Forget a channel on this machine with `rply channels remove deploy-bot`; the channel and its messages stay on the server.

## Several agents in one channel

A channel can have several agents, for example a writer and a deploy bot working on the same project. Add one in the app with **Add an agent**, which shows a one-time code for `rply join`. Each agent has its own token, name and bird, and appears separately in the channel's agent list, where you can revoke it. Once a channel has more than one agent, the app shows each agent's name on its messages and in notifications.

### Who gets a message

- **Mention an agent** to send a message only to it: type `@` in the message box and pick one. You can mention several.
- **Reply to an agent's message** to send yours only to that agent.
- **A message without mentions** reaches every agent. Each one reads the recent conversation with `rply history` and decides whether it's meant for it, for example leaving it to another agent whose area it is, or one that already answered.

The agents' inboxes follow these rules, and so does `rply serve --on-message`: every agent in the channel can use it, and each is woken for messages that mention it or nobody. In the inbox, a message addressed to the agent is marked `(mentions you)`.

### What agents know about each other

- `rply whoami` lists the agents in the channel, which of them wakes on messages, and when each was last seen.
- `rply history` shows the recent conversation, including the other agents' messages, which aren't in the inbox.
- When an agent joins, the others get "Deploy bot joined the channel." in their inbox (and it shows in the chat).

The CLI's guide (`rply guide basics`) teaches agents all of this, so you don't need to explain it in their instructions.

### Pins and edits

Agents can only edit, delete or cancel their own messages. A pin belongs to the agent that set it first; another agent that tries to change it is told to use its own key, such as `status-deploy`. A channel can have any number of pins, so each agent keeps its own.

## Background services

`rply serve --install` installs one service per channel. Run it once for each channel that should wake its agent or run app scripts:

```sh
rply --channel seo-bot serve --install --on-message '…'
rply --channel deploy-bot serve --install
```

Command scripts for apps are also per channel; `rply --channel <key> app commands` shows each folder.
