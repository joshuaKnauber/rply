import type { ReactNode } from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { inOut, lerp, press, tween } from "../anim.ts";
import { AppIcon } from "../icons.tsx";

export const FPS = 30;

const S = {
  phone: { from: 0, to: 10.2 },
  terminal: { from: 10.2, to: 19.6 },
  secret: { from: 19.6, to: 33.6 },
  cron: { from: 33.6, to: 46.6 },
  end: { from: 46.6, to: 51.6 },
};
export const DURATION = S.end.to;

type Shot = { t: number; x: number; y: number; s: number };

// Camera over a 1280x800 recording: x/y is the point (in recording pixels) that sits in the middle of the window.
function camera(t: number, shots: Shot[]) {
  let cur = shots[0];
  for (const next of shots.slice(1)) {
    const p = tween(t, next.t, 0.9, inOut);
    if (p <= 0) break;
    cur = { t: next.t, x: lerp(cur.x, next.x, p), y: lerp(cur.y, next.y, p), s: lerp(cur.s, next.s, p) };
  }
  return cur;
}

function Wallpaper() {
  return <Img src={staticFile("hermes/wall.jpg")} className="absolute inset-0 size-full object-cover" />;
}

function Fade({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const t = useCurrentFrame() / FPS;
  const o = tween(t, from, 0.35) * (1 - tween(t, to - 0.35, 0.35));
  if (o <= 0) return null;
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

function Chrome({ title, children, dark = true }: { title: ReactNode; children: ReactNode; dark?: boolean }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[14px] ring-1 ring-black/40"
      style={{ width: 1440, height: 944, boxShadow: "0 40px 100px rgb(20 30 60 / 0.45), 0 10px 30px rgb(0 0 0 / 0.25)" }}
    >
      <div className={`relative flex h-11 flex-none items-center gap-2 px-4 ${dark ? "bg-[#262624]" : "bg-[#ececec]"}`}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} className="size-3.5 rounded-full" style={{ background: c }} />
        ))}
        <div className="absolute inset-x-0 flex justify-center text-[15px] text-[#b4b4b0]">{title}</div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#171715]">{children}</div>
    </div>
  );
}

function Recording({ src, start, shots, t }: { src: string; start: number; shots: Shot[]; t: number }) {
  const cam = camera(t, shots);
  const k = cam.s * 1.125;
  const clamp = (v: number, size: number, view: number) => Math.min(0, Math.max(view - size * k, v));
  const x = clamp(720 - cam.x * k, 1280, 1440);
  const y = clamp(450 - cam.y * k, 800, 900);
  return (
    <div
      className="absolute top-0 left-0 origin-top-left"
      style={{
        width: 1280,
        height: 800,
        transform: `translate(${x}px, ${y}px) scale(${k})`,
      }}
    >
      <OffthreadVideo src={staticFile(src)} startFrom={Math.round(start * FPS)} muted className="size-full" />
    </div>
  );
}

