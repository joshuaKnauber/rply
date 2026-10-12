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

A channel can have several agents, for example the same agent on two machines. Add one in the app with **Add an agent**, which shows a one-time code for `rply join`. Each agent has its own token and appears separately in the channel's agent list, where you can revoke it.

If several agents share a channel, only one of them should run `rply serve --on-message`. Otherwise every message wakes all of them.

## Background services

`rply serve --install` installs one service per channel. Run it once for each channel that should wake its agent or run app scripts:

```sh
rply --channel seo-bot serve --install --on-message '…'
rply --channel deploy-bot serve --install
```

Command scripts for apps are also per channel; `rply --channel <key> app commands` shows each folder.
