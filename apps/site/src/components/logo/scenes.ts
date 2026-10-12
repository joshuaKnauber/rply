export type Material = "puffy" | "night" | "glaze" | "clay" | "felt" | "pin" | "paper" | "deboss" | "glow";

type Scene = { label: string; bird: string; mat: Material; scale: number; x: number; y: number; ground?: boolean };

export const scenes = {
  jelly: { label: "Jelly", bird: "#fff", mat: "puffy", scale: 0.62, x: 119, y: 112 },
  sky: { label: "Sky", bird: "#fff", mat: "puffy", scale: 0.6, x: 123, y: 112 },
  meadow: { label: "Meadow", bird: "#fff", mat: "puffy", scale: 0.54, x: 137, y: 178, ground: true },
  night: { label: "Night", bird: "#fff", mat: "night", scale: 0.6, x: 128, y: 116 },
  papercut: { label: "Papercut", bird: "#7f8cff", mat: "paper", scale: 0.54, x: 137, y: 92 },
  airmail: { label: "Airmail", bird: "#6f7ef6", mat: "deboss", scale: 0.54, x: 86, y: 160 },
  ceramic: { label: "Ceramic", bird: "#4f63e0", mat: "glaze", scale: 0.56, x: 132, y: 120 },
  felt: { label: "Felt", bird: "#8f9bff", mat: "felt", scale: 0.56, x: 132, y: 120 },
  pin: { label: "Enamel pin", bird: "#9aa5ff", mat: "pin", scale: 0.52, x: 141, y: 124 },
  clay: { label: "Clay", bird: "#8e9aff", mat: "clay", scale: 0.58, x: 124, y: 122 },
  crt: { label: "CRT", bird: "#c3caff", mat: "glow", scale: 0.54, x: 137, y: 132 },
} satisfies Record<string, Scene>;

export type SceneKey = keyof typeof scenes;
export const sceneKeys = Object.keys(scenes) as SceneKey[];
