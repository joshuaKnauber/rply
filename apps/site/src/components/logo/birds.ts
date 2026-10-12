export type Fill = "body" | "alt" | "beak" | "dark";
export type Part = { d: string; fill?: Fill };
export type Eye = { x: number; y: number; r: number };
export type Blush = { x: number; y: number; s?: number };
export type Bird = { label: string; note: string; pieces: Part[][]; eyes: Eye[]; blush: Blush[]; zoom?: number };

const f = (n: number) => n.toFixed(1);
const rad = (a: number) => (a * Math.PI) / 180;

function circle(cx: number, cy: number, r: number) {
  return `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}

function circleBubble(cx: number, cy: number, r: number, angle: number, spread = 13, reach = 1.32) {
  const pt = (a: number, k = 1) => `${f(cx + Math.cos(rad(a)) * r * k)} ${f(cy + Math.sin(rad(a)) * r * k)}`;
  const sweep = angle > 90 ? 0 : 1;
  const [a, b] = sweep === 0 ? [angle - spread, angle + spread] : [angle + spread, angle - spread];
  const towards = sweep === 0 ? 4 : -4;
  return `M${pt(a)}A${r} ${r} 0 1 ${sweep} ${pt(b)}Q${pt(angle + towards * 1.5, 1.08)} ${pt(angle + towards, reach)}Q${pt(angle - towards, 1.12)} ${pt(a)}Z`;
}

function rectBubble(x: number, y: number, w: number, h: number, rx: number, from: number, to: number, tip: [number, number]) {
  const b = y + h;
  return [
    `M${x + rx} ${y}H${x + w - rx}A${rx} ${rx} 0 0 1 ${x + w} ${y + rx}V${b - rx}A${rx} ${rx} 0 0 1 ${x + w - rx} ${b}`,
    `H${to}Q${to - 8} ${f(b + (tip[1] - b) * 0.55)} ${tip[0]} ${tip[1]}Q${from + 6} ${b + 8} ${from} ${b}`,
    `H${x + rx}A${rx} ${rx} 0 0 1 ${x} ${b - rx}V${y + rx}A${rx} ${rx} 0 0 1 ${x + rx} ${y}Z`,
  ].join("");
}

function beakDown(cx: number, cy: number, w: number, h: number) {
  return `M${f(cx - w / 2)} ${cy}Q${cx} ${f(cy - h * 0.25)} ${f(cx + w / 2)} ${cy}Q${f(cx + w * 0.22)} ${f(cy + h * 0.72)} ${cx} ${cy + h}Q${f(cx - w * 0.22)} ${f(cy + h * 0.72)} ${f(cx - w / 2)} ${cy}Z`;
}

function beakRight(x: number, y: number, len: number, h: number) {
  return `M${x} ${f(y - h / 2)}Q${f(x + len * 0.7)} ${f(y - h * 0.42)} ${x + len} ${y}Q${f(x + len * 0.7)} ${f(y + h * 0.42)} ${x} ${f(y + h / 2)}Z`;
}

const ORIGINAL =
  "M98.5728 24.1553C125.573 9.25532 156.273 -0.844261 196.073 0.0556508C230.973 -0.444349 260.974 10.8558 287.874 26.2558C314.473 41.5558 335.173 64.6555 351.173 90.1553C353.773 94.3551 357.573 96.7556 362.073 99.3555L434.173 141.556C439.173 144.456 441.573 147.556 441.573 151.256C441.573 155.456 438.973 159.056 433.874 162.056L374.173 197.256C366.673 201.656 364.473 205.956 364.073 213.256C362.473 252.556 349.673 286.156 316.573 314.855C294.873 334.755 271.273 350.155 240.673 356.655C222.173 360.655 203.073 361.255 182.073 360.855C174.573 360.656 171.173 362.756 165.374 367.756C147.774 380.356 119.873 398.755 91.4732 412.655C87.3732 414.655 84.2728 416.156 81.0728 416.056C73.2732 415.955 71.4734 409.055 74.1734 402.655L89.8736 364.855C91.5735 360.456 93.2732 356.055 93.4732 351.855C93.9731 344.956 92.2733 340.656 85.8736 337.056C74.4737 330.456 63.0735 321.256 53.8736 313.456C18.2737 284.956 1.27346 249.256 0.173359 207.456C-0.92664 178.356 3.17317 149.956 13.4732 122.556C30.3731 77.6557 57.4729 46.7553 98.5728 24.1553Z";

export const birds = {
  chick: {
    label: "Chick",
    note: "the bubble is the bird, facing you",
    pieces: [[{ d: circleBubble(220, 220, 172, 130, 15, 1.42) }, { d: beakDown(220, 232, 46, 36), fill: "beak" }]],
    eyes: [{ x: 160, y: 210, r: 25 }, { x: 280, y: 210, r: 25 }],
    blush: [{ x: 124, y: 258 }, { x: 316, y: 258 }],
  },
  peep: {
    label: "Peep",
    note: "side profile, round bubble, orange beak",
    pieces: [[{ d: circleBubble(200, 222, 168, 128, 15, 1.42) }, { d: beakRight(350, 200, 82, 58), fill: "beak" }]],
    eyes: [{ x: 288, y: 180, r: 27 }],
    blush: [{ x: 292, y: 244 }],
  },
  typing: {
    label: "Typing",
    note: "the … dots become eyes and beak",
    pieces: [[{ d: rectBubble(10, 86, 420, 264, 132, 112, 176, [42, 414]) }, { d: beakDown(220, 196, 58, 46), fill: "beak" }]],
    eyes: [{ x: 116, y: 218, r: 34 }, { x: 324, y: 218, r: 34 }],
    blush: [{ x: 112, y: 280 }, { x: 328, y: 280 }],
  },
  sayshi: {
    label: "Says hi",
    note: "chubby bird with its own speech bubble",
    pieces: [
      [
        { d: circle(165, 268, 138) },
        { d: beakRight(290, 258, 56, 46), fill: "beak" },
      ],
      [
        { d: rectBubble(250, 8, 186, 124, 52, 282, 318, [276, 182]) },
        { d: circle(300, 70, 12), fill: "dark" },
        { d: circle(343, 70, 12), fill: "dark" },
        { d: circle(386, 70, 12), fill: "dark" },
      ],
    ],
    eyes: [{ x: 228, y: 230, r: 22 }],
    blush: [{ x: 232, y: 282, s: 0.85 }],
  },
  peekaboo: {
    label: "Peekaboo",
    note: "a chick peeking over a typing bubble",
    pieces: [
      [{ d: circle(220, 168, 108) }, { d: beakDown(220, 166, 30, 24), fill: "beak" }],
      [
        { d: rectBubble(14, 196, 412, 190, 72, 92, 150, [38, 420]), fill: "alt" },
        { d: circle(140, 292, 20), fill: "dark" },
        { d: circle(220, 292, 20), fill: "dark" },
        { d: circle(300, 292, 20), fill: "dark" },
      ],
    ],
    eyes: [{ x: 182, y: 140, r: 19 }, { x: 258, y: 140, r: 19 }],
    blush: [{ x: 156, y: 172, s: 0.7 }, { x: 284, y: 172, s: 0.7 }],
  },
  duo: {
    label: "Duo",
    note: "you and your agent, two bubbles talking",
    pieces: [
      [{ d: circleBubble(348, 128, 84, 52), fill: "alt" }, { d: beakDown(348, 134, 22, 18), fill: "beak" }],
      [{ d: circleBubble(172, 258, 150, 130) }, { d: beakDown(184, 266, 38, 30), fill: "beak" }],
    ],
    eyes: [{ x: 132, y: 248, r: 22 }, { x: 236, y: 248, r: 22 }, { x: 320, y: 118, r: 12 }, { x: 376, y: 118, r: 12 }],
    blush: [{ x: 102, y: 290 }, { x: 266, y: 290 }, { x: 304, y: 142, s: 0.5 }, { x: 392, y: 142, s: 0.5 }],
  },
  original: {
    label: "Original",
    note: "today's bird, for comparison",
    pieces: [[{ d: ORIGINAL }]],
    eyes: [{ x: 255.5, y: 121, r: 35 }],
    blush: [{ x: 304, y: 190 }],
    zoom: 1,
  },
} satisfies Record<string, Bird>;

export type BirdKey = keyof typeof birds;
export const birdKeys = Object.keys(birds) as BirdKey[];
