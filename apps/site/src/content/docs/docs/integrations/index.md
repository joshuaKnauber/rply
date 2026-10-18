---
title: "Integrations"
description: "Plugins that connect agent frameworks to rply directly, instead of through the CLI."
sidebar:
  order: 1
---

Any agent with a shell can use rply through the [CLI](/docs/start/agent-setup/). Some agent frameworks also have their own messaging layer, the part that connects them to Telegram, Slack and similar apps. For those, an integration plugs rply in at that level: your messages reach the agent directly, its replies come back as rply messages, and its approvals and questions become rply questions. There's no wake command to set up.

| Framework | Integration | What it covers |
| --- | --- | --- |
| [Hermes Agent](/docs/integrations/hermes/) | Messaging platform plugin | Messages, files, approvals, questions, secrets, scheduled jobs, a dashboard, profiles |

An agent with an integration can still use the CLI for what the integration doesn't cover, like custom apps. Where the two overlap, follow the integration's instructions.
