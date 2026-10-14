import { Easing, random } from "remotion";
import { inOut, lerp, tween, type Point } from "./anim.ts";
import { Bird, Icon } from "./icons.tsx";
import { FLIGHTS, type Flight } from "./timeline.ts";

const far = [203, 208, 255];
const near = [111, 126, 246];
const depthColor = (d: number) => `rgb(${far.map((c, i) => Math.round(c + (near[i] - c) * d)).join(",")})`;

const flap = (t: number, phase: number, speed = 22) => 1 - 0.22 * Math.abs(Math.sin(t * speed + phase));

function Sprite({ x, y, size, angle = 0, flip = false, squash = 1, color = "#6f7ef6", opacity = 1 }: Point & {
  size: number;
  angle?: number;
  flip?: boolean;
  squash?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Bird
      className="absolute"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        color,
        opacity,
        transform: `rotate(${angle}deg) scale(${flip ? -1 : 1}, ${squash})`,
      }}
    />
  );
}

function bezier(f: Flight, p: number): Point {
  const arc = f.arc ?? 180;
  const c = { x: (f.from.x + f.to.x) / 2, y: Math.min(f.from.y, f.to.y) - arc };
  const q = 1 - p;
  return { x: q * q * f.from.x + 2 * q * p * c.x + p * p * f.to.x, y: q * q * f.from.y + 2 * q * p * c.y + p * p * f.to.y };
}

function Messenger({ f, t }: { f: Flight; t: number }) {
  const p = tween(t, f.at, f.dur, inOut);
  if (p <= 0) return null;
  const landed = tween(t, f.at + f.dur, 0.5);
  if (landed >= 1) return null;
  const pos = bezier(f, p);
  const ahead = bezier(f, Math.min(1, p + 0.02));
  const flip = f.to.x < f.from.x;
  const angle = (Math.atan2(ahead.y - pos.y, Math.abs(ahead.x - pos.x) + 0.001) * 180) / Math.PI * 0.7 * (flip ? -1 : 1);
  const grow = Math.min(1, p * 6) * (1 - tween(t, f.at + f.dur - 0.12, 0.12));
  const trail = [0.05, 0.1, 0.15].map((d) => bezier(f, Math.max(0, tween(t - d * f.dur * 0.6, f.at, f.dur, inOut))));
  return (
    <>
      {grow > 0 &&
        trail.map((q, i) => (
          <Sprite key={i} {...q} size={36 - i * 5} angle={angle} flip={flip} opacity={(0.22 - i * 0.06) * grow} />
        ))}
      {grow > 0 && (
        <div className="absolute" style={{ left: pos.x, top: pos.y, transform: `scale(${grow})` }}>
          <Sprite x={0} y={0} size={42} angle={angle} flip={flip} squash={flap(t, f.at)} />
          {f.lock && (
            <span className="absolute -top-1 left-2 grid size-5 place-items-center rounded-full bg-gray-900 text-white shadow">
              <Icon name="lock" className="size-3" />
            </span>
          )}
        </div>
      )}
      {landed > 0 && (
        <span
          className="absolute size-16 rounded-full border-2 border-brand-400"
          style={{ left: f.to.x - 32, top: f.to.y - 32, opacity: 1 - landed, transform: `scale(${0.3 + landed})` }}
        />
      )}
    </>
  );
}

export const Flights = ({ t, flights = FLIGHTS }: { t: number; flights?: Flight[] }) => flights.map((f, i) => <Messenger key={i} f={f} t={t} />);

const COLORS = ["#6f7ef6", "#97a3ff", "#aab3ff", "#5b68e0"];

export function Flutter({ t, at, x, y, count = 12, seed = "flutter" }: Point & { t: number; at: number; count?: number; seed?: string }) {
  const birds = [];
  for (let i = 0; i < count; i++) {
    const dur = 1.1 + random(`${seed}d${i}`) * 0.4;
    const p = tween(t, at, dur, Easing.bezier(0.22, 1, 0.36, 1));
    if (p <= 0 || p >= 1) continue;
    const angle = (i / count) * Math.PI * 2 + (random(`${seed}a${i}`) - 0.5) * 0.5;
    const distance = 80 + random(`${seed}r${i}`) * 80;
    const dx = Math.cos(angle) * distance * 1.4;
    const dy = Math.sin(angle) * distance - 24;
    const size = 14 + random(`${seed}s${i}`) * 12;
    const opacity = p < 0.2 ? p / 0.2 : p > 0.75 ? (1 - p) / 0.25 : 1;
    birds.push(
      <Sprite
        key={i}
        x={x + dx * p}
        y={y + dy * p}
        size={size * (0.3 + Math.min(1, p * 2.5) * 0.7)}
        angle={Math.max(-30, Math.min(30, (dy / distance) * 30)) * (dx < 0 ? -1 : 1)}
        flip={dx < 0}
        squash={flap(t, i, 40)}
        color={COLORS[i % COLORS.length]}
        opacity={opacity}
      />,
    );
  }
  return birds;
}

export type FlockBird = { x: number; y: number; depth: number; phase: number };

export function flock(t: number, count: number, seed: string, width = 1920, height = 1080): FlockBird[] {
  return Array.from({ length: count }, (_, i) => {
    const depth = random(`${seed}d${i}`) ** 1.6;
    const speed = 160 + depth * 420;
    const span = width + 200;
    const x = ((random(`${seed}x${i}`) * span + t * speed) % span) - 100;
    const y = random(`${seed}y${i}`) * height + Math.sin(t * 1.2 + i) * 8 * depth;
    return { x, y, depth, phase: random(`${seed}p${i}`) * 6 };
  }).sort((a, b) => a.depth - b.depth);
}

export function FlockBirds({ birds, t, opacity = 1, toward }: { birds: FlockBird[]; t: number; opacity?: number; toward?: { point: Point; p: (i: number) => number } }) {
  return birds.map((b, i) => {
    const p = toward ? toward.p(i) : 0;
    if (p >= 1) return null;
    const x = lerp(b.x, toward?.point.x ?? 0, p);
    const y = lerp(b.y, toward?.point.y ?? 0, p);
    return (
      <Sprite
        key={i}
        x={x}
        y={y}
        size={(16 + b.depth * 44) * (1 - p * 0.6)}
        squash={flap(t, b.phase, 14)}
        color={depthColor(b.depth)}
        opacity={(0.35 + b.depth * 0.55) * opacity * (1 - p ** 4)}
      />
    );
  });
}