function Caption({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const t = useCurrentFrame() / FPS;
  const o = tween(t, from, 0.4) * (1 - tween(t, to - 0.4, 0.4));
  if (o <= 0) return null;
  return (
    <div className="absolute inset-x-0 bottom-[38px] flex justify-center" style={{ opacity: o, transform: `translateY(${(1 - o) * 10}px)` }}>
      <p className="rounded-full bg-[#1b1b1a]/85 px-6 py-2.5 text-[27px] font-medium tracking-[-0.01em] text-white shadow-lg ring-1 ring-white/10 backdrop-blur">
        {children}
      </p>
    </div>
  );
}

function LaptopScene({ from, to, src, start, shots, children }: { from: number; to: number; src: string; start: number; shots: Shot[]; children?: ReactNode }) {
  const t = useCurrentFrame() / FPS - from;
  const enter = tween(t, 0, 0.6);
  return (
    <Fade from={from} to={to}>
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translateY(${(1 - enter) * 30}px) scale(${0.97 + enter * 0.03})` }}>
        <div className="-mt-6">
          <Chrome title={<span>🔒 app.rply.sh</span>}>
            <Sequence from={Math.round(from * FPS)} layout="none">
              <Recording src={src} start={start} shots={shots} t={t} />
            </Sequence>
          </Chrome>
        </div>
      </div>
      {children}
    </Fade>
  );
}

const PHONE_W = 430;
const PHONE_H = 932;

function PhoneScene() {
  const t = useCurrentFrame() / FPS - S.phone.from;
  const notif = tween(t, 0.7, 0.6);
  const tap = 2.5;
  const open = tween(t, tap + 0.15, 0.45, inOut);
  const finger = tween(t, tap - 0.6, 0.3) * (1 - tween(t, tap + 0.3, 0.25));
  const tapApprove = 6.5;
  const finger2 = tween(t, tapApprove - 0.6, 0.3) * (1 - tween(t, tapApprove + 0.35, 0.25));
  return (
    <Fade from={S.phone.from} to={S.phone.to}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative -mt-6 rounded-[68px] bg-[#0b0b0b] p-[13px] shadow-[0_40px_100px_rgb(20_30_60/0.45)] ring-1 ring-white/10">
          <div className="relative overflow-hidden rounded-[56px]" style={{ width: PHONE_W, height: PHONE_H }}>
            <div className="absolute inset-0" style={{ opacity: 1 - open }}>
              <Img src={staticFile("hermes/wall.jpg")} className="absolute inset-0 size-full object-cover object-[60%_50%] brightness-90" />
              <p className="relative mt-[92px] text-center text-[19px] font-medium text-white/90 [text-shadow:0_1px_8px_rgb(0_0_0/0.25)]">Sunday 18 October</p>
              <p className="relative text-center text-[92px] leading-none font-semibold tracking-[-0.03em] text-white [text-shadow:0_2px_16px_rgb(0_0_0/0.2)]">22:56</p>
              <div
                className="relative mx-3.5 mt-[300px] flex gap-3 rounded-[22px] bg-white/75 p-3.5 shadow-[0_10px_30px_-6px_rgb(0_0_0/0.25)] backdrop-blur-xl"
                style={{ opacity: notif, transform: `translateY(${(1 - notif) * -30}px) scale(${press(t, tap)})` }}
              >
                <AppIcon size={40} />
                <div className="min-w-0 text-[15px] leading-snug">
                  <p className="flex justify-between font-semibold text-gray-900">
                    Hermes <span className="font-normal text-gray-500">now</span>
                  </p>
                  <p className="line-clamp-2 text-gray-800">⚠️ Hermes wants to run a command that needs your OK</p>
                </div>
              </div>
            </div>
            <div className="absolute inset-0" style={{ opacity: open, transform: `scale(${0.94 + open * 0.06})` }}>
              <Sequence from={Math.round((S.phone.from + tap) * FPS)} layout="none">
                <OffthreadVideo src={staticFile("hermes/phone.mp4")} startFrom={Math.round(2.2 * FPS)} muted style={{ width: PHONE_W, height: PHONE_H }} />
              </Sequence>
            </div>
            <div className="absolute top-3 left-1/2 h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black" />
          </div>
          <Finger x={215} y={548} o={finger} s={press(t, tap)} />
          <Finger x={121} y={718} o={finger2} s={press(t, tapApprove)} />
        </div>
      </div>
      <Caption from={S.phone.from + 0.9} to={S.phone.to}>
        Hermes needs your OK. You get a push and tap Allow.
      </Caption>
    </Fade>
  );
}

function Finger({ x, y, o, s }: { x: number; y: number; o: number; s: number }) {
  if (o <= 0) return null;
  return (
    <span
      className="absolute z-30 -mt-6 -ml-6 size-12 rounded-full border-2 border-white/90 bg-black/20 shadow-[0_4px_12px_rgb(0_0_0/0.25)]"
      style={{ left: x + 13, top: y + 13, opacity: o, transform: `scale(${s})` }}
    />
  );
}

const PROMPT = "exedev@hermes-rply:~$ ";
const TERMINAL: { at: number; cmd?: string; out?: string[] }[] = [
  { at: 0.6, cmd: "hermes plugins install https://github.com/joshuaKnauber/rply/tree/main/integrations/hermes --enable" },
  { at: 2.9, out: ["✓ Installed  Plugin installed: rply-platform 0.7.0", "           Location: /home/exedev/.hermes/plugins/rply-platform", "✓ Plugin rply-platform enabled."] },
  { at: 3.7, cmd: "hermes rply join https://app.rply.sh SAT5-82RQ" },
  { at: 5.2, out: ['Connected this Hermes profile to the rply channel "Hermes".'] },
  { at: 5.9, cmd: "hermes gateway restart" },
  { at: 6.7, out: ["✓ User service restarted (PID 98397)", "INFO gateway.run: ✓ rply connected"] },
];

function TerminalScene() {
  const t = useCurrentFrame() / FPS - S.terminal.from;
  const enter = tween(t, 0, 0.6);
  const lines: ReactNode[] = [];
  TERMINAL.forEach((l, i) => {
    if (t < l.at) return;
    if (l.cmd) {
      const n = Math.floor((t - l.at) * 70);
      const shown = l.cmd.slice(0, n);
      const typing = n < l.cmd.length;
      lines.push(
        <p key={i} className="break-all">
          <span className="text-[#8fd18a]">{PROMPT}</span>
          {shown}
          {typing && <span className="ml-0.5 inline-block h-[22px] w-[11px] translate-y-1 bg-[#d6d6d2]" />}
        </p>,
      );
    } else {
      l.out!.forEach((o, j) =>
        lines.push(
          <p key={`${i}-${j}`} className={o.includes("✓") ? "text-[#d6d6d2]" : "text-[#9a9a95]"}>
            {o}
          </p>,
        ),
      );
    }
  });
  const idle = t > 7.2;
  return (
    <Fade from={S.terminal.from} to={S.terminal.to}>
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translateY(${(1 - enter) * 30}px) scale(${0.97 + enter * 0.03})` }}>
        <div className="-mt-6">
          <Chrome title={<span>exedev@hermes-rply: ~ (ssh)</span>}>
            <div className="absolute inset-0 bg-[#111110] p-7 font-mono text-[23px] leading-[1.55] text-[#d6d6d2]">
              {lines}
              {idle && (
                <p>
                  <span className="text-[#8fd18a]">{PROMPT}</span>
                  <span className="inline-block h-[22px] w-[11px] translate-y-1 bg-[#d6d6d2]" style={{ opacity: Math.floor(t * 2) % 2 }} />
                </p>
              )}
            </div>
          </Chrome>
        </div>
      </div>
      <Caption from={S.terminal.from + 0.5} to={S.terminal.to}>
        Three commands on the server. No Tailscale, no open ports, no bot token.
      </Caption>
    </Fade>
  );
}

