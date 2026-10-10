import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/rply.js",
  bundle: true,
  minify: true,
  platform: "node",
  format: "esm",
  target: "node20",
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
