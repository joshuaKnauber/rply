import { BIRD_COLORS, type AgentMood, type BirdLook } from "@rply/schema";

// Animated agent avatar: the rply bird driven by springs and a little physics.
// Actions only kick springs, so moves blend into each other and nothing snaps.

export type BirdState = AgentMood | "done";
export type Emote = "love" | "surprise" | "music" | "sparkle" | "spin";

const LOGO_HEAD =
  "M98.5728 24.1553C125.573 9.25532 156.273 -0.844261 196.073 0.0556508C230.973 -0.444349 260.974 10.8558 287.874 26.2558C314.473 41.5558 335.173 64.6555 351.173 90.1553C353.773 94.3551 357.573 96.7556 362.073 99.3555L434.173 141.556C439.173 144.456 441.573 147.556 441.573 151.256C441.573 155.456 438.973 159.056 433.874 162.056L374.173 197.256C366.673 201.656 364.473 205.956 364.073 213.256C362.473 252.556 349.673 286.156 316.573 314.855C294.873 334.755 271.273 350.155 240.673 356.655C222.173 360.655 203.073 361.255 182.073 360.855C174.573 360.656 171.173 362.756 165.374 367.756";
const LOGO_REST =
  "93.4732 351.855C93.9731 344.956 92.2733 340.656 85.8736 337.056C74.4737 330.456 63.0735 321.256 53.8736 313.456C18.2737 284.956 1.27346 249.256 0.173359 207.456C-0.92664 178.356 3.17317 149.956 13.4732 122.556C30.3731 77.6557 57.4729 46.7553 98.5728 24.1553Z";
type Point = [number, number];
const TAIL: [string, ...Point[]][] = [
  ["C", [147.774, 380.356], [119.873, 398.755], [91.4732, 412.655]],
  ["C", [87.3732, 414.655], [84.2728, 416.156], [81.0728, 416.056]],
  ["C", [73.2732, 415.955], [71.4734, 409.055], [74.1734, 402.655]],
  ["L", [89.8736, 364.855]],
  ["C", [91.5735, 360.456], [93.2732, 356.055]],
];
const ROOT_R: Point = [165.374, 367.756];
const ROOT_L: Point = [93.4732, 351.855];
const TAIL_PIVOT: Point = [(ROOT_R[0] + ROOT_L[0]) / 2, (ROOT_R[1] + ROOT_L[1]) / 2];

// the tail bends instead of being cut out: points rotate more the further they are from the root
const TAIL_WEIGHTS = (() => {
  const dx = ROOT_L[0] - ROOT_R[0], dy = ROOT_L[1] - ROOT_R[1], len = Math.hypot(dx, dy);
  return TAIL.map(([, ...pts]) =>
    pts.map(([x, y]) => {
      const t = Math.min(1, Math.abs(((x - ROOT_R[0]) * dy - (y - ROOT_R[1]) * dx) / len) / 55);
      return t * t * (3 - 2 * t);
    }),
  );
})();

function logoPath(tailDeg: number) {
  const a = (tailDeg * Math.PI) / 180;
  let d = LOGO_HEAD;
  TAIL.forEach(([cmd, ...pts], i) => {
    d += cmd;
    pts.forEach(([x, y], j) => {
      const w = a * TAIL_WEIGHTS[i]![j]!, c = Math.cos(w), s = Math.sin(w), ox = x - TAIL_PIVOT[0], oy = y - TAIL_PIVOT[1];
      d += `${(TAIL_PIVOT[0] + ox * c - oy * s).toFixed(2)} ${(TAIL_PIVOT[1] + ox * s + oy * c).toFixed(2)} `;
    });
  });
  return d + LOGO_REST;
}

const PIVOT: Point = [48, 86];
const EYE: Point = [56, 41.8];
const BEAK: Point = [89.5, 47.2];
const CHEEK: Point = [67, 53.5];
const GRAVITY = 900;
const INK = "#1f1d1b";

