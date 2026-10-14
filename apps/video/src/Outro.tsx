import { AbsoluteFill, spring, staticFile, useVideoConfig } from "remotion";
import { siClaude, siCursor, siGithubactions, siGnubash, siGooglegemini, siN8n, siRaycast, siReplit, siWarp, siZedindustries } from "simple-icons";
import { inOut, tween } from "./anim.ts";
import { FlockBirds, Flights, flock } from "./Birds.tsx";
import { Icon } from "./icons.tsx";
import { T, type Flight } from "./timeline.ts";
import { Lockup, Words } from "./Titles.tsx";

type Tile = { path?: string; src?: string; bg: string; fg?: string };

const TILES: Tile[] = [
  { path: siClaude.path, bg: "#D97757", fg: "#fff" },
  { src: "logos/openai.svg", bg: "#fff" },
  { path: siCursor.path, bg: "#0c0c0c", fg: "#fff" },
  { path: siGooglegemini.path, bg: "#fff", fg: "#8E75B2" },
  { path: siGithubactions.path, bg: "#2088FF", fg: "#fff" },
  { path: siGnubash.path, bg: "#1f1f1f", fg: "#4EAA25" },
  { src: "logos/openclaw.svg", bg: "#fff" },
  { path: siReplit.path, bg: "#F26207", fg: "#fff" },
  { path: siWarp.path, bg: "#01A4FF", fg: "#fff" },
  { path: siZedindustries.path, bg: "#084CCF", fg: "#fff" },
  { path: siN8n.path, bg: "#EA4B71", fg: "#fff" },
  { path: siRaycast.path, bg: "#FF6363", fg: "#fff" },
];

const CENTER = { x: 960, y: 470 };
const position = (i: number) => {
  const a = (i / TILES.length) * Math.PI * 2 - Math.PI / 2 + 0.26;
  return { x: CENTER.x + Math.cos(a) * 720, y: CENTER.y + 40 + Math.sin(a) * 360 };
};
const FLIGHTS: Flight[] = TILES.map((_, i) => ({ from: position(i), to: CENTER, at: T.ring + 0.9 + i * 0.09, dur: 0.9, arc: 80 }));

export function Outro({ t }: { t: number }) {
  const { fps } = useVideoConfig();
  if (t < T.ring - 0.2) return null;
  const scatter = tween(t, T.lockup - 0.2, 0.9, inOut);
  const landed = FLIGHTS.reduce((sum, f) => sum + Math.sin(Math.PI * tween(t, f.at + f.dur, 0.3, (x) => x)), 0);
  const row = tween(t, T.lockup + 1.5, 0.8);
  return (
    <AbsoluteFill>
      <div style={{ opacity: tween(t, T.lockup, 1.5) * 0.45 }}>
        <FlockBirds birds={flock(t, 30, "outro")} t={t} />
      </div>
      {TILES.map((tile, i) => {
        const pos = position(i);
        const pop = spring({ frame: (t - T.ring - 0.1 - i * 0.06) * fps, fps, config: { damping: 13 } });
        const dx = (pos.x - CENTER.x) * scatter * 0.5;
        const dy = (pos.y - CENTER.y) * scatter * 0.5;
        return (
          <span
            key={i}
            className="absolute grid size-[96px] place-items-center rounded-[22%] shadow-[0_1px_2px_rgb(0_0_0/0.06),0_14px_30px_-14px_rgb(0_0_0/0.35)] ring-1 ring-black/5"
            style={{
              left: pos.x - 48 + dx,
              top: pos.y - 48 + dy,
              background: tile.bg,
              opacity: 1 - scatter,
              transform: `scale(${pop * (1 - scatter * 0.3)})`,
            }}
          >
            {tile.path ? (
              <svg viewBox="0 0 24 24" className="size-12" fill={tile.fg}>
                <path d={tile.path} />
              </svg>
            ) : (
              <img src={staticFile(tile.src!)} className="size-12 object-contain" />
            )}
          </span>
        );
      })}
      <Flights t={t} flights={FLIGHTS} />
      <div className="absolute inset-x-0 flex justify-center" style={{ top: CENTER.y - 62 }}>
        <Lockup t={t} start={T.ring} textAt={T.lockup + 0.3} scale={1 + landed * 0.05} />
      </div>
      <div
        className="absolute inset-x-0 text-center"
        style={{ top: CENTER.y + 120, opacity: 1 - scatter, filter: `blur(${scatter * 8}px)` }}
      >
        <Words t={t} from={T.ring + 2.2} strong="One inbox for all your agents." size={52} />
      </div>
      {scatter > 0 && (
        <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: CENTER.y + 120 }}>
          <Words t={t} from={T.lockup + 0.8} strong="" soft="Agent notifications made easy." size={44} />
          <div
            className="mt-10 flex items-center gap-7 text-[24px] text-gray-600"
            style={{ opacity: row, transform: `translateY(${(1 - row) * 12}px)`, filter: `blur(${(1 - row) * 6}px)` }}
          >
            <span className="rounded-full bg-gray-950 px-5 py-2 font-medium text-white shadow-[0_12px_30px_-12px_rgb(0_0_0/0.5)]">app.rply.sh</span>
            {["Free to start", "Open source", "Self-hostable"].map((label) => (
              <span key={label} className="flex items-center gap-2">
                <Icon name="check" className="size-5 text-brand-500" /> {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}
