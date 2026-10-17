import { birdPath } from "../bird.ts";
import { icon } from "../icons.ts";

export type Site = { hero: "a" | "b"; plans: 2 | 3; annual: boolean };

export const el = <T extends HTMLElement = HTMLElement>(html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild as T;
};

export const esc = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const bird = (className: string) =>
  `<svg viewBox="0 0 442 417" fill="currentColor" aria-hidden="true" class="${className}"><path fill-rule="evenodd" clip-rule="evenodd" d="${birdPath}"></path></svg>`;

const plans = [
  { name: "Free", monthly: 0, yearly: 0, text: "For side projects", features: ["1 project", "Community support"] },
  { name: "Pro", monthly: 12, yearly: 10, text: "For growing teams", features: ["10 projects", "Email support"] },
  { name: "Team", monthly: 29, yearly: 24, text: "For the whole company", features: ["Unlimited projects", "SSO"] },
];

const faq = [
  ["Can I change plans later?", "Yes, upgrade or downgrade at any time. We prorate the difference."],
  ["Is there a free trial?", "Pro and Team come with 14 days free, no card needed."],
  ["Do you offer discounts?", "Nonprofits and students get 50% off any plan."],
  ["What payment methods?", "All major cards, and invoices on the Team plan."],
];

export function sitePage(site: Site) {
  const dark = site.hero === "b";
  const cards = plans.slice(0, site.plans).map(
    (p, i) => `
    <div class="rounded-xl border bg-white p-4 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.15)] ${i === 1 ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200"}">
      <p class="font-semibold text-gray-900">${p.name}</p>
      <p class="mt-0.5 text-xs text-gray-500">${p.text}</p>
      <p class="mt-3 text-2xl font-semibold text-gray-900">$<span class="group-[.yearly]:hidden">${p.monthly}</span><span class="hidden group-[.yearly]:inline">${p.yearly}</span><span class="text-xs font-normal text-gray-500"> /mo</span></p>
      <ul class="mt-3 space-y-1 text-xs text-gray-600">${p.features.map((f) => `<li>✓ ${f}</li>`).join("")}</ul>
      <span class="mt-4 block rounded-lg py-1.5 text-center text-xs font-medium ${i === 1 ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"}">Get ${p.name}</span>
    </div>`,
  );
  return `
  <div class="site group @container min-h-full bg-white font-sans text-[13px] text-gray-700">
    <div class="${dark ? "bg-gray-900 text-white" : "bg-[#f5f3ee] text-gray-900"} px-6 pt-4 pb-16 text-center">
      <div class="flex items-center justify-between text-xs ${dark ? "text-gray-300" : "text-gray-600"}">
        <span class="flex items-center gap-1.5 font-semibold ${dark ? "text-white" : "text-gray-900"}"><span class="size-3.5 rounded-full ${dark ? "bg-[#ffb86b]" : "bg-[#e0663b]"}"></span>Acme</span>
        <span class="hidden gap-4 @md:flex"><span>Product</span><span>Pricing</span><span>Docs</span></span>
      </div>
      <p class="mx-auto mt-8 max-w-sm text-2xl leading-tight font-semibold tracking-tight @md:text-3xl">Simple pricing for every team</p>
      <p class="mt-2 ${dark ? "text-gray-400" : "text-gray-500"}">Start free. Upgrade when you grow.</p>
      ${
        site.annual
          ? `<span role="button" class="site-billing mt-5 inline-flex cursor-pointer rounded-full p-0.5 text-xs ${dark ? "bg-white/10" : "bg-black/5"}">
        <span class="rounded-full px-3 py-1 ${dark ? "group-[:not(.yearly)]:bg-white group-[:not(.yearly)]:text-gray-900" : "group-[:not(.yearly)]:bg-white group-[:not(.yearly)]:shadow-sm"}">Monthly</span>
        <span class="rounded-full px-3 py-1 ${dark ? "group-[.yearly]:bg-white group-[.yearly]:text-gray-900" : "group-[.yearly]:bg-white group-[.yearly]:shadow-sm"}">Annual −20%</span>
      </span>`
          : ""
      }
    </div>
    <div class="mx-auto -mt-9 grid gap-3 px-5 ${site.plans === 3 ? "max-w-3xl @lg:grid-cols-3" : "max-w-xl @md:grid-cols-2"}">
      ${cards.join("")}
    </div>
    <div class="mx-auto mt-10 max-w-3xl px-5">
      <p class="text-center text-xs text-gray-400">Trusted by teams at</p>
      <div class="mt-3 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-semibold tracking-tight text-gray-300">
        <span>Northwind</span><span>Globex</span><span>Initech</span><span>Umbrella</span><span>Hooli</span>
      </div>
      <p class="mt-10 text-base font-semibold text-gray-900">Questions</p>
      <div class="mt-3 grid gap-x-8 gap-y-4 @md:grid-cols-2">
        ${faq.map(([q, a]) => `<div><p class="font-medium text-gray-900">${q}</p><p class="mt-1 text-xs text-gray-500">${a}</p></div>`).join("")}
      </div>
    </div>
    <div class="mt-10 border-t border-gray-100 px-6 py-5 text-center text-xs text-gray-400">© Acme, Inc.</div>
  </div>`;
}

