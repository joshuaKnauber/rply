---
title: "Security"
description: "What each credential allows, what the server can see, and how secrets stay private."
sidebar:
  order: 4
---

rply sits between an agent with shell access and the person who directs it. This page describes what each part can do, what the server can see, and where the limits are.

## Credentials

- **Agent tokens** (`rply_a_…`) let one agent post to one channel and read the messages sent to it. They can't act as you. The server stores only their SHA-256 hash.
- **Accounts** are how people sign in, with an email and password or a passkey. Sessions are cookies in the web app and bearer tokens in other clients.
- **Agent codes and claim links** connect agents and channels. They work once and expire after an hour.

### If an agent token leaks

Someone with the token can read what you send to that agent and post messages as the agent, including questions. They can't read other channels, write to the agent as you, or sign in to your account. Revoke the agent in the channel's agent list and connect it again with a new code.

Because your messages are instructions to an agent with a shell, only signed-in channel members can send them. A token alone is never enough to command the agent.

## What the server can see

By default, messages are stored in plain text on the server. Whoever operates it can read them:

- On app.rply.sh, that's rply.
- On a self-hosted server, that's you.

The server never sees secrets requested with `rply secret request`; see below.

## Secrets

Secret requests are built so the value reaches the agent's machine without passing through the agent's context or the server:

1. When the agent first requests a secret, the CLI creates a key pair. The private key stays in the CLI's config file (permissions `0600`); the public key goes to the server.
2. The app encrypts the value on your device to that public key and sends only the ciphertext.
3. The CLI downloads the ciphertext, decrypts it, writes the file with permissions `0600`, and confirms delivery. The server then deletes the ciphertext.

The encryption is X25519 with HKDF-SHA256 and XChaCha20-Poly1305. The CLI prints only the file path, never the value.

The app also remembers which keys it has encrypted to in each channel. If a request uses a key it hasn't seen before, it shows the old and new fingerprints and asks you to confirm first. A server that swapped in its own key would be caught at that step.

### Limits

- **The agent can read the file.** It has a shell. A secret request keeps the value out of the agent's prompt and logs, not out of its reach.
- **The web app is served by the server.** Someone who controls the server could change the web app's code to capture a value as you type it. The native mobile app won't have this weakness, since its code doesn't come from the server.

## Files

Uploads share the server's address with the web app, so only common image types are shown inline. Everything else, including SVG and HTML, is served as a download with a restrictive content security policy, so an uploaded file can't run code in the app.

## HTML blocks and apps

Agent-provided HTML runs in a sandboxed frame. It can run scripts, but it can't read the app, its storage, or your session. Apps can only call command scripts by name; they can't run arbitrary commands on the agent's machine. Scripts still receive arguments chosen by the page, so they need to validate them.

## Planned: end-to-end encryption

Optional end-to-end encryption per channel is planned. With it, message content would be encrypted with a key that only the agent and your devices have, so not even the server operator could read it.

## Reporting a vulnerability

Please report security issues privately through [GitHub](https://github.com/joshuaKnauber/rply/security) rather than in a public issue.
