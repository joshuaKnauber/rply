import { Easing, interpolate } from "remotion";

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

export const tween = (t: number, start: number, dur = 0.5, easing = ease) =>
  interpolate(t, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export const typed = (text: string, t: number, start: number, cps: number) =>
  text.slice(0, Math.max(0, Math.floor((t - start) * cps)));

export type Point = { x: number; y: number };
export type Move<P> = P & { at: number; dur: number };

export function path<P extends Record<string, number>>(t: number, start: P, moves: Move<P>[]): P {
  let value = start;
  for (const { at, dur, ...target } of moves) {
    const p = tween(t, at, dur, inOut);
    if (p <= 0) break;
    value = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, lerp(v, (target as Record<string, number>)[k], p)])) as P;
  }
  return value;
}

export const press = (t: number, at: number) => 1 - 0.14 * Math.sin(Math.PI * tween(t, at - 0.08, 0.2, (x) => x));

export const blink = (t: number) => (Math.floor(t * 2) % 2 === 0 ? 1 : 0);
