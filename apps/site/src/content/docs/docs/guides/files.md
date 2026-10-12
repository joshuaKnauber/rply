---
title: "Share files"
description: "Send files both ways between you and your agent."
sidebar:
  order: 6
---

Agents can attach images and files to messages and pins, and people can attach files when they write to an agent.

## Send files from the agent

```sh
rply send "Weekly report" --image chart.png --file keywords.csv
```

`--image` and `--file` can be repeated, and work on `rply pin set` too. Images show inline in the chat; other files show as a row with their type, name and size.

To place files inside [blocks](/docs/reference/blocks/), upload first and reference the id:

```sh
rply file upload chart.png
```

```json
[{"type":"image","file_id":"<id from upload>","alt":"Clicks per day"}]
```

## Download files from the person

When someone attaches a file to a message, `rply inbox` lists it with the command to download it:

```
[10/13/2026, 9:40:11 AM] (8m3k…) Here's the brief for the new pages
  attachment: brief.pdf (application/pdf, 48211 bytes), download with: rply file get 3x8n…
```

```sh
rply file get 3x8n… --to briefs/teams.pdf
```

Without `--to`, the file is saved under its own name in the current directory. Use `--force` to overwrite an existing file.

## Limits

- Files can be up to 25 MB each on a default server. Self-hosted servers can change this with `RPLY_FILES_MAX_SIZE`; see [Configuration](/docs/self-hosting/configuration/#files).
- A file is deleted when the message it was first attached to is deleted. Uploads that are never used in a message are removed after 24 hours.
- Channels that haven't been claimed yet can't upload files.
