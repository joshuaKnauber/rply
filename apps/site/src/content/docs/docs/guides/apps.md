---
title: "Build an app"
description: "Give your agent a dashboard or control panel with buttons that run scripts on its machine."
sidebar:
  order: 7
---

An app is a full-page HTML view that lives under a channel, next to the chat. Use it for dashboards and control panels: a ranking chart that loads fresh data, a button that re-runs an audit, a list of jobs you can pause. It replaces the small website an agent would otherwise have to host.

![An app called Rankings with a bar chart, a Re-run audit button and a table of pages](../../../../assets/docs/app.png)

## 1. Write the page

An app is a single HTML file. Use the CSS variables the app provides so it looks right in light and dark mode:

```html title="rankings.html"
<style>
  body { font: 14px system-ui, sans-serif; color: var(--rply-fg); padding: 24px; }
  .muted { color: var(--rply-muted); }
</style>
<h1>Rankings</h1>
<p class="muted" id="summary">Loading…</p>
<button id="audit">Re-run audit</button>
<script>
  rply.call("stats", { range: "7d" })
    .then((stats) => (summary.textContent = `${stats.clicks} clicks this week`))
    .catch((e) => (summary.textContent = e.message));

  audit.onclick = async () => {
    audit.disabled = true;
    try { await rply.call("audit", {}); } finally { audit.disabled = false; }
  };
</script>
```

Fetch data with `rply.call` when the page loads instead of baking it into the HTML. Then the page stays current without being uploaded again.

## 2. Publish it

```sh
rply app set rankings rankings.html --title Rankings
```

The app appears under the channel in the sidebar. `rply app set` checks that the page's inline scripts parse and refuses to upload a page with syntax errors. Running it again replaces the app. List apps with `rply app list` and remove one with `rply app remove rankings`.

## 3. Add command scripts

`rply.call("stats", …)` runs a script called `stats` on the agent's machine. Scripts live in the channel's commands folder:

```sh
rply app commands
```

Each script is an executable named after the command. It gets the arguments as JSON on stdin and prints its result to stdout, as JSON or plain text:

```sh title="~/.config/rply/commands/seo-bot/stats"
#!/bin/sh
printf '{"clicks": %s}' "$(./count-clicks.sh)"
```

```sh
chmod +x ~/.config/rply/commands/seo-bot/stats
```

The environment has `RPLY_CHANNEL`, `RPLY_CALL_NAME` and `RPLY_CALL_ID`. A non-zero exit fails the call with the last line of stderr. Calls time out after 30 seconds, and output is limited to 4 MB.

:::caution
The page can only name a command; it can't run arbitrary code on the machine. But it chooses the arguments, so treat them as untrusted input: validate them, and never pass them to a shell unchecked.
:::

Test a script exactly the way the app will run it:

```sh
rply app call stats '{"range":"7d"}'
```

## 4. Run `rply serve`

Scripts only run while `rply serve` is running for the channel. Install it as a background service, from the project directory:

```sh
rply serve --install
```

It picks up new scripts without a restart. If it's not running, `rply.call` fails with an `offline` error, which the page should show.

## Ask the agent instead of a script

Some actions need the agent itself, not a script. `rply.agent` sends the request to the agent and waits for its answer:

```js
const plan = await rply.agent("plan", { pages: 3 });
```

The call shows up in `rply inbox` with the command to answer it:

```
call "plan" from app in message 2k9d…: {"pages":3}
  answer with: rply respond 7hq1… '<json>'
```

```sh
rply respond 7hq1… '{"titles":["Pricing","Teams","FAQ"]}'
```

Report a failure with `rply respond <id> --error "Couldn't reach the CMS"`. Every `rply.agent` call becomes a message, so use it for real work, never for polling.

## Keep state in the page

`rply.storage` stores small values per person and app, synced across their devices, for example the selected tab:

```js
const tab = rply.storage.get("tab") ?? "week";
rply.storage.set("tab", "month");
```

## Show a running web app

An app can also show a page that's already running somewhere, like a dev server, so you can try it on your laptop or phone next to the chat. Give `rply app set` a URL instead of a file:

```sh
rply app set preview https://preview.example.ts.net --title Preview
```

The page loads in a frame, with buttons to reload it or open it in a new tab. Some sites refuse to be framed or need cookies that browsers block in frames; open those in a new tab.

rply doesn't run the tunnel. Your agent knows how to expose a port (`rply guide previews`) and asks you first which way you want. It suggests [OpenTunnel](https://opentunnel.xyz) by default: no account, it keeps running in the background, and the link can't be guessed, though anyone you share it with can open it. [Tailscale](https://tailscale.com/kb/1312/serve) keeps the page private to your own devices. On exe.dev the VM's own proxy works too, and cloudflared, ngrok or localtunnel are fine if you already use one.

## Reference

The full bridge, including `rply.send`, theme handling and the error banner, is in [HTML embeds and apps](/docs/reference/html/).
