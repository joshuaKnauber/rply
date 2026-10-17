import { hostedPrompt } from "../setup.ts";
import { icon } from "../icons.ts";
import { chirp, mountBirds, setMood, type BirdState } from "../agent-bird.ts";
import { AGENT, agentMessage, bird, choiceButton, el, esc, humanMessage, previewApp, screenshot, statsApp, toggleRow, type Site } from "./views.ts";

class Stale extends Error {}

export function mountDemo() {
  const stage = document.querySelector<HTMLElement>(".stage");
  const root = document.querySelector<HTMLElement>(".demo");
  if (!stage || !root) return;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string, parent: ParentNode = root) => parent.querySelector<T>(selector)!;
  const log = $(".agent-log");
  const input = $(".agent-input");
  const sidebar = $(".demo-sidebar");
  const main = $(".demo-main");
  const toasts = $(".demo-toasts");
  const end = $(".demo-end");

  let run = 0;

  let site: Site;
  let channel: boolean;
  let apps: { key: string; title: string }[];
  let view: string;
  let clock: number;
  let lastPreview: string;
  let claimLink: HTMLElement;
  let previewUrl: string;
  let tunnel: string;
  let onSend: ((text: string) => void) | null;
  let waiters: Map<string, () => void>;
  let navBird: HTMLElement;
  let agentMood: BirdState;

  const mood = (next: BirdState) => {
    agentMood = next;
    setMood(AGENT, next);
  };

  const wait = async (ms: number) => {
    const token = run;
    await new Promise((resolve) => setTimeout(resolve, ms));
    if (token !== run) throw new Stale();
  };

  const interact = async <T>(targets: HTMLElement[], bind: (done: (value: T) => void) => void) => {
    const token = run;
    targets.forEach((t) => t.classList.add("demo-target"));
    const value = await new Promise<T>(bind);
    targets.forEach((t) => t.classList.remove("demo-target"));
    if (token !== run) throw new Stale();
    return value;
  };

  const line = (html: string) => {
    const node = el(`<div class="log-in">${html}</div>`);
    log.append(node);
    log.scrollTop = log.scrollHeight;
    return node;
  };
  const you = (text: string) => line(`<div class="rounded-lg bg-white/[0.06] px-3 py-2 whitespace-pre-wrap text-gray-200"><span class="text-gray-500">&gt; </span>${esc(text)}</div>`);
  const say = async (text: string) => (await wait(500), line(`<p class="pt-1 text-gray-100"><span class="text-brand-300">● </span>${text}</p>`));
  const cmd = async (text: string) => (await wait(550), line(`<p class="text-gray-300"><span class="text-gray-500">$ </span>${esc(text)}</p>`));
  const out = async (text: string) => (await wait(650), line(`<p class="whitespace-pre-wrap text-gray-500">${esc(text)}</p>`));
  const note = (text: string) => line(`<p class="flex items-center gap-1.5 pt-1 text-[11px] text-brand-300">${bird("size-3")} ${text}</p>`);

  const status = (text: string, busy = false) => {
    if (agentMood !== "done") mood(busy ? "working" : "idle");
    input.innerHTML = `<p class="flex items-center gap-2"><span class="size-1.5 rounded-full ${busy ? "animate-pulse bg-brand-300" : "bg-gray-600"}"></span>${text}</p>`;
  };

  const toast = (title: string, text: string, onClick?: () => void) => {
    const node = el(`
      <button type="button" class="msg-in pointer-events-auto flex gap-2.5 rounded-2xl bg-white/95 p-3 text-left text-[13px] shadow-[0_8px_24px_rgb(0_0_0/0.15)] ring-1 ring-black/5 backdrop-blur">
        <span class="grid size-8 flex-none place-items-center rounded-lg border border-brand-600 bg-linear-to-b from-brand-400 to-brand-500 text-white">${bird("size-4")}</span>
        <span class="min-w-0 leading-snug"><span class="flex justify-between font-semibold text-gray-900">${title}<span class="font-normal text-gray-500">now</span></span><span class="block text-gray-700">${text}</span></span>
      </button>`);
    node.onclick = () => (node.remove(), onClick?.());
    toasts.append(node);
    setTimeout(() => node.remove(), 4500);
  };

  const time = () => `9:${clock++}`;
  const thread = () => $(".thread", main);

  const agentMsg = (content: string) => {
    const node = el(agentMessage(content, time()));
    thread().append(node);
    mountBirds(node);
    chirp(AGENT);
    thread().scrollTop = thread().scrollHeight;
    lastPreview = node.textContent!.replace(/\s+/g, " ").replace(/^ ?claude \d+:\d+ /, "");
    renderNav();
    return node;
  };

  const humanMsg = (text: string) => {
    const node = el(humanMessage(text));
    thread().append(node);
    thread().scrollTop = thread().scrollHeight;
    return (state: string) => ($(".msg-state", node).textContent = state);
  };

  const show = (name: string) => main.querySelectorAll<HTMLElement>("[data-view]").forEach((v) => (v.hidden = v.dataset.view !== name));

  const renderNav = () => {
    const items = [{ key: "chat", title: "Acme site" }, ...apps];
    sidebar.innerHTML = !channel
      ? `<p class="px-4 py-2 text-gray-500">No channels yet</p>`
      : `<p class="px-4 pb-2 text-gray-500">1 channel</p>` +
        items
          .map((item) =>
            item.key === "chat"
              ? `<button type="button" data-nav="chat" class="flex items-center gap-2.5 px-4 py-2.5 text-left aria-current:bg-gray-150"><span data-slot="nav-bird" class="size-[30px] flex-none"></span><span class="min-w-0"><span class="block font-medium text-gray-900">Acme site</span><span class="block truncate text-gray-500">${esc(lastPreview)}</span></span></button>`
              : `<button type="button" data-nav="${item.key}" class="flex items-center gap-2 py-2 pr-4 pl-[56px] text-left text-gray-600 aria-current:bg-gray-150 aria-current:text-gray-900">${icon("app", "size-3.5")} ${item.title}</button>`,
          )
          .join("");
    sidebar.querySelector("[data-slot=nav-bird]")?.replaceWith(navBird);
    mountBirds(navBird);
    const tabs = $(".demo-tabs", main);
    tabs.hidden = !channel || apps.length === 0;
    tabs.innerHTML = items
      .map((item) => `<button type="button" data-nav="${item.key}" class="flex-none rounded-full px-3 py-1 text-[13px] text-gray-600 aria-current:bg-gray-900 aria-current:text-white">${item.key === "chat" ? "Chat" : item.title}</button>`)
      .join("");
    root.querySelectorAll<HTMLElement>("[data-nav]").forEach((b) => {
      if (b.dataset.nav === view) b.setAttribute("aria-current", "true");
      if (waiters.has(b.dataset.nav!)) b.classList.add("demo-target");
      b.onclick = () => open(b.dataset.nav!);
    });
  };

  const open = (key: string) => {
    if (!channel) return;
    view = key;
    toasts.innerHTML = "";
    if (key === "chat") show("chat");
    else renderApp(key);
    waiters.get(key)?.();
    waiters.delete(key);
    renderNav();
  };

  const opened = async (key: string) => {
    if (view === key) return;
    await interact<void>([...root.querySelectorAll<HTMLElement>(`[data-nav="${key}"]`)], (done) => waiters.set(key, done));
    if (view !== key) open(key);
  };

  const renderApp = (key: string) => {
    const app = apps.find((a) => a.key === key)!;
    const pane = $("[data-view=app]", main);
    pane.innerHTML = `
      <div class="flex h-12 flex-none items-center gap-1.5 border-b border-gray-200 px-5 text-[15px]">
        <button type="button" data-nav="chat" class="text-gray-500 hover:text-gray-900">Acme site</button>
        <span class="text-gray-400">/</span><span class="font-medium text-gray-900">${app.title}</span>
        ${key === "preview" ? `<span class="ml-auto flex gap-3 text-gray-500"><button type="button" class="preview-reload" aria-label="Reload">${icon("rotate")}</button>${icon("external")}</span>` : ""}
      </div>
      ${key === "stats" ? statsApp() : previewApp(previewUrl, site)}`;
    show("app");
    if (key === "stats") {
      note(`rply serve ran "stats" for the app`);
      $(".stats-refresh", pane).onclick = refreshStats;
    } else wirePreview(pane);
  };

  let signups = 668;
  const refreshStats = () => {
    signups += 3 + Math.floor(Math.random() * 6);
    const visitors = 12480 + (signups - 668) * 14;
    $(".stats-signups", main).textContent = signups.toLocaleString("en");
    $(".stats-visitors", main).textContent = visitors.toLocaleString("en");
    $(".stats-conv", main).textContent = `${((signups / visitors) * 100).toFixed(1)}%`;
    $(".stats-time", main).textContent = "just now";
    note(`rply serve ran "stats" for the app`);
  };

  const wirePreview = (pane: HTMLElement) => {
    const stageEl = $(".preview-stage", pane);
    pane.querySelectorAll<HTMLElement>("[data-device]").forEach((b) => {
      b.onclick = () => {
        stageEl.dataset.device = b.dataset.device;
        pane.querySelectorAll("[data-device]").forEach((d) => d.setAttribute("aria-pressed", String(d === b)));
      };
    });
    const billing = pane.querySelector<HTMLElement>(".site-billing");
    if (billing) billing.onclick = () => $(".site", pane).classList.toggle("yearly");
    $(".preview-reload", pane).onclick = () => {
      const frame = $(".preview-frame", pane);
      frame.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 400 });
    };
  };

  const addApp = (key: string, title: string) => {
    apps = [...apps, { key, title }];
    renderNav();
  };

  const composerSend = async (text: string) => {
    const form = $<HTMLFormElement>(".composer", main);
    const field = $<HTMLInputElement>("input", form);
    const button = $<HTMLButtonElement>("button", form);
    field.readOnly = false;
    field.value = text;
    button.disabled = false;
    const value = await interact<string>([form], (done) => (onSend = done));
    onSend = null;
    field.value = "";
    field.readOnly = true;
    button.disabled = true;
    return value;
  };

  const answered = (className = "") => el(`<p class="flex items-center gap-1.5 text-xs text-gray-500 ${className}">${icon("check", "size-3.5")} Answered</p>`);

  const setupQuestions = async () => {
    const node = agentMsg(`
      <p>Before I build it, two quick decisions:</p>
      <div class="q-card mt-3 max-w-sm space-y-3 rounded-xl border border-gray-200 p-3">
        <div>
          <p class="mb-1.5 text-xs font-medium text-gray-500">Which plans?</p>
          <div class="space-y-1.5">${choiceButton("2", "Free + Pro")}${choiceButton("3", "Free, Pro + Team", "Team adds SSO and unlimited projects")}</div>
        </div>
        ${toggleRow("annual", "Monthly / annual switch")}
        <button type="button" class="q-send btn btn-primary h-8 w-full justify-center disabled:opacity-50" disabled>Send answers</button>
      </div>`);
    const choices = [...node.querySelectorAll<HTMLButtonElement>("[data-choice]")];
    const toggle = $<HTMLButtonElement>("[data-toggle]", node);
    const send = $<HTMLButtonElement>(".q-send", node);
    let plans: 2 | 3 = 3;
    choices.forEach((b) => {
      b.onclick = () => {
        choices.forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
        plans = Number(b.dataset.choice) as 2 | 3;
        send.disabled = false;
      };
    });
    toggle.onclick = () => toggle.setAttribute("aria-pressed", String(toggle.getAttribute("aria-pressed") !== "true"));
    mood("waiting");
    const value = await interact<{ plans: 2 | 3; annual: boolean }>([$(".q-card", node)], (done) => (send.onclick = () => done({ plans, annual: toggle.getAttribute("aria-pressed") === "true" })));
    choices.forEach((c) => (c.setAttribute("aria-pressed", String(Number(c.dataset.choice) === value.plans)), (c.disabled = true)));
    toggle.setAttribute("aria-pressed", String(value.annual));
    toggle.disabled = true;
    send.replaceWith(answered());
    mood("working");
    return value;
  };

  const heroQuestion = async () => {
    const node = agentMsg(`
      <p>Which hero do you prefer?</p>
      <div class="q-picks mt-2 flex flex-wrap gap-2">
        ${(["a", "b"] as const).map((h) => `<button type="button" data-pick="${h}" class="rounded-xl p-1 hover:bg-gray-100 aria-pressed:ring-2 aria-pressed:ring-brand-500">${screenshot({ ...site, hero: h }, 180, h.toUpperCase())}</button>`).join("")}
      </div>`);
    const picks = [...node.querySelectorAll<HTMLButtonElement>("[data-pick]")];
    mood("waiting");
    const value = await interact<"a" | "b">(picks, (done) => picks.forEach((b) => (b.onclick = () => done(b.dataset.pick as "a" | "b"))));
    picks.forEach((b) => (b.setAttribute("aria-pressed", String(b.dataset.pick === value)), (b.disabled = true), b.dataset.pick !== value && b.classList.add("opacity-50")));
    node.append(answered("mt-3"));
    mood("working");
    return value;
  };

  const shareQuestion = async () => {
    const node = agentMsg(`
      <p>How should I share the dev server with you?</p>
      <div class="mt-2 max-w-sm space-y-1.5">
        ${choiceButton("OpenTunnel", "OpenTunnel (recommended)", "No account, and the link can't be guessed")}
        ${choiceButton("Tailscale", "Tailscale", "Private to your devices, they need Tailscale")}
      </div>`);
    const choices = [...node.querySelectorAll<HTMLButtonElement>("[data-choice]")];
    const targets = view === "chat" ? choices : [...choices, ...root.querySelectorAll<HTMLElement>('[data-nav="chat"]')];
    mood("waiting");
    const value = await interact<string>(targets, (done) => choices.forEach((b) => (b.onclick = () => done(b.dataset.choice!))));
    choices.forEach((c) => (c.setAttribute("aria-pressed", String(c.dataset.choice === value)), (c.disabled = true)));
    node.append(answered("mt-3"));
    mood("working");
    return value;
  };

  const steps: (() => Promise<void>)[] = [
    async () => {
      input.innerHTML = `
        <p class="mb-2 hidden text-gray-500 lg:block">Paste into your agent</p>
        <div class="max-h-9 overflow-y-auto whitespace-pre-wrap text-gray-200 lg:max-h-24">${esc(hostedPrompt)}</div>
        <div class="mt-2 flex justify-end"><button type="button" class="agent-send btn btn-primary h-7 px-3 text-xs">Send</button></div>`;
      const send = $(".agent-send", input);
      await interact<void>([send], (done) => (send.onclick = () => done()));
      status("Working", true);
      you(hostedPrompt);
      await say("I'll install the rply CLI and create a channel for us.");
      await cmd("npm install --global @rply/cli");
      await out("added 1 package in 2s");
      await cmd('rply init https://app.rply.sh --name "Acme site"');
      await out('Created channel "Acme site" on https://app.rply.sh');
      claimLink = line(`<a href="#" class="text-brand-300 underline underline-offset-2">https://app.rply.sh/claim?c=K7QX-M2PD</a>`);
      $("a", claimLink).onclick = (e) => e.preventDefault();
      await say("Open the claim link and sign in. I'll wait.");
      status("Waiting for you to open the link");
      mood("waiting");
    },
    async () => {
      const link = $("a", claimLink);
      await interact<void>([link], (done) => (link.onclick = (e) => (e.preventDefault(), done())));
      root.classList.add("with-browser");
      show("claim");
      await wait(700);
      const add = $(".claim-add", main);
      await interact<void>([add], (done) => (add.onclick = () => done()));
      channel = true;
      open("chat");
      note("Channel claimed");
      status("Working", true);
      await say("Claimed. Now I'll make sure your messages can wake me up.");
      await cmd(`rply serve --install --on-message "claude -p 'Handle your rply inbox'"`);
      await out("Installed service rply-acme-site, it starts on login");
      await cmd('rply send "Setup done. Message me here any time."');
      await wait(300);
      agentMsg("Setup done. Message me here any time, your messages wake me up.");
      toast("Acme site", "Setup done. Message me here any time.");
      status("Asleep. rply wakes me when you write.");
    },
    async () => {
      await opened("chat");
      const text = await composerSend("Add a pricing page for the launch");
      const state = humanMsg(text);
      await wait(400);
      note("New message, rply woke the agent");
      status("Working", true);
      await cmd("rply inbox");
      await out(`you: ${text}`);
      state("Seen");
      await say("Two of the decisions are yours, so I'll ask before building.");
      await cmd("rply ask --blocks questions.json --wait");
      await wait(300);
      const answers = await setupQuestions();
      await out(JSON.stringify(answers));
      site = { ...site, ...answers };
      await cmd("rply ack 7hq1 working");
      state("Working on it");
    },
    async () => {
      await say("Building the page. I'll show you two takes on the hero.");
      await cmd("npm run dev");
      await out("Local: http://localhost:5173");
      await cmd("npx playwright screenshot localhost:5173/pricing a.png");
      await cmd("npx playwright screenshot localhost:5173/pricing?hero=b b.png");
      await cmd('rply ask "Which hero do you prefer?" --image a.png --image b.png --choices A,B --wait');
      await wait(300);
      const hero = await heroQuestion();
      await out(hero.toUpperCase());
      site = { ...site, hero };
      await say(`Going with ${hero.toUpperCase()} and tightening the spacing.`);
      await cmd('rply send "Here it is with your answers" --image pricing.png');
      await wait(300);
      agentMsg(
        `<p>Here's ${hero.toUpperCase()} with ${site.plans === 3 ? "all three plans" : "Free and Pro"}${site.annual ? " and the annual switch" : ""}.</p><div class="mt-2 max-w-full overflow-hidden">${screenshot(site, 320)}</div>`,
      );
    },
    async () => {
      await say("You'll want numbers on launch day. I'll add a dashboard.");
      await cmd('rply app set stats stats.html --title "Launch stats"');
      await out('App "stats" created');
      addApp("stats", "Launch stats");
      agentMsg("I added <b>Launch stats</b> next to the chat. It runs a script on my machine for fresh numbers whenever you open it.");
      status("Serving apps. rply wakes me when you write.");
      await opened("stats");
    },
    async () => {
      status("Working", true);
      await say("Screenshots only go so far. I'll ask how to share the dev server.");
      await cmd('rply ask "How should I share the dev server?" --choices OpenTunnel,Tailscale --wait');
      await wait(300);
      toast("Acme site", "How should I share the dev server with you?", () => open("chat"));
      tunnel = await shareQuestion();
      await out(tunnel);
      previewUrl = tunnel === "OpenTunnel" ? "https://3f9c1a7e2b5d4e60.k2m4.opentunnel.xyz" : "https://mac-mini.tail3e5f.ts.net";
      await cmd(tunnel === "OpenTunnel" ? "opentunnel route add 5173" : "tailscale serve --bg 5173");
      await out(previewUrl);
      await cmd(`rply app set preview ${previewUrl} --title "Pricing preview"`);
      await out('App "preview" created');
      addApp("preview", "Pricing preview");
      agentMsg("The dev server is up as <b>Pricing preview</b>. Try the annual switch, and check it at phone size.");
      status("Serving apps. rply wakes me when you write.");
      await opened("preview");
    },
    async () => {
      await opened("chat");
      const text = await composerSend("Looks great, ship it");
      const state = humanMsg(text);
      await wait(400);
      note("New message, rply woke the agent");
      status("Working", true);
      await cmd("rply inbox");
      await out(`you: ${text}`);
      state("Working on it");
      await say("Shipping it and cleaning up.");
      await cmd("git push origin main");
      await out("main -> main, deploy started");
      await cmd(tunnel === "OpenTunnel" ? "opentunnel route remove 5173" : "tailscale serve --https=443 off");
      await cmd("rply app remove preview");
      apps = apps.filter((a) => a.key !== "preview");
      renderNav();
      await cmd("rply ack 9fk2 done");
      state("Done");
      mood("done");
      await wait(300);
      agentMsg("Shipped. acme.dev/pricing is live and the preview is down.");
      toast("Acme site", "Shipped. acme.dev/pricing is live.");
      status("Asleep. rply wakes me when you write.");
      await wait(1600);
    },
  ];

  const reset = () => {
    root.classList.remove("with-browser");
    log.innerHTML = "";
    toasts.innerHTML = "";
    end.classList.remove("show");
    site = { hero: "b", plans: 3, annual: true };
    channel = false;
    apps = [];
    view = "chat";
    clock = 40;
    lastPreview = "";
    previewUrl = "";
    tunnel = "OpenTunnel";
    onSend = null;
    waiters = new Map();
    signups = 668;
    navBird = el(`<span class="flex-none [--avatar-ring:var(--color-gray-150)]"><span data-bird="${AGENT}" data-size="30" class="block size-[30px]"></span></span>`);
    mood("idle");
    main.innerHTML = `
      <div class="demo-tabs flex flex-none gap-1 overflow-x-auto border-b border-gray-200 px-3 py-2 lg:hidden" hidden></div>
      <div data-view="empty" class="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p class="font-medium text-gray-900">No channels yet</p>
        <p class="mt-1 text-gray-500">Create one here, or claim one your agent made.</p>
      </div>
      <div data-view="claim" class="flex flex-1 items-center justify-center p-6" hidden>
        <div class="msg-in w-full max-w-xs rounded-2xl border border-gray-200 p-5 text-center shadow-[0_10px_30px_-16px_rgb(0_0_0/0.2)]">
          <span data-bird="${AGENT}" data-size="48" class="mx-auto block size-12"></span>
          <p class="mt-3 font-medium text-gray-900">Add "Acme site"?</p>
          <p class="mt-1 text-gray-500">An agent on acme-vm created this channel and wants to reach you.</p>
          <button type="button" class="claim-add btn btn-primary mt-4 h-9 w-full justify-center">Add channel</button>
        </div>
      </div>
      <div data-view="chat" class="flex min-h-0 flex-1 flex-col" hidden>
        <div class="hidden h-12 flex-none items-center gap-2 border-b border-gray-200 px-5 lg:flex">
          <span class="text-[15px] font-medium text-gray-900">Acme site</span>
          <span class="flex items-center gap-1.5 text-xs text-gray-500"><span data-bird="${AGENT}" data-size="20" class="size-5 flex-none"></span>claude</span>
        </div>
        <div class="thread flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-3 pb-2 sm:px-6"><div class="flex-1"></div></div>
        <form class="composer mx-4 mb-4 flex flex-none items-center gap-2 rounded-xl bg-gray-100 py-2 pr-2 pl-3.5 sm:mx-6">
          <input class="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" placeholder="Message Acme site" readonly />
          <button class="grid size-7 flex-none place-items-center rounded-lg bg-gray-900 text-white disabled:bg-gray-300" aria-label="Send" disabled>${icon("arrow-up", "size-4")}</button>
        </form>
      </div>
      <div data-view="app" class="flex min-h-0 flex-1 flex-col" hidden></div>`;
    mountBirds(main);
    $<HTMLFormElement>(".composer", main).onsubmit = (e) => {
      e.preventDefault();
      const value = $<HTMLInputElement>(".composer input", main).value.trim();
      if (value) onSend?.(value);
    };
    renderNav();
  };

  async function play() {
    const token = ++run;
    reset();
    try {
      for (const step of steps) await step();
      if (token === run) end.classList.add("show");
    } catch (err) {
      if (!(err instanceof Stale)) throw err;
    }
  }

  $(".demo-replay").onclick = () => play();

  const transition = (update: () => void) => {
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return update();
    document.startViewTransition(update);
  };

  const openDemo = () => {
    stage.style.viewTransitionName = "demo";
    transition(() => {
      stage.style.viewTransitionName = "";
      root.style.viewTransitionName = "demo";
      root.classList.add("open");
      document.documentElement.style.overflow = "hidden";
      play();
    });
  };

  const closeDemo = () => {
    run++;
    transition(() => {
      root.style.viewTransitionName = "";
      root.classList.remove("open");
      stage.style.viewTransitionName = "demo";
      document.documentElement.style.overflow = "";
    });
    setTimeout(() => (stage.style.viewTransitionName = ""), 700);
  };

  document.querySelectorAll<HTMLElement>(".demo-open").forEach((b) => (b.onclick = openDemo));
  $(".demo-close").onclick = closeDemo;
  addEventListener("keydown", (e) => e.key === "Escape" && root.classList.contains("open") && closeDemo());
}
