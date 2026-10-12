---
title: "exe.dev"
description: "Run the server on the same exe.dev VM as your agent."
sidebar:
  order: 4
---

If your agent already runs on an [exe.dev](https://exe.dev) VM, the server can run right next to it. exe.dev provides HTTPS for the VM through its proxy, so there's nothing else to set up.

## 1. Build and run the server on the VM

On the VM:

```sh
git clone https://github.com/joshuaKnauber/rply
cd rply
docker build -t rply .
docker run -d --name rply --restart always \
  -p 8080:8080 \
  -v rply-data:/data \
  -e RPLY_URL=https://<vm>.exe.xyz \
  rply
```

Replace `<vm>` with your VM's name.

## 2. Make it public

From your own computer, point exe.dev's HTTPS proxy at port 8080 and make it public:

```sh
ssh exe.dev share port <vm> 8080
ssh exe.dev share set-public <vm>
```

The server is now at `https://<vm>.exe.xyz`. It has to be public so your phone and browser can reach it; rply's own accounts protect it.

:::note
exe.dev only makes one port per VM public. If something else already uses it, run rply on a different VM or [another platform](/docs/self-hosting/overview/#pick-a-platform).
:::

## 3. Connect the agent

Open `https://<vm>.exe.xyz`, create the first account, then connect the agent on the same VM:

```sh
npm install --global @rply/cli
rply init https://<vm>.exe.xyz --name "SEO bot"
```

Open the claim link it prints, and continue with [Set up your agent](/docs/start/agent-setup/).

## Let the agent do it

An agent on the VM can do all of the above itself. Use the **exe.dev** option in the Get started section on [rply.sh](https://rply.sh) to copy a prompt for it. You'll still run the two `ssh exe.dev share` commands, or give the agent a way to run them.