// lighter version of a color for the belly
const tint = (hex: string, t: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * t);
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`;
};

// crests and accessories in the logo's own coordinates (442 × 417, facing right)
function drawCrest(g: SVGGElement, crest: number, color: string) {
  if (crest === 1) for (const a of [-26, 0, 26]) el(g, "ellipse", { cx: 0, cy: -46, rx: 19, ry: 50, transform: `translate(200 40) rotate(${a})` });
  if (crest === 2) el(g, "path", { d: "M190 34 C178 -30 236 -72 266 -40 C280 -25 262 -2 244 -16", fill: "none", stroke: color, "stroke-width": 30, "stroke-linecap": "round" });
  if (crest === 3) el(g, "circle", { cx: 200, cy: 16, r: 40 });
  if (crest === 4) el(g, "path", { d: "M150 45 L162 -35 L195 15 L216 -60 L240 15 L272 -28 L272 55 Z", stroke: color, "stroke-width": 18, "stroke-linejoin": "round" });
  if (crest === 5) {
    el(g, "path", { d: "M215 30 Q218 -40 246 -78", fill: "none", stroke: color, "stroke-width": 14, "stroke-linecap": "round" });
    el(g, "circle", { cx: 250, cy: -86, r: 26 });
  }
}

function drawHat(g: SVGGElement, hat: number, accent: string) {
  const round = { stroke: accent, "stroke-width": 14, "stroke-linejoin": "round" };
  if (hat === 1) {
    el(g, "path", { d: "M140 42 L262 22 L212 -118 Z", fill: accent, ...round });
    for (const [x, y, r] of [[196, -6, 11], [222, -52, 9], [178, 22, 8]]) el(g, "circle", { cx: x!, cy: y!, r: r!, fill: "#fff", opacity: 0.7 });
    el(g, "circle", { cx: 212, cy: -124, r: 24, fill: "#fff" });
  }
  if (hat === 2) {
    el(g, "path", { d: "M118 58 C118 -48 300 -52 300 52 Z", fill: accent });
    el(g, "rect", { x: 108, y: 30, width: 202, height: 38, rx: 19, fill: accent });
    el(g, "rect", { x: 108, y: 30, width: 202, height: 38, rx: 19, fill: "#fff", opacity: 0.3 });
    el(g, "circle", { cx: 208, cy: -34, r: 28, fill: "#fff" });
  }
  if (hat === 3) {
    el(g, "path", { d: "M188 14 L128 -30 L132 48 Z M188 14 L250 -36 L248 50 Z", fill: accent, ...round });
    el(g, "circle", { cx: 188, cy: 14, r: 20, fill: accent });
    el(g, "circle", { cx: 188, cy: 14, r: 20, fill: "#000", opacity: 0.15 });
  }
  if (hat === 4) {
    el(g, "path", { d: "M200 168 C186 210 168 238 150 270", fill: "none", stroke: INK, "stroke-width": 6, "stroke-linecap": "round" });
    el(g, "circle", { cx: 258, cy: 121, r: 64, fill: "#fff", opacity: 0.25, stroke: INK, "stroke-width": 13 });
  }
  if (hat === 5) {
    el(g, "path", { d: "M171 122 C158 8 262 -36 304 40", fill: "none", stroke: INK, "stroke-width": 22, "stroke-linecap": "round" });
    el(g, "rect", { x: 138, y: 108, width: 66, height: 96, rx: 30, fill: accent });
  }
  if (hat === 6) {
    el(g, "path", { d: "M140 42 L150 -48 L190 2 L215 -70 L240 2 L280 -48 L286 42 Z", fill: accent, stroke: accent, "stroke-width": 12, "stroke-linejoin": "round" });
    el(g, "circle", { cx: 215, cy: 12, r: 14, fill: "#fff" });
  }
}

function drawScarf(clipped: SVGGElement, loose: SVGGElement, accent: string) {
  el(clipped, "path", { d: "M100 214 C190 252 282 250 360 200 L366 252 C282 302 180 298 96 262 Z", fill: accent });
  el(loose, "path", { d: "M150 252 L118 344 L176 340 L196 266 Z", fill: accent, stroke: accent, "stroke-width": 10, "stroke-linejoin": "round" });
}

const NOTE = `<path d="M-1.6 3.6 V-5 L4 -6.4 V2.4" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="-3.2" cy="3.8" r="2" fill="${INK}"/><circle cx="2.4" cy="2.6" r="2" fill="${INK}"/>`;

const EMOTE_ICONS: Record<Emote, string> = {
  love: `<path d="M0 4.5 C-6 0 -6.5 -4 -3.6 -5.2 C-1.8 -6 -0.6 -5 0 -3.8 C0.6 -5 1.8 -6 3.6 -5.2 C6.5 -4 6 0 0 4.5Z" fill="#ff5a5f"/>`,
  surprise: `<rect x="-1.4" y="-6" width="2.8" height="7.6" rx="1.4" fill="${INK}"/><circle cx="0" cy="4.2" r="1.6" fill="${INK}"/>`,
  music: NOTE,
  sparkle: `<path d="M0 -6.5 Q1 -1 6.5 0 Q1 1 0 6.5 Q-1 1 -6.5 0 Q-1 -1 0 -6.5Z" fill="#f5a524"/>`,
  spin: NOTE,
};

const pointer = { x: -1e4, y: -1e4 };
if (typeof addEventListener !== "undefined")
  addEventListener("pointermove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });
const NS = "http://www.w3.org/2000/svg";
const ABORT = Symbol("abort");
const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function el<K extends keyof SVGElementTagNameMap>(parent: Element, tag: K, attrs: Record<string, string | number> = {}) {
  const node = document.createElementNS(NS, tag);
  for (const k in attrs) node.setAttribute(k, String(attrs[k]));
  parent.appendChild(node);
  return node;
}

class Spring {
  x: number;
  t: number;
  v = 0;
  k: number;
  c: number;
  constructor(x: number, k: number, c: number) {
    this.x = this.t = x;
    this.k = k;
    this.c = c;
  }
  step(dt: number) {
    this.v += (-this.k * (this.x - this.t) - this.c * this.v) * dt;
    this.x += this.v * dt;
  }
}

const LEAN: Record<BirdState, number> = { idle: 0, working: 9, waiting: -5, done: -2, offline: 13 };
const OPEN: Record<BirdState, number> = { idle: 1, working: 0.72, waiting: 1, done: 1, offline: 0 };

type Timer = { at: number; res: () => void; rej: (e: unknown) => void };

const birds = new Set<Bird>();
let running = false;
let uid = 0;
let last = 0;
function loop(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  for (const bird of birds) if (bird.visible) bird.frame(dt);
  running = birds.size > 0;
  if (running) requestAnimationFrame(loop);
}

export class Bird {
  readonly svg: SVGSVGElement;
  visible = true;
  private state: BirdState;
  private group: Set<Bird> | undefined;
  private amp: number;
  private r: () => number;
  private s = {
    lean: new Spring(0, 40, 11),
    rot: new Spring(0, 240, 16),
    stretch: new Spring(0, 420, 11),
    flip: new Spring(1, 160, 19),
    crest: new Spring(0, 140, 6),
    tail: new Spring(0, 190, 7),
    lx: new Spring(0, 520, 34),
    ly: new Spring(0, 520, 34),
    open: new Spring(1, 120, 18),
    wide: new Spring(1, 300, 13),
    happy: new Spring(0, 140, 16),
    sleep: new Spring(0, 50, 13),
    dot: new Spring(0, 380, 13),
    gray: new Spring(0, 22, 10),
    bubble: new Spring(0, 320, 15),
  };
  private air = { y: 0, vy: 0, on: false, land: null as { res: () => void; rej: (e: unknown) => void } | null };
  private spin: { t: number; dur: number } | null = null;
  private look = { x: 0, y: 0 };
  private attention: { x: number; y: number; until: number } | null = null;
  private blinkT = -1;
  private nextBlink: number;
  private clock: number;
  private timers: Timer[] = [];
  private impatience = 0;
  private chirpT = 9;
  private tailAngle = NaN;
  private pokes: number[] = [];
  private follow: boolean;
  private lookCfg!: BirdLook;
  private body: SVGGElement;
  private crest: SVGGElement;
  private shape: SVGPathElement;
  private clip: SVGPathElement;
  private clipped: SVGGElement;
  private front: SVGGElement;
  private hat: SVGGElement;
  private eye: SVGRectElement;
  private pupil: SVGEllipseElement;
  private lashes: SVGPathElement;
  private cheek: SVGCircleElement;
  private happyEye: SVGPathElement;
  private sleepEye: SVGPathElement;
  private chirp: SVGGElement | null = null;
  private chirpLines: SVGLineElement[] = [];
  private dot: SVGCircleElement;
  private bubble: SVGGElement | null = null;
  private bubbleIcon: SVGGElement | null = null;
  private bubbleT = 9;

  constructor(opts: { look: BirdLook; size: number; state: BirdState; group?: Set<Bird>; dot?: boolean; follow?: boolean }) {
    let rs = Math.floor(Math.random() * 2 ** 31);
    this.r = () => ((rs = Math.imul(rs ^ (rs >>> 15), 2246822507) ^ Math.imul(rs ^ (rs >>> 13), 3266489909)) >>> 0) / 4294967296;
    this.amp = clamp((opts.size - 12) / 52, 0.3, 1);
    this.state = opts.state;
    this.group = opts.group;
    this.follow = opts.follow ?? false;
    this.clock = this.r() * 10;
    this.nextBlink = this.clock + 1 + this.r() * 3;

    this.svg = document.createElementNS(NS, "svg");
    this.svg.setAttribute("viewBox", "0 0 100 100");
    this.svg.setAttribute("aria-hidden", "true");
    this.svg.style.overflow = "visible";
    const clipId = `bird-${(uid = (uid + 1) % 1e9)}`;
    this.clip = el(el(el(this.svg, "defs"), "clipPath", { id: clipId }), "path");
    this.body = el(this.svg, "g");
    const logo = el(this.body, "g", { transform: "translate(10 20) scale(0.18)" });
    this.crest = el(logo, "g");
    this.shape = el(logo, "path");
    this.clipped = el(logo, "g", { "clip-path": `url(#${clipId})` });
    this.front = el(logo, "g");
    this.hat = el(logo, "g");
    this.cheek = el(this.body, "circle", { cx: CHEEK[0], cy: CHEEK[1], r: 3.8, fill: "#ff8fa3", opacity: 0.6 });
    this.eye = el(this.body, "rect", { fill: "#fff" });
    this.pupil = el(this.body, "ellipse", { fill: INK });
    this.lashes = el(this.body, "path", { fill: "none", stroke: "#fff", "stroke-width": 1.8, "stroke-linecap": "round" });
    this.happyEye = el(this.body, "path", { fill: "none", stroke: "#fff", "stroke-width": 3.8, "stroke-linecap": "round" });
    this.sleepEye = el(this.body, "path", { fill: "none", stroke: "#fff", "stroke-width": 3.4, "stroke-linecap": "round" });
    if (opts.size >= 24) {
      this.chirp = el(this.body, "g", { "stroke-width": 3, "stroke-linecap": "round", opacity: 0 });
      this.chirpLines = [0, 1, 2].map(() => el(this.chirp!, "line"));
    }
    if (opts.size >= 48) {
      this.bubble = el(this.svg, "g", { opacity: 0 });
      el(this.bubble, "path", { d: "M-10 -9 H10 A4 4 0 0 1 14 -5 V5 A4 4 0 0 1 10 9 H-2 L-7 14 L-6 9 H-10 A4 4 0 0 1 -14 5 V-5 A4 4 0 0 1 -10 -9Z", fill: "#fff", stroke: "rgb(0 0 0 / 0.1)", "stroke-width": 1 });
      this.bubbleIcon = el(this.bubble, "g");
    }
    const small = opts.size < 32;
    this.dot = el(this.svg, "circle", { cx: 90, cy: 14, r: small ? 15 : 8, fill: "var(--attention)", stroke: "var(--avatar-ring, var(--background))", "stroke-width": small ? 8 : 3.5 });
    if (opts.dot === false) this.dot.style.display = "none";

    this.setLook(opts.look);
    this.applyTargets(true);
    this.run(() => Promise.resolve());
    this.group?.add(this);
    birds.add(this);
    if (!running) {
      running = true;
      requestAnimationFrame((t) => ((last = t), loop(t)));
    }
  }

  destroy() {
    this.abort();
    birds.delete(this);
    this.group?.delete(this);
    this.svg.remove();
  }

  setLook(look: BirdLook) {
    const prev = this.lookCfg;
    this.lookCfg = look;
    const color = BIRD_COLORS[look.color]!, accent = BIRD_COLORS[look.accent]!;
    this.shape.setAttribute("fill", color);
    this.crest.setAttribute("fill", color);
    this.chirp?.setAttribute("stroke", color);
    for (const g of [this.crest, this.clipped, this.front, this.hat]) g.replaceChildren();
    drawCrest(this.crest, look.crest, color);
    if (look.belly) el(this.clipped, "ellipse", { cx: 215, cy: 292, rx: 128, ry: 82, fill: tint(color, 0.55) });
    if (look.hat === 7) drawScarf(this.clipped, this.front, accent);
    else drawHat(this.hat, look.hat, accent);
    this.cheek.style.display = look.cheeks ? "" : "none";
    this.tailAngle = NaN;
    if (prev && prev.crest !== look.crest) this.kick("crest", -500);
  }

  // a short reaction, then back to what the state does
  emote(kind: Emote) {
    this.run(async () => {
      const s = this.s;
      this.showBubble(kind);
      if (kind === "love") {
        s.happy.t = 1;
        await this.hop(150);
        await this.wait(0.7);
      }
      if (kind === "surprise") {
        s.wide.x = 1.4;
        this.kick("crest", -420);
        await this.hop(120, { crouch: 0.03 });
        await this.wait(0.4);
      }
      if (kind === "music") {
        for (let i = 0; i < 4; i++) {
          this.kick("rot", i % 2 ? 380 : -380);
          this.kick("tail", i % 2 ? -300 : 300);
          await this.wait(0.22);
        }
      }
      if (kind === "sparkle") {
        s.stretch.t = 0.12;
        this.look = { x: 0.2, y: -0.8 };
        await this.wait(0.45);
        s.stretch.t = 0;
        this.blinkT = 0;
        await this.wait(0.3);
      }
      if (kind === "spin") {
        s.happy.t = 1;
        s.stretch.t = -0.16;
        await this.wait(0.16);
        await this.hop(220, { spin: true, crouch: 0.02 });
        this.kick("tail", 500);
        await this.wait(0.6);
      }
      this.applyTargets(false);
    });
  }

  // a click: startle and hop; three in a row and it turns its back on you
  poke() {
    const now = this.clock;
    this.pokes = this.pokes.filter((t) => now - t < 2).concat(now);
    const grumpy = this.pokes.length >= 3;
    if (grumpy) this.pokes = [];
    this.run(async () => {
      const s = this.s;
      s.wide.x = 1.45;
      s.happy.t = 0;
      s.sleep.t = 0;
      s.open.t = 1;
      this.kick("crest", -420);
      if (!grumpy) this.showBubble("surprise");
      await this.hop(170, { crouch: 0.03 });
      if (grumpy) {
        s.flip.t = -1;
        this.look = { x: 0.6, y: 0.4 };
        await this.wait(1.6);
        s.flip.t = 1;
        await this.wait(0.3);
      } else await this.wait(0.5);
      this.applyTargets(false);
    });
  }

  private showBubble(kind: Emote) {
    if (!this.bubbleIcon) return;
    this.bubbleIcon.innerHTML = EMOTE_ICONS[kind];
    this.bubbleT = 0;
    this.s.bubble.x = 0;
    this.s.bubble.t = 1;
  }

  setState(next: BirdState) {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    this.impatience = 0;
    this.run(() => this.enter(prev));
  }

  // the agent sent a message: chirp, and the others in the channel glance over
  say() {
    if (this.state === "offline") return;
    this.chirpT = 0;
    this.kick("stretch", 4);
    this.kick("rot", -380);
    this.kick("crest", 300);
    if (!this.group) return;
    const me = this.svg.getBoundingClientRect();
    for (const other of this.group) {
      if (other === this || other.state === "offline" || !other.visible) continue;
      const o = other.svg.getBoundingClientRect();
      const dx = me.left - o.left, dy = me.top - o.top, d = Math.hypot(dx, dy) || 1;
      if (d > 600) continue;
      setTimeout(() => (other.attention = { x: dx / d, y: clamp(dy / d, -0.5, 0.5), until: other.clock + 1.4 }), 90 + other.r() * 220);
    }
  }

  private wait(sec: number) {
    return new Promise<void>((res, rej) => this.timers.push({ at: this.clock + sec, res, rej }));
  }

  private abort() {
    for (const t of this.timers) t.rej(ABORT);
    this.timers = [];
    this.air.land?.rej(ABORT);
    this.air.land = null;
  }

  private run(first: () => Promise<void>) {
    this.abort();
    (async () => {
      try {
        await first();
        for (;;) await this.behave();
      } catch (e) {
        if (e !== ABORT) throw e;
      }
    })();
  }

  private applyTargets(snap: boolean) {
    const s = this.s, st = this.state;
    s.lean.t = LEAN[st];
    s.open.t = OPEN[st];
    s.wide.t = st === "waiting" ? 1.12 : 1;
    s.happy.t = st === "done" ? 1 : 0;
    s.sleep.t = st === "offline" ? 1 : 0;
    s.dot.t = st === "waiting" ? 1 : 0;
    s.gray.t = st === "offline" ? 1 : 0;
    if (snap) for (const k of ["lean", "open", "wide", "happy", "sleep", "dot", "gray"] as const) s[k].x = s[k].t;
  }

  private kick(spring: keyof Bird["s"], v: number) {
    if (!reduced) this.s[spring].v += v * this.amp;
  }

  private async hop(v0: number, { spin = false, crouch = 0.1 } = {}) {
    if (reduced) return;
    const s = this.s;
    v0 *= Math.sqrt(this.amp);
    s.stretch.t = -0.14;
    await this.wait(crouch);
    s.stretch.t = 0;
    s.stretch.v += 5.5;
    s.crest.v += 160;
    this.air.vy = -v0;
    this.air.on = true;
    if (spin) this.spin = { t: 0, dur: (2 * v0) / GRAVITY };
    await new Promise<void>((res, rej) => (this.air.land = { res, rej }));
  }

  private async enter(prev: BirdState) {
    const s = this.s;
    if (prev === "offline") {
      s.sleep.t = 0;
      s.gray.t = 0;
      s.open.t = 1;
      s.wide.x = 1.35;
      for (let i = 0; i < 5; i++) {
        this.kick("rot", i % 2 ? 520 : -520);
        this.kick("crest", i % 2 ? -260 : 260);
        await this.wait(0.065);
      }
      await this.wait(0.15);
    }
    this.applyTargets(false);
    if (this.state === "working") {
      this.look = { x: 0.7, y: 0.6 };
      this.kick("rot", 260);
    }
    if (this.state === "waiting") {
      this.look = { x: -0.2, y: 0 };
      await this.hop(150);
    }
    if (this.state === "done") {
      s.happy.t = 0;
      s.stretch.t = -0.16;
      await this.wait(0.16);
      await this.hop(220, { spin: true, crouch: 0.02 });
      s.happy.t = 1;
      this.kick("tail", 500);
    }
    if (this.state === "offline") {
      s.sleep.t = 0;
      s.lean.t = 0;
      s.open.t = 0.35;
      s.stretch.t = 0.09;
      this.kick("crest", -120);
      await this.wait(0.9);
      s.stretch.t = 0;
      this.applyTargets(false);
    }
  }

  private async behave() {
    const r = this.r, s = this.s;
    if (this.state === "idle") {
      const roll = r();
      if (roll < 0.38) this.look = { x: r() * 2 - 1, y: r() * 1.4 - 0.7 };
      else if (roll < 0.48) {
        this.blinkT = 0;
        await this.wait(0.28);
        this.blinkT = 0;
      } else if (roll < 0.62) {
        this.kick("tail", 420);
        await this.wait(0.12);
        this.kick("tail", -380);
      } else if (roll < 0.69) await this.hop(110);
      else if (roll < 0.78) {
        s.flip.t = -1;
        this.look = { x: r() - 0.2, y: r() - 0.5 };
        await this.wait(1 + r() * 1.4);
        s.flip.t = 1;
      } else if (roll < 0.88) {
        s.rot.t = 26;
        this.look = { x: 0.3, y: 0.9 };
        await this.wait(0.3);
        for (let i = 0; i < 3; i++) {
          this.kick("rot", i % 2 ? 260 : -260);
          await this.wait(0.08);
        }
        await this.wait(0.15);
        s.rot.t = 0;
        this.look = { x: 0, y: 0 };
      } else if (roll < 0.96) {
        s.stretch.t = 0.12;
        s.rot.t = -6;
        this.kick("crest", -200);
        await this.wait(0.55);
        s.stretch.t = 0;
        s.rot.t = 0;
      } else this.look = { x: 0, y: 0 };
      await this.wait(0.8 + r() * 2.4);
    }
    if (this.state === "working") {
      const n = 3 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        this.look = { x: 0.45 + r() * 0.5, y: 0.55 + r() * 0.3 };
        this.kick("rot", 620 + r() * 200);
        this.kick("tail", -120);
        await this.wait(0.12 + r() * 0.07);
      }
      if (r() < 0.22) {
        this.look = { x: 0.1, y: -0.85 };
        s.rot.t = -10;
        await this.wait(0.9 + r() * 0.6);
        s.rot.t = 0;
      } else await this.wait(0.3 + r() * 0.8);
    }
    if (this.state === "waiting") {
      this.look = { x: -0.2, y: 0.05 };
      await this.wait(Math.max(0.6, 2.4 - this.impatience * 0.35) + r() * 0.6);
      await this.hop(120 + r() * 30);
      if (r() < 0.5) {
        await this.wait(0.05);
        await this.hop(100);
      }
      if (r() < 0.3) this.kick("tail", 400);
      this.impatience++;
    }
    if (this.state === "done") {
      await this.wait(1.2 + r() * 1.6);
      if (r() < 0.35) await this.hop(100);
      else
        for (let i = 0; i < 2; i++) {
          this.kick("rot", i ? 300 : -300);
          this.kick("tail", 300);
          await this.wait(0.14);
        }
    }
    if (this.state === "offline") {
      await this.wait(2.5 + r() * 3);
      if (r() < 0.6) {
        this.kick("rot", 140);
        this.kick("crest", 120);
      } else {
        s.stretch.t = 0.035;
        await this.wait(1.2);
        s.stretch.t = 0;
      }
    }
  }

  frame(dt: number) {
    this.clock += dt;
    const s = this.s, a = this.air;
    const due = this.timers.filter((t) => t.at <= this.clock);
    this.timers = this.timers.filter((t) => t.at > this.clock);
    for (const t of due) t.res();

    let watching = this.attention && this.attention.until > this.clock ? this.attention : this.look;
    if (this.follow && this.state !== "offline") {
      const r = this.svg.getBoundingClientRect();
      const dx = pointer.x - (r.left + r.width / 2), dy = pointer.y - (r.top + r.height * 0.4), d = Math.hypot(dx, dy);
      if (d > 0 && d < 520) watching = { x: (dx / d) * Math.min(1, d / 140), y: (dy / d) * Math.min(1, d / 140) };
    }
    const facing = s.flip.x >= 0 ? 1 : -1;
    s.lx.t = watching.x * facing;
    s.ly.t = watching.y;

    // follow-through: crest and tail chase the body's motion
    s.crest.t = clamp(a.vy * 0.05 - s.rot.v * 0.03 - s.stretch.v * 4, -28, 28);
    s.tail.t = clamp(-a.vy * 0.05 + s.rot.v * 0.03, -18, 18);

    const steps = Math.ceil(dt * 240);
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      for (const k in s) s[k as keyof typeof s].step(h);
      if (a.on) {
        a.vy += GRAVITY * h;
        a.y += a.vy * h;
        if (a.y >= 0) {
          this.kick("stretch", -Math.min(4.2, a.vy * 0.02));
          this.kick("tail", 180);
          const land = a.land;
          Object.assign(a, { y: 0, vy: 0, on: false, land: null });
          land?.res();
        }
      }
    }
    s.tail.x = clamp(s.tail.x, -22, 22);

    let spin = 0;
    if (this.spin) {
      this.spin.t += dt;
      const p = clamp(this.spin.t / this.spin.dur, 0, 1);
      spin = -360 * (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
      if (p >= 1) this.spin = null;
    }

    // blink: fast close, slower open
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.2) this.blinkT = -1;
    } else if (this.clock > this.nextBlink) {
      this.blinkT = 0;
      this.nextBlink = this.clock + 1.6 + this.r() * 4;
    }
    const bt = this.blinkT;
    const shut = bt < 0 ? 0 : bt < 0.06 ? (bt / 0.06) ** 2 : bt < 0.08 ? 1 : 1 - ((bt - 0.08) / 0.12) ** 0.6;

    const asleep = this.state === "offline";
    const breathe = reduced ? 0 : Math.sin(this.clock * (asleep ? 1.3 : 2.3)) * (asleep ? 0.028 : 0.014);
    const sway = reduced ? 0 : Math.sin(this.clock * 0.9) * 1.2;
    const sy = 1 + s.stretch.x * this.amp + breathe;
    const sx = 1 - (sy - 1) * 0.75;
    const rot = s.lean.x + s.rot.x * this.amp + sway;
    const flip = Math.abs(s.flip.x) < 0.04 ? 0.04 * Math.sign(s.flip.x || 1) : s.flip.x;
    const y = a.y * this.amp;
    this.body.setAttribute(
      "transform",
      `translate(0 ${y.toFixed(2)}) rotate(${spin.toFixed(1)} 48 58) translate(${PIVOT[0]} ${PIVOT[1]}) rotate(${rot.toFixed(2)}) scale(${(sx * flip).toFixed(3)} ${sy.toFixed(3)}) translate(${-PIVOT[0]} ${-PIVOT[1]})`,
    );
    this.crest.setAttribute("transform", `rotate(${(s.crest.x * this.amp).toFixed(2)} 205 44)`);
    this.hat.setAttribute("transform", `rotate(${(s.crest.x * this.amp * 0.35).toFixed(2)} 205 40)`);
    const tailAngle = s.tail.x * this.amp;
    if (!(Math.abs(tailAngle - this.tailAngle) < 0.05)) {
      this.tailAngle = tailAngle;
      const d = logoPath(tailAngle);
      this.shape.setAttribute("d", d);
      this.clip.setAttribute("d", d);
    }

    const wide = Math.max(0.6, s.wide.x);
    const style = this.lookCfg.eyes;
    const shiny = style === 2;
    const ex = EYE[0] + s.lx.x * (shiny ? 2.5 : 4.6), ey = EYE[1] + s.ly.x * (shiny ? 2.2 : 4.2);
    const [baseW, baseH] = style === 1 ? [13, 13] : shiny ? [17, 17] : [11.5, 18];
    const ew = baseW * wide * (1 - 0.14 * Math.abs(s.lx.x));
    const openness = clamp(s.open.x, 0, 1.2) * (1 - shut * 0.9);
    const eh = Math.max(ew * 0.4, baseH * wide * openness);
    const eyeOpacity = clamp(1 - Math.max(s.happy.x, s.sleep.x) * 1.6, 0, 1);
    this.eye.setAttribute("x", (ex - ew / 2).toFixed(2));
    this.eye.setAttribute("y", (ey - eh / 2).toFixed(2));
    this.eye.setAttribute("width", ew.toFixed(2));
    this.eye.setAttribute("height", eh.toFixed(2));
    this.eye.setAttribute("rx", (Math.min(ew, eh) / 2).toFixed(2));
    this.eye.setAttribute("opacity", String(eyeOpacity));
    this.pupil.setAttribute("opacity", String(shiny ? eyeOpacity * clamp(eh / baseH * 2 - 0.4, 0, 1) : 0));
    if (shiny) {
      this.pupil.setAttribute("cx", (ex + s.lx.x * 3.4).toFixed(2));
      this.pupil.setAttribute("cy", (ey + s.ly.x * 3).toFixed(2));
      this.pupil.setAttribute("rx", (5.4 * wide).toFixed(2));
      this.pupil.setAttribute("ry", Math.max(0.5, 5.4 * wide * Math.min(1, eh / (baseH * wide))).toFixed(2));
    }
    this.lashes.setAttribute("opacity", String(style === 3 ? eyeOpacity : 0));
    if (style === 3) {
      const top = ey - eh / 2;
      this.lashes.setAttribute("d", `M${ex + 2.5} ${top + 1.5} l2.6 -3.6 M${ex + 5} ${top + 3.6} l3.4 -2.6`);
    }
    this.happyEye.setAttribute("d", `M${ex - 6} ${ey + 3} Q${ex} ${ey - 6 * s.happy.x} ${ex + 6} ${ey + 3}`);
    this.happyEye.setAttribute("opacity", String(clamp(s.happy.x * 1.4 - 0.3, 0, 1)));
    this.sleepEye.setAttribute("d", `M${ex - 6} ${ey} Q${ex} ${ey + 5} ${ex + 6} ${ey}`);
    this.sleepEye.setAttribute("opacity", String(clamp(s.sleep.x * 1.4 - 0.3, 0, 1) * (1 - s.happy.x)));

    if (this.chirp) {
      this.chirpT += dt;
      const p = this.chirpT / 0.5;
      this.chirp.setAttribute("opacity", String(p < 1 ? 1 - p * p : 0));
      if (p < 1)
        this.chirpLines.forEach((line, i) => {
          const ang = ((i - 1) * 34 * Math.PI) / 180, r0 = 5 + p * 10, r1 = r0 + 6 * (1 - p * 0.6);
          line.setAttribute("x1", String(BEAK[0] + Math.cos(ang) * r0));
          line.setAttribute("y1", String(BEAK[1] + Math.sin(ang) * r0));
          line.setAttribute("x2", String(BEAK[0] + Math.cos(ang) * r1));
          line.setAttribute("y2", String(BEAK[1] + Math.sin(ang) * r1));
        });
    }
    if (this.bubble) {
      this.bubbleT += dt;
      if (this.bubbleT > 1.3) s.bubble.t = 0;
      const b = Math.max(0, s.bubble.x);
      this.bubble.setAttribute("opacity", String(clamp(b * 1.5, 0, 1)));
      this.bubble.setAttribute("transform", `translate(78 ${(6 - Math.min(this.bubbleT, 1.3) * 3).toFixed(2)}) scale(${(b * 0.95).toFixed(3)})`);
    }
    const pulse = 1 + Math.sin(this.clock * 4) * 0.06 * clamp(s.dot.x, 0, 1);
    this.dot.setAttribute("transform", `translate(90 14) scale(${(Math.max(0, s.dot.x) * pulse).toFixed(3)}) translate(-90 -14)`);
    const g = clamp(s.gray.x, 0, 1);
    this.svg.style.filter = g > 0.01 ? `grayscale(${(g * 0.9).toFixed(2)}) opacity(${(1 - g * 0.35).toFixed(2)})` : "";
  }
}
