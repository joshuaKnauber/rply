---
title: "HTML embeds and apps"
description: "The rply bridge available inside HTML blocks and apps."
sidebar:
  order: 4
---

HTML runs in two places: `html` [blocks](/docs/reference/blocks/#html) inside a message, and [apps](/docs/guides/apps/), which are full-page views under a channel. Both run your HTML in a sandboxed frame and give it the same `rply` object.

```sh
rply send "Traffic this week" --blocks '[{"type":"html","label":"Traffic","html":"<div id=chart></div><script>…</script>"}]'
rply app set dashboard dashboard.html --title Dashboard
```

The HTML can be a fragment or a full document; the outer `<!doctype>` and `<html>` tags are dropped.

## The sandbox

- The frame can run scripts, but it can't read the app, its storage, or the person's session.
- `localStorage` and cookies aren't available. Use `rply.storage` instead.
- Links to `http(s)` addresses open in a new tab (on a phone, in the browser), never inside the frame.
- Embeds grow to fit their content. Set `height` on the block to fix it instead. Apps fill the page.

## The `rply` object

### `rply.send(value, label?)`

Sends an event to the agent, any number of times, for example when someone clicks a bar in a chart. It arrives in `rply inbox`:

```
event "Show Tuesday" from chart in message pweehax515jh7zv2: {"day":"tue"}
```

The app shows it as a short "Sent: Show Tuesday" line. Events never answer a question.

### `rply.reply(value)`

Answers the question, when the block is marked `"question": true` and has an `id`. Like any question, only the first answer counts.

```json
{"type":"html","id":"pick","question":true,"html":"<button onclick=\"rply.reply('blue')\">Blue</button>"}
```

### `rply.call(name, args)` → `Promise`

Runs the command script `name` on the agent's machine with `args` as JSON, and resolves with its output. Requires `rply serve` to be running. See [Build an app](/docs/guides/apps/#3-add-command-scripts).

```js
const stats = await rply.call("stats", { range: "7d" });
```

### `rply.agent(name, args)` → `Promise`

Asks the agent itself, and resolves with its answer from `rply respond`. Every call becomes a message, so don't use it for polling.

Both `call` and `agent` reject with an `Error` whose message is `offline` (no `rply serve` running), `timeout`, or the error the script or agent reported.

### `rply.storage`

Small values per person and app, synced across their devices. Both methods are synchronous; values are saved in the background.

```js
const tab = rply.storage.get("tab") ?? "week";
rply.storage.set("tab", "month");
```

Values must be JSON. Each app or message can store up to 256 KB.

### `rply.theme`

`"light"` or `"dark"`, following the app's theme rather than the system's.

## Styling

Buttons, inputs, links and tables get default styles that match the app. The page background is transparent. Use these CSS variables, so your HTML works in both themes, instead of hard-coding colors:

| Variable | Use |
| --- | --- |
| `--rply-fg` | Text |
| `--rply-muted` | Secondary text |
| `--rply-border` | Borders and dividers |
| `--rply-surface` | Tinted backgrounds, e.g. buttons |
| `--rply-bg` | The app's background, e.g. for sticky headers |
| `--rply-accent` | Links and highlights |
| `--rply-success`, `--rply-warning`, `--rply-danger` | Status colors |

The theme is set as `data-theme="light"` or `"dark"` on `<html>`. It can change while the page is open; the window then receives a `rply:theme` event. Redraw anything that read colors once, like a canvas chart:

```js
addEventListener("rply:theme", () => drawChart());
```

## Errors

Uncaught errors and rejected promises show the person a banner: "This app hit an error: …". They can click **Send to agent**, which sends an event to the agent with the value `{ "error": "…" }`.
