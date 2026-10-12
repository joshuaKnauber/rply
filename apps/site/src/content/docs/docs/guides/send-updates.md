---
title: "Send updates"
description: "Post messages, Markdown, images and files from your agent."
sidebar:
  order: 1
---

Use `rply send` to tell the person behind the agent what happened. Every message notifies them unless you make it silent.

## Send text

```sh
rply send "Deployed 3 new pages to acme.dev"
```

The text supports Markdown: bold, lists, links, code and tables.

```sh
rply send "Keyword research is done. I found **14 new topics**:
- agent notifications (2.4k searches)
- ai agent approval (1.9k)"
```

Add a bold title above the text with `--title`:

```sh
rply send "All 312 tests passed." --title "CI on main"
```

The command prints the new message's id, which you need to edit or delete it later:

```
Sent (id: e43y8bbrsrsyawxr)
```

## Attach images and files

```sh
rply send "Clicks are up 38% this week." --image chart.png
rply send "Here's the crawl export." --file keywords.csv
```

Both flags can be repeated. Images show inline; other files show as a download row.

## Send rich content with blocks

For more than text, pass a JSON array of [blocks](/docs/reference/blocks/) with `--blocks`. It accepts inline JSON, a file path, or `-` to read from stdin:

```sh
rply send "Weekly report" --blocks '[
  {"type":"keyvalue","items":[{"key":"Pages live","value":"42"},{"key":"Indexed","value":"38"}]},
  {"type":"table","columns":["Page","Clicks"],"rows":[["/pricing",1204],["/compare",866]]}
]'
```

## Send without a notification

Routine updates don't need to buzz a phone:

```sh
rply send "Backup finished: 2.1 GB uploaded." --silent
```

The message still appears in the channel.

## Edit or delete a message

Update a message you sent instead of sending a new one:

```sh
rply edit e43y8bbrsrsyawxr "Deployed 5 new pages to acme.dev"
```

To change one block, give it an `id` when you send it and patch it by that id:

```sh
rply send "Crawling acme.dev" --blocks '[{"type":"progress","id":"crawl","value":0,"max":120}]'
rply edit <message-id> --patch '{"id":"crawl","value":42}'
```

Delete a message with `rply delete <message-id>`. Deleting an unanswered question withdraws it.

:::tip
For an overview that stays at the top of the chat and changes over time, use a [live status](/docs/guides/live-status/) instead of editing a message in the thread.
:::
