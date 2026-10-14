import { AbsoluteFill, Easing, random } from "remotion";
import { inOut, tween } from "./anim.ts";
import { FlockBirds, flock } from "./Birds.tsx";
import { T } from "./timeline.ts";
import { Lockup, Words } from "./Titles.tsx";

const CENTER = { x: 960, y: 470 };

export function Intro({ t }: { t: number }) {
  if (t > T.introOut + 0.7) return null;
  const out = tween(t, T.introOut, 0.6, inOut);
  const converge = (i: number) => tween(t, 1.0 + random(`c${i}`) * 0.6, 0.8, Easing.in(Easing.cubic));
  return (
    <AbsoluteFill>
      <FlockBirds birds={flock(t, 46, "intro")} t={t} toward={{ point: CENTER, p: converge }} />
      <AbsoluteFill
        className="items-center"
        style={{ opacity: 1 - out, transform: `scale(${1 + out * 0.15})`, filter: `blur(${out * 12}px)` }}
      >
        <div className="absolute flex justify-center" style={{ top: CENTER.y - 62 }}>
          <Lockup t={t} start={T.logoPop} textAt={T.logoPop + 0.45} />
        </div>
        <div className="absolute text-center" style={{ top: CENTER.y + 110 }}>
          <Words t={t} from={T.logoPop + 0.9} strong="" soft="Agent notifications made easy." size={44} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
