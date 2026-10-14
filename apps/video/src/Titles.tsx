import { spring, useVideoConfig } from "remotion";
import { inOut, tween } from "./anim.ts";
import { AppIcon, Icon, type IconName } from "./icons.tsx";

export function Words({ t, from, strong, soft, size = 60 }: { t: number; from: number; strong: string; soft?: string; size?: number }) {
  const strongWords = strong ? strong.split(" ") : [];
  const words = [...strongWords.map((w) => [w, true] as const), ...(soft?.split(" ").map((w) => [w, false] as const) ?? [])];
  const strongCount = strongWords.length || -1;
  return (
    <p className="leading-[1.1] font-[600] tracking-[-0.035em]" style={{ fontSize: size }}>
      {words.map(([word, isStrong], i) => {
        const p = tween(t, from + i * 0.045 + (isStrong ? 0 : 0.15), 0.8);
        return (
          <span key={i}>
            {i === strongCount && <br />}
            <span
              className={`inline-block ${isStrong ? "text-gray-900" : "text-gray-400"}`}
              style={{ opacity: p, filter: `blur(${(1 - p) * 10}px)`, transform: `translateY(${(1 - p) * 0.35}em)`, marginRight: "0.26em" }}
            >
              {word}
            </span>
          </span>
        );
      })}
    </p>
  );
}

export function Headline({ t, x, from, to, strong, soft }: { t: number; x: number; from: number; to: number; strong: string; soft: string }) {
  if (t < from || t > to) return null;
  const out = tween(t, to - 0.45, 0.45, inOut);
  return (
    <div
      className="absolute text-center"
      style={{ left: x - 900, width: 1800, top: 112, opacity: 1 - out, filter: `blur(${out * 8}px)`, transform: `translateY(${-out * 14}px)` }}
    >
      <Words t={t} from={from} strong={strong} soft={soft} />
    </div>
  );
}

export function DeviceLabel({ t, x, y, icon, text, from, to }: { t: number; x: number; y: number; icon: IconName; text: string; from: number; to: number }) {
  const p = tween(t, from, 0.6) * (1 - tween(t, to - 0.4, 0.4));
  if (p <= 0) return null;
  return (
    <div
      className="absolute flex items-center justify-center gap-3 text-[30px] font-medium tracking-[-0.02em] text-gray-500"
      style={{ left: x - 300, width: 600, top: y, opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}
    >
      <Icon name={icon} className="size-8 text-gray-400" />
      {text}
    </div>
  );
}

export function Lockup({ t, start, textAt, scale = 1 }: { t: number; start: number; textAt: number; scale?: number }) {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: (t - start) * fps, fps, config: { damping: 11, mass: 0.8 } });
  const text = tween(t, textAt, 0.9);
  return (
    <div className="flex items-center" style={{ transform: `scale(${scale})` }}>
      <div style={{ transform: `scale(${pop}) rotate(${(1 - pop) * -24}deg)` }}>
        <AppIcon size={124} className="shadow-[0_24px_48px_-14px_rgb(91_104_224/0.65)]" />
      </div>
      <div className="overflow-hidden" style={{ width: text * 300 }}>
        <span
          className="block pl-6 text-[136px] leading-[1.15] font-[550] tracking-[-0.05em] whitespace-nowrap text-gray-900"
          style={{ opacity: text, filter: `blur(${(1 - text) * 10}px)`, transform: `translateX(${(1 - text) * -40}px)` }}
        >
          rply
        </span>
      </div>
    </div>
  );
}
