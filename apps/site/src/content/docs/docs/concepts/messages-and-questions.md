---
title: "Messages and questions"
description: "The life of a message: blocks, questions, answers, edits and acknowledgements."
sidebar:
  order: 3
---

Everything in a channel is a message: updates from the agent, your replies, questions and their answers, pinned statuses, secret requests. This page explains how they relate.

## Messages are text plus blocks

An agent message has optional text (Markdown), an optional title, and a list of **blocks**. Blocks are typed pieces of content: a table, a progress bar, an image, a choice. The apps know how to draw each type. If an app doesn't know a block type yet, it shows a short "update the app" placeholder instead of failing, so new block types can ship without breaking older apps.

Your messages to the agent are plain text, optionally with attachments.

## A message with inputs is a question

Some blocks are **inputs**: `choice`, `text_input`, `number_input`, `toggle` and `confirm`. A message that contains at least one input is a question. `rply ask` builds those blocks for you; `--blocks` lets you write them yourself, and one message can hold several inputs that are answered together.

When there's exactly one simple input, such as one set of choices or a confirm button, the app submits as soon as you tap. Otherwise it shows a **Send answers** button.

### The first answer wins

A question accepts exactly one answer. Once you've answered on one device, it's answered everywhere, and the agent gets that answer. This makes questions safe to use for approvals: an action can't be approved twice.

### Expiry, defaults and cancelling

- A question can **expire** (`--expires 2h`). After that it stops accepting answers.
- An input can have a **default**. When the question expires, the CLI uses the default as the answer.
- The agent can **cancel** a question (`rply cancel`), or withdraw it by deleting the message. The app shows it as cancelled.

The CLI reports how a question ended through its exit code: `0` answered, `2` expired without a default or timed out, `3` cancelled.

## Answers vs events

Interactive HTML blocks and apps can send two different things back:

- An **answer** completes a question, like tapping a choice. There's only one.
- An **event** is a notification that something happened, like clicking a bar in a chart. A block can send any number of events, and they don't answer anything.

Events reach the agent through `rply inbox` like your messages do. Answers come back through `rply ask --wait` or `rply wait` and never appear in the inbox.

## Acknowledgements

When you write to an agent, your message shows its state:

- **Seen** once the agent has read its inbox.
- **Working on it** and **Done** when the agent says so with `rply ack`.

## Edits and deletions

Agents can edit their own messages, either replacing the content or patching single blocks by id. Edits show up live in every open app and don't send notifications. Deleting a message removes it for everyone; deleting an unanswered question withdraws it.

## Pins

A pinned message floats at the top of the channel instead of sitting in the thread. Each pin has a key, and `status` is the conventional one. Pins are regular messages, so they support the same blocks, edits and patches. When you unpin a message in the app, it moves into the thread at the position it was first posted.

**Apps** are pins too: a pin whose only content is an HTML page, shown full-size under the channel instead of in the chat.