function EndScene() {
  const t = useCurrentFrame() / FPS - S.end.from;
  const a = tween(t, 0.1, 0.6);
  const b = tween(t, 0.5, 0.6);
  return (
    <Fade from={S.end.from} to={S.end.to + 1}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-7">
        <div className="flex items-center gap-4" style={{ opacity: a, transform: `translateY(${(1 - a) * 12}px)` }}>
          <AppIcon size={64} />
          <p className="text-[54px] font-semibold tracking-[-0.03em] text-gray-950">rply for Hermes</p>
        </div>
        <div style={{ opacity: b, transform: `translateY(${(1 - b) * 12}px)` }} className="flex flex-col items-center gap-4">
          <p className="rounded-2xl bg-[#111110]/90 px-7 py-4 font-mono text-[24px] text-[#d6d6d2] shadow-xl ring-1 ring-white/10">
            <span className="text-[#8fd18a]">$ </span>hermes plugins install https://github.com/joshuaKnauber/rply/tree/main/integrations/hermes --enable
          </p>
          <p className="text-[28px] font-medium text-gray-900">rply.sh/docs/integrations/hermes · open source, self-hostable</p>
        </div>
      </div>
    </Fade>
  );
}

export function HermesDemo() {
  const { durationInFrames } = useVideoConfig();
  const t = useCurrentFrame() / FPS;
  const outro = 1 - tween(t, durationInFrames / FPS - 0.5, 0.5);
  return (
    <AbsoluteFill className="bg-black font-sans" style={{ opacity: outro }}>
      <Wallpaper />
      <PhoneScene />
      <TerminalScene />
      <LaptopScene
        from={S.secret.from}
        to={S.secret.to}
        src="hermes/secret.mp4"
        start={2.4}
        shots={[
          { t: 0, x: 640, y: 400, s: 1 },
          { t: 1.2, x: 630, y: 520, s: 1.55 },
          { t: 12, x: 640, y: 500, s: 1.35 },
        ]}
      >
        <Caption from={S.secret.from + 0.5} to={S.secret.from + 8.5}>
          Hermes asks for an API key in a masked field.
        </Caption>
        <Caption from={S.secret.from + 8.8} to={S.secret.to}>
          It lands in .env on the server. Never in the chat or the model's context.
        </Caption>
      </LaptopScene>
      <LaptopScene
        from={S.cron.from}
        to={S.cron.to}
        src="hermes/cron.mp4"
        start={0}
        shots={[
          { t: 0, x: 780, y: 420, s: 1.1 },
          { t: 0.3, x: 780, y: 470, s: 1.3 },
          { t: 6.6, x: 640, y: 400, s: 1 },
          { t: 7.6, x: 630, y: 600, s: 1.6 },
        ]}
      >
        <Caption from={S.cron.from + 0.5} to={S.cron.from + 6.6}>
          Cron jobs in a dashboard. Run one from anywhere.
        </Caption>
        <Caption from={S.cron.from + 6.9} to={S.cron.to}>
          The result lands in the same inbox, with push.
        </Caption>
      </LaptopScene>
      <EndScene />
    </AbsoluteFill>
  );
}
