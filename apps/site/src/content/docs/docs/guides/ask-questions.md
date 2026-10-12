---
title: "Ask questions"
description: "Ask for a decision and wait for the answer."
sidebar:
  order: 2
---

Use `rply ask` when a decision belongs to the person, not the agent. With `--wait`, the command blocks until they answer and prints the answer, so the agent can continue with it.

## Offer choices

```sh
rply ask "Publish the 5 new pages to acme.dev?" --choices "Publish,Not yet" --wait
```

![A question with Publish and Not yet buttons](../../../../assets/docs/question.png)

When they tap a button, the command prints the label and exits:

```
Publish
```

Use it in a script like any other command:

```sh
if [ "$(rply ask "Deploy to production?" --choices Deploy,Skip --wait)" = "Deploy" ]; then
  ./deploy.sh
fi
```

Options for choices:

| Option | Effect |
| --- | --- |
| `--multi` | Allow picking several. The answer is a JSON array. |
| `--other` | Allow a typed answer besides the choices. |
| `--danger` | Style the choices as destructive. |
| `--title <title>` | Bold title above the question. |

## Ask for a confirmation

For a single destructive action, use one confirm button:

```sh
rply ask "Delete the 40 snapshots older than 90 days to free up 31 GB?" \
  --confirm "Delete 40 snapshots" --danger --wait
```

![A question with a red Delete 40 snapshots button](../../../../assets/docs/confirm.png)

## Ask for free text

Without `--choices`, `--confirm` or input blocks, the person gets a text field:

```sh
rply ask "What should the new landing page headline say?" --wait
```

## Ask several things at once

Send a form with `--form`. Each field has a `name`, which keys the answer:

```sh
rply ask "New page details" --wait --form '[
  {"name":"title","label":"Title","required":true},
  {"name":"tone","label":"Tone","type":"select","options":["Formal","Casual"]},
  {"name":"notes","label":"Notes","type":"textarea"}
]'
```

Field types are `text` (the default), `textarea`, `number`, `select` and `toggle`. Several questions print a JSON object:

```json
{"title":"Teams pricing","tone":"Casual","notes":"Mention the annual discount"}
```

For full control over the inputs, pass [input blocks](/docs/reference/blocks/#input-blocks) with `--blocks` instead.

## Set a deadline and a default

A question can expire, and it can fall back to a default when it does:

```sh
rply ask "Which tone?" --choices Formal,Casual --default Casual --expires 2h --wait
```

- `--expires 2h` stops accepting answers after two hours.
- `--default Casual` is the answer used if it expires. Without a default, an expired question exits with code 2.
- `--timeout 30m` stops waiting after 30 minutes. When you wait, the question also expires then, unless you set `--expires`.

Durations look like `30s`, `10m`, `2h` or `1d`.

## Ask now, wait later

Without `--wait`, `rply ask` prints the question's id and returns immediately:

```
Asked (id: 9tkppbb8nh0jayn2). Get the answer with: rply wait 9tkppbb8nh0jayn2
```

Do other work, then collect the answer:

```sh
rply wait 9tkppbb8nh0jayn2 --timeout 1h
```

List questions that are still open with `rply asks`, and withdraw one with `rply cancel <id>`.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Answered (or the default was used) |
| `2` | Expired without a default, or `--timeout` ran out |
| `3` | Cancelled |

:::note
The first answer wins. Once a question is answered, it can't be answered again, from any device. Long waits survive network drops and server restarts: the CLI keeps reconnecting until it gets an answer or times out.
:::
