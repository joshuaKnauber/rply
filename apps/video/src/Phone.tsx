import { path, press, tween } from "./anim.ts";
import { AppIcon, Icon } from "./icons.tsx";
import { PHONE, T } from "./timeline.ts";

const FINGER = { x: 200, y: 600 };

function Finger({ t }: { t: number }) {
  const shown = tween(t, T.tapNotification - 0.55, 0.3) * (1 - tween(t, T.tapPublish + 0.35, 0.3));
  if (!shown) return null;
  const pos = path(t, FINGER, [
    { x: 150, y: 262, at: T.tapNotification - 0.5, dur: 0.45 },
    { x: 86, y: 556, at: T.tapPublish - 0.65, dur: 0.6 },
  ]);
  const scale = Math.min(press(t, T.tapNotification), press(t, T.tapPublish));
  return (
    <span
      className="absolute z-30 -mt-5 -ml-5 size-10 rounded-full border-2 border-white bg-black/25 shadow-[0_4px_12px_rgb(0_0_0/0.2)]"
      style={{ left: pos.x, top: pos.y, opacity: shown, transform: `scale(${scale})` }}
    />
  );
}

function LockScreen({ t }: { t: number }) {
  const notif = tween(t, T.notify, 0.6);
  return (
    <div className="absolute inset-0 bg-linear-to-b from-[#e4e7fb] via-[#f1f0fa] to-[#f8f5f0]">
      <p className="mt-20 text-center text-[15px] font-medium text-gray-600">Tuesday, October 13</p>
      <p className="text-center text-[76px] leading-none font-[550] tracking-[-0.04em] text-gray-900">9:41</p>
      <div
        className="mx-3 mt-24 flex gap-3 rounded-2xl bg-white/80 p-3.5 shadow-[0_10px_30px_-6px_rgb(0_0_0/0.18)] ring-1 ring-black/5"
        style={{ opacity: notif, transform: `translateY(${(1 - notif) * -24}px) scale(${(0.94 + notif * 0.06) * press(t, T.tapNotification)})` }}
      >
        <AppIcon size={36} />
        <div className="min-w-0 text-[14px] leading-snug">
          <p className="flex justify-between font-semibold text-gray-900">
            SEO bot <span className="font-normal text-gray-500">now</span>
          </p>
          <p className="text-gray-700">Publish 5 new pages to acme.dev?</p>
        </div>
      </div>
    </div>
  );
}

function Thread({ t }: { t: number }) {
  const answered = tween(t, T.tapPublish + 0.1, 0.3);
  return (
    <div className="absolute inset-0 flex flex-col bg-white pt-12 text-[14px]">
      <div className="flex flex-none items-center gap-2 border-b border-gray-200 px-4 pb-3">
        <Icon name="chevron" className="size-5 text-gray-500" />
        <div>
          <p className="font-medium text-gray-900">SEO bot</p>
          <p className="text-[12px] text-gray-500">acme.dev</p>
        </div>
      </div>
      <div className="mx-3 mt-3 flex-none rounded-lg bg-gray-100 px-3 py-2.5">
        <p className="flex justify-between">
          <span className="font-medium text-gray-900">Status</span>
          <span className="text-gray-500">{answered ? "Publishing" : "Waiting for you"}</span>
        </p>
        <div className="mt-2 h-1 rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-gray-800" style={{ width: `${answered * 12}%` }} />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-1 overflow-hidden px-3 pb-2" style={{ maskImage: "linear-gradient(transparent, black 24px)" }}>
        <div className="rounded-lg px-3 py-2">
          <p className="text-[12px] text-gray-500">
            <span className="font-medium text-gray-900">SEO bot</span> 9:12
          </p>
          <p className="mt-0.5">Keyword research for acme.dev is done. 14 new topics.</p>
        </div>
        <div className="rounded-r-lg border-l-2 px-3 py-2" style={{ borderColor: `rgb(91 104 224 / ${1 - answered})` }}>
          <p className="text-[12px] text-gray-500">
            <span className="font-medium text-gray-900">SEO bot</span> 9:41
          </p>
          <p className="mt-0.5">Publish 5 new pages to acme.dev?</p>
          <div className="mt-2.5 flex gap-1.5">
            <span className="btn btn-outline relative h-9 flex-1 overflow-hidden px-2" style={{ transform: `scale(${press(t, T.tapPublish)})` }}>
              Publish
              <span className="btn-primary absolute inset-0 grid place-items-center" style={{ opacity: answered }}>
                Publish
              </span>
            </span>
            <span className="btn btn-outline h-9 flex-1 px-2" style={{ opacity: 1 - answered * 0.6 }}>
              Not yet
            </span>
          </div>
        </div>
      </div>
      <div className="mx-3 mb-7 flex flex-none items-center justify-between rounded-xl bg-gray-100 px-3 py-3 text-gray-400">
        Message SEO bot <Icon name="arrow-up" className="size-4" />
      </div>
    </div>
  );
}

export function Phone({ t }: { t: number }) {
  const enter = tween(t, T.worldIn + 0.3, 1);
  const open = tween(t, T.tapNotification + 0.1, 0.5);
  return (
    <div
      className="absolute rounded-[52px] bg-gray-900 p-[10px] shadow-[0_40px_80px_-24px_rgb(0_0_0/0.45)]"
      style={{ ...PHONE, opacity: enter, transform: `translateY(${(1 - enter) * 80}px)` }}
    >
      <div className="relative h-full overflow-hidden rounded-[42px] bg-white">
        <div className="absolute inset-0" style={{ opacity: 1 - open, transform: `scale(${1 + open * 0.06})` }}>
          <LockScreen t={t} />
        </div>
        {open > 0 && (
          <div className="absolute inset-0" style={{ opacity: open, transform: `scale(${0.94 + open * 0.06})` }}>
            <Thread t={t} />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 z-20 flex h-12 items-center justify-between px-8 pt-1 text-[14px] font-semibold text-gray-900">
          <span style={{ opacity: open }}>9:41</span>
          <span className="absolute top-3 left-1/2 h-7 w-24 -translate-x-1/2 rounded-full bg-gray-900" />
          <span className="h-3 w-5 rounded-[4px] border border-gray-900" />
        </div>
        <span className="absolute bottom-2 left-1/2 z-20 h-1 w-28 -translate-x-1/2 rounded-full bg-gray-900" />
        <Finger t={t} />
      </div>
    </div>
  );
}
