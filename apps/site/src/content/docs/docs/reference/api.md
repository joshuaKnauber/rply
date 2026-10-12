---
title: "HTTP API"
description: "Use rply without the CLI."
sidebar:
  order: 5
---

The CLI is a thin wrapper around an HTTP API. You can call it directly from any language, or with `curl` in places where installing Node isn't practical. All routes are under `/v1` on your server, e.g. `https://app.rply.sh/v1`.

## Authentication

Agents authenticate with their agent token as a bearer token:

```sh
-H "Authorization: Bearer rply_a_…"
```

The token determines the channel, so agent routes don't need a channel id. Get a token with `rply init` or `rply join`; it's stored in the CLI's [config file](/docs/reference/cli-config/#config-file).

## Send a message

```sh
curl -X POST https://app.rply.sh/v1/messages \
  -H "Authorization: Bearer $RPLY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":{"text":"Build #482 passed"}}'
```

```json
{"message":{"id":"fztfqpexn1956jpa","sender":"agent","created_at":1791843427399,"body":{"text":"Build #482 passed"}, …}}
```

The body takes `text`, `title` and `blocks`. Add `"silent": true` next to `body` to skip the push notification.

## Ask a question and wait for the answer

A message with [input blocks](/docs/reference/blocks/#input-blocks) is a question:

```sh
curl -X POST https://app.rply.sh/v1/messages \
  -H "Authorization: Bearer $RPLY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":{"text":"Deploy?","blocks":[{"type":"choice","id":"answer","options":[{"label":"Deploy"},{"label":"Cancel"}]}]}}'
```

Then wait for it with a long-poll, using the id from the response:

```sh
curl "https://app.rply.sh/v1/asks/<id>?wait=55" -H "Authorization: Bearer $RPLY_TOKEN"
```

The response is `{ message, answer }`. The question's state is in `message.ask.status`: `open`, `answered`, `expired` or `cancelled`. While it's still `open`, call again.

## Long-polling

Routes that take `wait` hold the request open for up to that many seconds and answer as soon as something changes. If nothing changes, they answer empty, and you ask again. Keep `wait` at 55 or below so proxies don't cut the connection.

## Read messages from the person

```sh
curl "https://app.rply.sh/v1/messages?sender=human&since=0&wait=55" \
  -H "Authorization: Bearer $RPLY_TOKEN"
```

The response is `{ messages, cursor }`. Pass `cursor` as `since` on the next call. Reading as the agent marks the messages as seen; add `peek=1` to avoid that.

## Endpoints for agents

| Method and path | Description |
| --- | --- |
| `POST /v1/messages` | Send a message or ask a question. |
| `GET /v1/messages?since=&wait=&sender=&peek=1` | Read messages, optionally waiting. |
| `PATCH /v1/messages/:id` | Edit a message: `title`, `text`, `blocks`, or `block_patches` merged by block id. |
| `PUT /v1/messages/:id` | Replace a message's body. |
| `DELETE /v1/messages/:id` | Delete a message. |
| `POST /v1/messages/:id/state` | Acknowledge a message from the person: `{ "state": "seen" \| "working" \| "done" }`. |
| `POST /v1/messages/:id/cancel` | Cancel a question. |
| `GET /v1/asks` | List open questions. |
| `GET /v1/asks/:id?wait=` | Wait for a question's answer. |
| `GET /v1/pins` | List pinned messages. |
| `PUT /v1/pins/:key` | Create or replace a pin. |
| `PATCH /v1/pins/:key` | Update a pin. |
| `DELETE /v1/pins/:key` | Remove a pin. |
| `POST /v1/files?name=` | Upload a file as the raw request body, with its `Content-Type`. Returns `{ file_id, name, mime, size }`. |
| `GET /v1/files/:id` | Download a file. |
| `GET /v1/channel` | The channel's details. |
| `PATCH /v1/agent` | Rename this agent: `{ "label": "…" }`. |

Secret requests also go through the API, but decrypting them requires the CLI's key handling; use `rply secret request`.

## Other endpoints

| Method and path | Description |
| --- | --- |
| `GET /health` | `{ "ok": true }` when the server is up. |
| `GET /v1/info` | Public server info: whether it needs setup, registration mode, and which features (files, push, passkeys, email) are on. |

## Errors and limits

Errors return a JSON body with an `error` message and a matching status code: `400` for invalid input, `401` for a missing or revoked token, `404` for unknown ids, `409` when a question was already answered, and `429` when a rate limit is hit (120 writes a minute per channel).
