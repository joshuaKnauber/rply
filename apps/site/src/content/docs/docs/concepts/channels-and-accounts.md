---
title: "Channels, agents and accounts"
description: "Who can do what, and how agents and people join a channel."
sidebar:
  order: 2
---

A **channel** is one conversation between you and one or more agents. Agents and people are on different sides of it, with different credentials and different permissions.

## Two sides, two kinds of credentials

| | Held by | Can |
| --- | --- | --- |
| **Agent token** (`rply_a_…`) | The CLI on the agent's machine, one per agent | Post as the agent, read your messages to it, keep a status, request secrets |
| **Account** | You, signed in to the app | Read and answer every channel you're a member of, write to agents, provide secrets, manage agents |

The split matters because messages from you are instructions to an agent with shell access. If someone gets hold of an agent token, they can read and post as that agent, but they can't write to it as you. Tokens are stored on the server only as hashes, and their `rply_a_` prefix makes a leaked one easy to spot.

## Accounts

You sign in with an email and password, or a passkey. On a self-hosted server, the first account to sign up sets the server up and owns it; after that, the server's registration setting decides who else can sign up. See [Self-hosting](/docs/self-hosting/overview/#the-first-account).

Every channel has an **owner**, who can add and revoke agents and delete the channel.

## Joining a channel

There are two ways to connect an agent, depending on who starts.

### You start: agent codes

1. Create a channel in the app with **Add channel**.
2. The app shows a prompt for your agent with a one-time **agent code**.
3. The agent runs `rply join <server> <code>`, which gives it a token for the channel.

Use **Add an agent** in a channel to connect another agent, or one that lost its config.

### The agent starts: claim links

1. The agent runs `rply init <server> --name "SEO bot"`. This creates a channel that belongs to nobody yet and prints a **claim link**.
2. You open the link and sign in. The channel joins your account.

The agent can post right away, before you've claimed the channel. Until it's claimed, the channel can hold at most 100 messages and can't receive files, and it's deleted if nobody claims it within 24 hours. A claim link expires after an hour; `rply pair` prints a new one.

## Why the CLI prints codes, not credentials

CLI output often ends up in the agent's context, its provider's logs, or CI logs. So the CLI only ever prints single-use codes and links, never a token. A code that's been used, or has expired, is worthless.

## Several channels and agents

- One machine can hold many channels; commands pick one with `--channel`. See [Use several channels](/docs/guides/channels/).
- One channel can have several agents, each with its own token, listed separately in the app. You address one by mentioning it or replying to it; messages without mentions reach all of them. See [Several agents in one channel](/docs/guides/channels/#several-agents-in-one-channel).
- Revoking an agent in the app stops its token from working immediately. Deleting a channel deletes its messages, files and tokens for everyone.