export const screenshot = (site: Site, width: number, label?: string) => `
  <div class="shot relative overflow-hidden rounded-lg border border-gray-200 bg-white" style="width:${width}px;height:${Math.round(width * 0.62)}px">
    <div style="width:640px;transform:scale(${width / 640});transform-origin:top left">${sitePage(site)}</div>
    ${label ? `<span class="absolute top-2 left-2 grid size-6 place-items-center rounded-md bg-gray-900 text-xs font-semibold text-white">${label}</span>` : ""}
  </div>`;

export const AGENT = "claude-acme-vm";

export const agentMessage = (content: string, time: string) => `
  <div class="msg-in flex gap-2.5 px-1 py-2">
    <span data-bird="${AGENT}" data-size="26" data-dot="off" class="size-[26px] flex-none"></span>
    <div class="min-w-0 flex-1">
      <p class="text-xs text-gray-500"><span class="font-medium text-gray-900">claude</span> <span class="tabular-nums">${time}</span></p>
      <div class="mt-1 text-sm text-gray-800">${content}</div>
    </div>
  </div>`;

export const humanMessage = (text: string) => `
  <div class="msg-in flex flex-col items-end py-2">
    <div class="max-w-[80%] rounded-2xl bg-gray-100 px-3.5 py-2 text-sm text-gray-900">${esc(text)}</div>
    <p class="msg-state mt-1 h-4 pr-1 text-xs text-gray-500">Sent</p>
  </div>`;

export const toggleRow = (id: string, label: string) => `
  <button type="button" data-toggle="${id}" aria-pressed="false" class="group/t flex w-full items-center justify-between gap-3 py-1 text-left text-sm text-gray-800">
    ${label}
    <span class="relative h-5 w-9 flex-none rounded-full bg-gray-200 transition group-aria-pressed/t:bg-brand-500"><span class="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition group-aria-pressed/t:translate-x-4"></span></span>
  </button>`;

export const choiceButton = (value: string, label: string, description?: string) => `
  <button type="button" data-choice="${esc(value)}" class="flex w-full items-start gap-2.5 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 aria-pressed:border-brand-500 aria-pressed:bg-brand-50">
    <span class="mt-0.5 size-3.5 flex-none rounded-full border border-gray-300 [[aria-pressed=true]_&]:border-4 [[aria-pressed=true]_&]:border-brand-500"></span>
    <span><span class="text-gray-900">${label}</span>${description ? `<span class="block text-xs text-gray-500">${description}</span>` : ""}</span>
  </button>`;

