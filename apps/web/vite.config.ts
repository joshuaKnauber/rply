import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // keep the Host header, so the server sees the same origin as the browser (sign-in checks it)
  server: { proxy: { "/v1": { target: "http://localhost:8080", changeOrigin: false } } },
});
