import "./style.css";
import { Composition } from "remotion";
import { Video } from "./Video.tsx";
import { DURATION, FPS } from "./timeline.ts";

export const Root = () => (
  <Composition id="rply" component={Video} durationInFrames={DURATION * FPS} fps={FPS} width={1920} height={1080} />
);