export const statsApp = () => {
  const days = [12, 18, 15, 22, 30, 26, 41, 38, 52, 47, 61, 58, 74, 88];
  return `
  <div class="flex-1 overflow-y-auto bg-white p-5 sm:p-7">
    <div class="mx-auto max-w-2xl">
      <div class="flex items-center justify-between">
        <p class="text-lg font-semibold text-gray-900">Launch stats</p>
        <button type="button" class="stats-refresh btn btn-outline h-8 text-[13px]">${icon("rotate", "size-3.5")} Refresh</button>
      </div>
      <p class="mt-1 text-xs text-gray-500">Loaded <span class="stats-time">just now</span> by running <code class="rounded bg-gray-100 px-1 font-mono">stats</code> on the agent's machine</p>
      <div class="mt-5 grid grid-cols-3 gap-3">
        ${[
          ["Visitors", "stats-visitors", "12,480"],
          ["Signups", "stats-signups", "668"],
          ["Conversion", "stats-conv", "5.4%"],
        ]
          .map(([label, cls, value]) => `<div class="rounded-xl bg-gray-100 p-3"><p class="text-xs text-gray-500">${label}</p><p class="${cls} mt-1 text-xl font-semibold text-gray-900 tabular-nums">${value}</p></div>`)
          .join("")}
      </div>
      <p class="mt-6 text-sm font-medium text-gray-900">Signups per day</p>
      <div class="stats-bars mt-3 flex h-36 items-end gap-1.5">
        ${days.map((d, i) => `<span class="bar-grow flex-1 origin-bottom rounded-t-sm bg-brand-400" style="height:${d}%;animation-delay:${i * 0.03}s"></span>`).join("")}
      </div>
      <p class="mt-6 text-sm font-medium text-gray-900">Top sources</p>
      <table class="mt-2 w-full text-sm">
        ${[
          ["Hacker News", "4,210"],
          ["Newsletter", "2,980"],
          ["Search", "1,644"],
        ]
          .map(([source, n]) => `<tr class="border-t border-gray-200"><td class="py-2 text-gray-800">${source}</td><td class="py-2 text-right text-gray-500 tabular-nums">${n}</td></tr>`)
          .join("")}
      </table>
    </div>
  </div>`;
};

export const previewApp = (url: string, site: Site) => `
  <div class="flex min-h-0 flex-1 flex-col bg-gray-100">
    <div class="flex h-10 flex-none items-center gap-2 border-b border-gray-200 bg-white px-3 text-xs text-gray-500">
      <span class="min-w-0 flex-1 truncate rounded-md bg-gray-100 px-2.5 py-1">${esc(url.replace("https://", ""))}/pricing</span>
      <span class="flex rounded-lg bg-gray-100 p-0.5">
        <button type="button" data-device="desktop" aria-pressed="true" class="grid h-6 w-7 place-items-center rounded-md aria-pressed:bg-white aria-pressed:text-gray-900 aria-pressed:shadow-sm" aria-label="Desktop">${icon("monitor", "size-3.5")}</button>
        <button type="button" data-device="phone" aria-pressed="false" class="grid h-6 w-7 place-items-center rounded-md aria-pressed:bg-white aria-pressed:text-gray-900 aria-pressed:shadow-sm" aria-label="Phone">${icon("phone", "size-3.5")}</button>
      </span>
    </div>
    <div class="preview-stage flex min-h-0 flex-1 justify-center overflow-hidden p-0 data-[device=phone]:p-4">
      <div class="preview-frame h-full w-full overflow-y-auto bg-white transition-[width,border-radius] duration-300 [[data-device=phone]_&]:w-[300px] [[data-device=phone]_&]:rounded-[28px] [[data-device=phone]_&]:border-[8px] [[data-device=phone]_&]:border-gray-900">
        ${sitePage(site)}
      </div>
    </div>
  </div>`;
