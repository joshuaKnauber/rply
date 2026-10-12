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
      favicon: "/favicon.svg",
      customCss: ["@fontsource-variable/inter/opsz.css", "@fontsource-variable/geist-mono", "./src/styles/docs.css"],
      components: {
        SiteTitle: "./src/components/docs/SiteTitle.astro",
        SocialIcons: "./src/components/docs/SocialIcons.astro",
        ThemeSelect: "./src/components/docs/ThemeSelect.astro",
      },
      expressiveCode: {
        themes: ["github-dark-default"],
        styleOverrides: {
          borderRadius: "0.75rem",
          borderColor: "transparent",
          codeBackground: "oklch(0.2 0.0015 80)",
          codeFontFamily: "'Geist Mono Variable', ui-monospace, monospace",
          codeFontSize: "0.8125rem",
          codeLineHeight: "1.7",
          frames: {
            shadowColor: "transparent",
            editorTabBarBackground: "oklch(0.16 0.0015 80)",
            editorActiveTabBackground: "oklch(0.2 0.0015 80)",
            terminalTitlebarBackground: "oklch(0.16 0.0015 80)",
            terminalBackground: "oklch(0.2 0.0015 80)",
          },
        },
      },
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
