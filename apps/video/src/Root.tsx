import "./style.css";
import { Composition } from "remotion";
import { Video } from "./Video.tsx";
import { DURATION, FPS } from "./timeline.ts";
import { HermesDemo, DURATION as HERMES_DURATION, FPS as HERMES_FPS } from "./hermes/HermesDemo.tsx";

export const Root = () => (
  <>
    <Composition id="rply" component={Video} durationInFrames={DURATION * FPS} fps={FPS} width={1920} height={1080} />
    <Composition id="hermes" component={HermesDemo} durationInFrames={Math.round(HERMES_DURATION * HERMES_FPS)} fps={HERMES_FPS} width={1920} height={1080} />
  </>
);
