import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://rply.sh",
  redirects: { "/docs": "/docs/start/introduction/" },
  vite: { plugins: [tailwindcss()] },
  integrations: [
    starlight({
      title: "rply docs",
      logo: { src: "./src/assets/logo.svg" },
      customCss: ["@fontsource-variable/inter", "./src/styles/docs.css"],
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/joshuaKnauber/rply" }],
      sidebar: [
        { label: "Start here", items: [{ autogenerate: { directory: "docs/start" } }] },
        { label: "Concepts", items: [{ autogenerate: { directory: "docs/concepts" } }] },
        { label: "CLI", items: [{ autogenerate: { directory: "docs/cli" } }] },
        { label: "Blocks", items: [{ autogenerate: { directory: "docs/blocks" } }] },
        { label: "Agents", items: [{ autogenerate: { directory: "docs/agents" } }] },
        { label: "Apps", items: [{ autogenerate: { directory: "docs/apps" } }] },
        { label: "Self-hosting", items: [{ autogenerate: { directory: "docs/self-hosting" } }] },
        { label: "Security", items: [{ autogenerate: { directory: "docs/security" } }] },
        { label: "Reference", items: [{ autogenerate: { directory: "docs/reference" } }] },
      ],
    }),
  ],
});
