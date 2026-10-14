import { tween } from "./anim.ts";
import { AGENT, LOG, T, type Line } from "./timeline.ts";

const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const spin = (t: number) => SPINNER[Math.floor(t * 12) % SPINNER.length];

function Command({ text }: { text: string }) {
  const [name, ...rest] = text.split(" ");
  return (
    <>
      <span className="text-brand-300">{name}</span> <span className="text-gray-200">{rest.join(" ")}</span>
    </>
  );
}

function Row({ line, t }: { line: Line; t: number }) {
  const p = tween(t, line.at, 0.4);
  const active = line.until !== undefined && t < line.until;
  const style = { opacity: p, transform: `translateY(${(1 - p) * 8}px)` };
  if (line.kind === "out") {
    return (
      <div className="flex-none truncate pl-5 text-gray-500" style={style}>
        ⎿ {active && <span className="text-brand-300">{spin(t)} </span>}
        <span className={line.until === undefined && line.text.includes("written") ? "text-gray-300" : ""}>{line.text}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-none gap-2.5" style={style}>
      <span className={`w-3 flex-none ${line.kind === "cmd" ? "text-brand-300" : "text-gray-400"}`}>{active ? spin(t) : "●"}</span>
      <span className={`truncate ${line.kind === "think" ? "text-gray-300" : ""}`}>
        {line.kind === "cmd" ? <Command text={line.text} /> : line.text}
      </span>
    </div>
  );
}

export function Agent({ t }: { t: number }) {
  const enter = tween(t, T.worldIn, 1);
  const lines = LOG.filter((l) => t >= l.at && !(l.kind === "out" && l.until !== undefined && t >= l.until));
  return (
    <div
      className="absolute flex flex-col overflow-hidden rounded-2xl bg-gray-950 font-mono text-[15px] leading-[1.75] shadow-[0_40px_80px_-24px_rgb(0_0_0/0.45),0_0_0_1px_rgb(0_0_0/0.4)]"
      style={{ ...AGENT, opacity: enter, transform: `translateY(${(1 - enter) * 60}px)` }}
    >
      <div className="relative flex h-10 flex-none items-center gap-1.5 border-b border-white/5 bg-gray-900 px-4 font-sans text-[13px]">
        <span className="size-2.5 rounded-full bg-gray-700" />
        <span className="size-2.5 rounded-full bg-gray-700" />
        <span className="size-2.5 rounded-full bg-gray-700" />
        <span className="absolute inset-x-0 text-center text-gray-400">seo-agent · exe.dev</span>
        <span className="ml-auto flex items-center gap-1.5 text-gray-500">
          <span className="size-1.5 rounded-full bg-emerald-400" /> running
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-5 pb-5" style={{ maskImage: "linear-gradient(transparent, black 64px)" }}>
        <div className="text-gray-500">Weekly SEO run for acme.dev</div>
        {lines.map((line, i) => (
          <Row key={i} line={line} t={t} />
        ))}
      </div>
    </div>
  );
}
