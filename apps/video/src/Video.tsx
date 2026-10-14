import { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { inOut, path, press, tween } from "./anim.ts";
import { Agent } from "./Agent.tsx";
import { Flights, Flutter } from "./Birds.tsx";
import { Browser } from "./Browser.tsx";
import { Intro } from "./Intro.tsx";
import { Outro } from "./Outro.tsx";
import { Phone } from "./Phone.tsx";
import { AGENT, BROWSER, CAMERA, HEADLINES, PHONE, T } from "./timeline.ts";
import { DeviceLabel, Headline } from "./Titles.tsx";

const SPOTLIGHTS = [
  { x: 1662, y: 366, w: 266, h: 168, from: 22.9, to: 26.9 },
  { x: 1018, y: 646, w: 494, h: 204, from: 29.3, to: 32.1 },
  { x: AGENT.left + 8, y: 770, w: AGENT.width - 16, h: 100, from: 33.3, to: 35.4 },
];

const CURSOR = {
  secret: { field: { x: 1110, y: 801 }, send: { x: 1443, y: 801 } },
  composer: { field: { x: 1050, y: 884 }, send: { x: 1591, y: 926 } },
};

function Spotlight({ t }: { t: number }) {
  return SPOTLIGHTS.map((s) => {
    const p = tween(t, s.from, 0.6) * (1 - tween(t, s.to - 0.5, 0.5, inOut));
    if (p <= 0) return null;
    return (
      <div
        key={s.from}
        className="absolute rounded-2xl"
        style={{
          left: s.x,
          top: s.y,
          width: s.w,
          height: s.h,
          boxShadow: `0 0 0 2px rgb(111 126 246 / ${0.55 * p}), 0 0 0 6000px rgb(255 255 255 / ${0.68 * p})`,
        }}
      />
    );
  });
}

function Cursor({ t }: { t: number }) {
  const shown =
    tween(t, T.secretArrive + 0.4, 0.3) * (1 - tween(t, T.secretSend + 0.5, 0.3)) +
    tween(t, T.composerClick - 0.8, 0.3) * (1 - tween(t, T.messageSend + 0.5, 0.3));
  if (shown <= 0) return null;
  const pos = path(t, { x: 1400, y: 960 }, [
    { ...CURSOR.secret.field, at: T.secretArrive + 0.5, dur: T.secretClickField - T.secretArrive - 0.55 },
    { ...CURSOR.secret.send, at: T.secretTypeEnd + 0.1, dur: T.secretSend - T.secretTypeEnd - 0.15 },
    { x: 1400, y: 700, at: T.secretSend + 0.2, dur: 0.6 },
    { ...CURSOR.composer.field, at: T.composerClick - 0.7, dur: 0.65 },
    { ...CURSOR.composer.send, at: T.messageSend - 0.55, dur: 0.5 },
  ]);
  const clicks = [T.secretClickField, T.secretSend, T.composerClick, T.messageSend];
  const scale = Math.min(...clicks.map((c) => press(t, c)));
  const ring = clicks.map((c) => tween(t, c, 0.5)).find((p) => p > 0 && p < 1);
  return (
    <div className="absolute" style={{ left: pos.x, top: pos.y, opacity: Math.min(1, shown) }}>
      {ring !== undefined && (
        <span
          className="absolute -mt-6 -ml-6 size-12 rounded-full border-2 border-brand-500"
          style={{ opacity: 1 - ring, transform: `scale(${0.3 + ring * 0.9})` }}
        />
      )}
      <svg width="26" height="32" viewBox="0 0 26 32" className="-mt-0.5 -ml-1" style={{ transform: `scale(${scale})`, transformOrigin: "4px 3px" }}>
        <path
          d="M4 3 L4 25 L9.5 19.5 L13.2 28 L17 26.3 L13.4 18 L21 18 Z"
          fill="#111"
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 2px 3px rgb(0 0 0 / 0.3))" }}
        />
      </svg>
    </div>
  );
}

function Dots() {
  return (
    <div
      className="absolute"
      style={{
        left: -1400,
        top: -1000,
        width: 5200,
        height: 3200,
        backgroundImage: "radial-gradient(var(--color-gray-300) 1.4px, transparent 1.4px)",
        backgroundSize: "32px 32px",
        maskImage: "radial-gradient(ellipse at center, black 15%, transparent 55%)",
        opacity: 0.6,
      }}
    />
  );
}

const LABEL_Y = 1010;
const LABELS = [
  { x: AGENT.left + AGENT.width / 2, y: AGENT.top + AGENT.height + 36, icon: "server", text: "Your agent, on a VM" },
  { x: BROWSER.left + BROWSER.width / 2, y: LABEL_Y, icon: "laptop", text: "You, on the web" },
  { x: PHONE.left + PHONE.width / 2, y: LABEL_Y, icon: "phone", text: "You, on your phone" },
] as const;

function useFonts() {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all(
      ['400 16px "Inter Variable"', '600 16px "Inter Variable"', '400 16px "Geist Mono Variable"'].map((f) => document.fonts.load(f)),
    ).then(() => continueRender(handle));
  }, [handle]);
}

export function Video() {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cam = path(t, { x: 1225, y: 560, s: 0.5 }, CAMERA);
  const out = tween(t, T.devicesOut, 0.9, inOut);
  const shown = tween(t, T.worldIn, 0.6);

  return (
    <AbsoluteFill className="bg-white font-sans text-gray-800 antialiased" style={{ fontFeatureSettings: '"cv11", "ss03"' }}>
      <AbsoluteFill style={{ background: "linear-gradient(white 50%, #eceefb)" }} />
      {t >= T.worldIn && out < 1 && (
        <AbsoluteFill style={{ opacity: shown * (1 - out), filter: `blur(${out * 14}px)`, transform: `scale(${1 - out * 0.08})` }}>
          <div
            className="absolute top-0 left-0"
            style={{
              width: 1920,
              height: 1080,
              transformOrigin: "0 0",
              transform: `translate(960px, 540px) scale(${cam.s}) translate(${-cam.x}px, ${-cam.y}px)`,
            }}
          >
            <Dots />
            <Agent t={t} />
            <Browser t={t} />
            <Phone t={t} />
            {LABELS.map((l) => (
              <DeviceLabel key={l.text} t={t} {...l} from={5.0} to={6.9} />
            ))}
            <Spotlight t={t} />
            {HEADLINES.map((h) => (
              <Headline key={h.from} t={t} {...h} />
            ))}
            <Flights t={t} />
            <Flutter t={t} at={T.tapPublish + 0.05} x={2176} y={836} />
            <Cursor t={t} />
          </div>
        </AbsoluteFill>
      )}
      <Intro t={t} />
      <Outro t={t} />
    </AbsoluteFill>
  );
}
