import type { ReactNode } from "react";
import { interpolate } from "remotion";
import { blink, inOut, press, tween, typed } from "./anim.ts";
import { Bird, Icon } from "./icons.tsx";
import { BROWSER, MESSAGE, T } from "./timeline.ts";

function Reveal({ p, children }: { p: number; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateRows: `${p}fr` }}>
      <div style={{ minHeight: 0, overflow: p < 1 ? "hidden" : "visible" }}>
        <div className="pt-1" style={{ opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const Meta = ({ who, time }: { who: string; time: string }) => (
  <p className="text-gray-500">
    <span className="font-medium text-gray-900">{who}</span> <span className="tabular-nums">{time}</span>
  </p>
);

function Agent({ time, children, highlight = 0 }: { time: string; children: ReactNode; highlight?: number }) {
  return (
    <div className="rounded-r-lg border-l-2 px-4 py-3" style={{ borderColor: `rgb(91 104 224 / ${highlight})` }}>
      <Meta who="SEO bot" time={time} />
      {children}
    </div>
  );
}

function Human({ time, children }: { time: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-100 px-4 py-3">
      <Meta who="You" time={time} />
      {children}
    </div>
  );
}

function Question({ t }: { t: number }) {
  const answered = tween(t, T.tapPublish + 0.15, 0.3);
  return (
    <Agent time="9:41" highlight={1 - answered}>
      <p className="mt-1 text-[16px]">Publish 5 new pages to acme.dev?</p>
      <div className="mt-3 flex gap-2">
        <span className="btn btn-outline relative h-9 overflow-hidden">
          Publish
          <span className="btn-primary absolute inset-0 grid place-items-center" style={{ opacity: answered }}>
            Publish
          </span>
        </span>
        <span className="btn btn-outline h-9" style={{ opacity: 1 - answered * 0.6 }}>
          Not yet
        </span>
      </div>
    </Agent>
  );
}

function Secret({ t }: { t: number }) {
  const focus = tween(t, T.secretClickField, 0.2);
  const dots = Math.max(0, Math.min(24, Math.floor(((t - T.secretTypeStart) / (T.secretTypeEnd - T.secretTypeStart)) * 24)));
  const sent = tween(t, T.secretSend + 0.1, 0.4);
  const delivered = t >= T.secretWritten + 0.1;
  const open = 1 - sent;
  return (
    <Agent time="9:47" highlight={open}>
      <div className="mt-2 w-[460px] rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
        <p className="flex items-center gap-2 font-medium text-gray-900">
          <Icon name="lock" className="size-4 text-gray-500" /> STRIPE_SECRET_KEY
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[12px] font-normal text-gray-600">
            {delivered ? "Delivered" : sent > 0 ? "Provided" : "Requested"}
          </span>
        </p>
        <p className="mt-1 text-gray-600">Checkout for the Teams plan</p>
        <p className="mt-0.5 font-mono text-[12px] text-gray-500">/home/agent/acme/.env</p>
        <div className="relative mt-3 h-9">
          <div className="absolute inset-0 flex gap-2" style={{ opacity: open, transform: `scale(${1 - sent * 0.03})` }}>
            <span
              className="flex h-9 flex-1 items-center overflow-hidden rounded-lg border bg-white px-3"
              style={{
                borderColor: focus ? "var(--color-brand-400)" : "var(--color-gray-200)",
                boxShadow: `0 0 0 ${focus * 3}px rgb(111 126 246 / 0.18)`,
              }}
            >
              {dots === 0 ? (
                <span className="text-gray-400">Paste the value</span>
              ) : (
                <span className="font-mono tracking-widest whitespace-nowrap text-gray-600">{"•".repeat(dots)}</span>
              )}
              {focus > 0 && t < T.secretSend && <span className="ml-px h-4 w-px bg-gray-800" style={{ opacity: blink(t) }} />}
            </span>
            <span className="btn btn-primary h-9" style={{ transform: `scale(${press(t, T.secretSend)})` }}>
              Send
            </span>
          </div>
          <p className="absolute inset-0 flex items-center gap-2 text-gray-600" style={{ opacity: sent }}>
            <span className="grid size-5 place-items-center rounded-full bg-gray-900 text-white">
              <Icon name="check" className="size-3" />
            </span>
            {delivered ? "Written to the agent's .env" : "Encrypted on this device and sent"}
          </p>
        </div>
      </div>
    </Agent>
  );
}

function HumanMessage({ t }: { t: number }) {
  const state = t >= T.ack ? "Working on it" : t >= T.messageSeen ? "Seen" : "Sent";
  return (
    <Human time="9:52">
      <p className="mt-1 flex items-end text-[16px]">
        {MESSAGE}
        <span className="ml-auto flex items-center gap-1.5 text-[13px] text-gray-500">
          {state === "Working on it" && <Icon name="loader" className="size-3.5" style={{ transform: `rotate(${t * 360}deg)` }} />}
          {state === "Seen" && <Icon name="eye" className="size-3.5" />}
          {state}
        </span>
      </p>
    </Human>
  );
}

function Status({ t }: { t: number }) {
  const shown = tween(t, T.statusArrive, 0.6);
  let value = 0;
  for (const p of T.patches) value += (p.value - value) * tween(t, p.at, 0.6, inOut);
  const live = Math.round(interpolate(value, [0, 5], [37, 42]));
  const done = t >= T.patches.at(-1)!.at + 0.6;
  return (
    <div className="pb-6">
      <p className="text-gray-500">
        Status <span className="float-right text-[13px] tabular-nums">{t >= T.statusArrive ? "9:42" : "9:12"}</span>
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Live", String(live)],
          ["Indexed", "38"],
          ["Clicks", "+38%"],
        ].map(([label, n]) => (
          <div key={label}>
            <dt className="text-[13px] text-gray-500">{label}</dt>
            <dd className="text-[22px] font-semibold text-gray-900 tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
      <Reveal p={shown}>
        <div className="mt-4 flex justify-between">
          <span>Publishing pages</span>
          <span className="flex items-center gap-1.5 text-gray-500 tabular-nums">
            {done && <Icon name="check" className="size-3.5" />}
            {done ? "Done" : `${Math.round(value)}/5`}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-gray-800" style={{ width: `${(value / 5) * 100}%` }} />
        </div>
      </Reveal>
    </div>
  );
}

const CHANNELS = [
  { name: "SEO bot", time: "9:41", active: true },
  { name: "Deploy bot", preview: "Deployed v2.4.1 to production", time: "9:12" },
  { name: "Nightly backup", preview: "Backup finished, 2.1 GB", time: "3:00" },
  { name: "Inbox triage", preview: "Archived 38 newsletters", time: "Mon" },
];

function preview(t: number) {
  if (t >= T.messageSend) return MESSAGE;
  if (t >= T.secretArrive) return "Requested STRIPE_SECRET_KEY";
  if (t >= T.liveArrive) return "All 5 pages are live.";
  if (t >= T.askArrive) return "Publish 5 new pages to acme.dev?";
  if (t >= T.sendArrive) return "Keyword research for acme.dev is done.";
  return "Starting this week's audit";
}

export function Browser({ t }: { t: number }) {
  const enter = tween(t, T.worldIn + 0.15, 1);
  const unread = (t >= T.askArrive && t < T.tapPublish + 0.2) || (t >= T.secretArrive && t < T.secretSend);
  const composing = t >= T.composerClick && t < T.messageSend;
  const draft = composing ? typed(MESSAGE, t, T.messageType, MESSAGE.length / (T.messageSend - T.messageType - 0.4)) : "";

  return (
    <div
      className="absolute overflow-hidden rounded-xl border border-gray-200 bg-white text-[15px] shadow-[0_40px_90px_-30px_rgb(0_0_0/0.3)]"
      style={{ ...BROWSER, opacity: enter, transform: `translateY(${(1 - enter) * 80}px)` }}
    >
      <div className="relative flex h-10 items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-4">
        <span className="size-3 rounded-full bg-gray-300" />
        <span className="size-3 rounded-full bg-gray-300" />
        <span className="size-3 rounded-full bg-gray-300" />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-md bg-gray-100 px-24 py-1 text-[13px] text-gray-500">app.rply.sh</span>
      </div>
      <div className="grid grid-cols-[230px_1fr_290px]" style={{ height: BROWSER.height - 40 }}>
        <aside className="flex flex-col border-r border-gray-200 bg-gray-100">
          <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-5 font-medium text-gray-900">
            <Bird className="size-4" /> rply.sh
            <span className="ml-auto flex gap-3 text-gray-500">
              <Icon name="bell" />
              <Icon name="plus" />
            </span>
          </div>
          <p className="px-5 pt-5 pb-2 text-gray-500">4 channels</p>
          {CHANNELS.map((c) => (
            <div key={c.name} className={`px-5 py-3 ${c.active ? "bg-gray-150" : ""}`}>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-900">{c.name}</span>
                {c.active && unread && <span className="size-1.5 rounded-full bg-brand-600" />}
                <span className="ml-auto text-[13px] text-gray-500 tabular-nums">{c.time}</span>
              </div>
              <p className="mt-0.5 truncate text-gray-500">{c.preview ?? preview(t)}</p>
              {c.active && (
                <p className="mt-2 flex items-center gap-2 pl-2 text-gray-500">
                  <Icon name="app" className="size-3.5" /> Rankings
                </p>
              )}
            </div>
          ))}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col">
          <div className="flex h-14 flex-none items-center border-b border-gray-200 px-6 text-[17px] font-medium text-gray-900">
            SEO bot
            <Icon name="ellipsis" className="ml-auto size-4 text-gray-500" />
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-6 pb-3"
            style={{ maskImage: "linear-gradient(transparent, black 32px)" }}
          >
            <Agent time="9:02">
              <p className="mt-1 text-[16px]">Morning! Starting this week's audit for acme.dev.</p>
            </Agent>
            <div className="pt-1">
              <Human time="9:05">
                <p className="mt-1 text-[16px]">Great. Look for new keywords around pricing.</p>
              </Human>
            </div>
            <Reveal p={tween(t, T.sendArrive, 0.6)}>
              <Agent time="9:12">
                <p className="mt-1 text-[16px]">Keyword research for acme.dev is done. 14 new topics.</p>
                <div className="mt-2.5 flex w-80 items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600">CSV</span>
                  <span className="text-gray-900">keywords.csv</span>
                  <span className="ml-auto text-[13px] text-gray-500">4 KB</span>
                </div>
              </Agent>
            </Reveal>
            <Reveal p={tween(t, T.askArrive, 0.6)}>
              <Question t={t} />
            </Reveal>
            <Reveal p={tween(t, T.liveArrive, 0.6)}>
              <Agent time="9:43">
                <p className="mt-1 text-[16px]">All 5 pages are live. Indexing requested.</p>
              </Agent>
            </Reveal>
            <Reveal p={tween(t, T.secretArrive, 0.6)}>
              <Secret t={t} />
            </Reveal>
            <Reveal p={tween(t, T.messageSend + 0.05, 0.6)}>
              <HumanMessage t={t} />
            </Reveal>
          </div>
          <div
            className="mx-6 mb-6 rounded-xl bg-gray-100 px-4 pt-3.5 pb-3"
            style={{ boxShadow: composing ? "0 0 0 1px var(--color-gray-300)" : "none" }}
          >
            {draft || composing ? (
              <span className="text-gray-900">
                {draft}
                <span className="ml-px inline-block h-4 w-px translate-y-0.5 bg-gray-800" style={{ opacity: blink(t) }} />
              </span>
            ) : (
              <span className="text-gray-400">Message SEO bot</span>
            )}
            <div className="mt-4 flex items-center justify-between text-gray-500">
              <Icon name="plus" />
              <span
                className={`grid size-8 place-items-center rounded-lg ${draft ? "btn-primary border" : "bg-gray-200 text-gray-500"}`}
                style={{ transform: `scale(${press(t, T.messageSend)})` }}
              >
                <Icon name="arrow-up" />
              </span>
            </div>
          </div>
        </main>

        <aside className="border-l border-gray-200 px-6">
          <div className="flex h-14 items-center text-gray-500">Pinned</div>
          <div className="divide-y divide-gray-200">
            <Status t={t} />
            <div className="py-6">
              <p className="text-gray-500">Agents</p>
              <p className="mt-3 flex items-center gap-2">
                <Icon name="bot" className="size-4 text-gray-500" /> exe-dev-seo
                <span className="ml-auto flex items-center gap-1.5 text-[13px] text-gray-500">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Active now
                </span>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
