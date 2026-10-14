import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLlmsTxt from "starlight-llms-txt";

const sections = [
  ["Get started", "start", "what rply is, the quickstart, and setting up an agent so it runs on its own"],
  ["Guides", "guides", "how to send updates, ask questions, keep a status, take instructions, request secrets, share files, build apps and use rply in scripts"],
  ["Concepts", "concepts", "how rply works, channels and accounts, the life of a message, and security"],
  ["Self-hosting", "self-hosting", "running your own rply server with Docker, Railway, exe.dev, Fly.io or Render, configuration and upgrades"],
  ["Reference", "reference", "every CLI command, CLI configuration, block types, the HTML bridge, the HTTP API and the FAQ"],
];
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://rply.sh",
  redirects: { "/docs": "/docs/start/introduction/" },
  vite: { plugins: [tailwindcss()] },
  integrations: [
    starlight({
      title: "rply docs",
      description: "Docs for rply, an inbox for agents that run without you: updates, questions, dashboards and secrets from any AI agent, with a CLI, web and mobile apps and a self-hostable server.",
      head: [
        { tag: "script", attrs: { defer: true, "data-domain": "rply.sh", src: "https://nudge-events.up.railway.app/js/script.js" } },
        { tag: "link", attrs: { rel: "alternate", type: "text/plain", title: "llms.txt", href: "/llms.txt" } },
        { tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" } },
        { tag: "meta", attrs: { property: "og:image", content: "https://rply.sh/og.png" } },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        { tag: "meta", attrs: { name: "twitter:image", content: "https://rply.sh/og.png" } },
      ],
      plugins: [
        starlightLlmsTxt({
          projectName: "rply",
          description:
            "rply connects AI agents that run on their own (on a server, in a sandbox, on a schedule) to the people they work for. Agents use the `rply` CLI to send push notifications, ask questions and wait for the answer, keep a live status, and request API keys that are written straight to a file. People answer in the web app or on their phone. Use the hosted app at https://app.rply.sh or self-host it (open source, one Docker container).",
          details: [
            "- Quickest start for an agent: `npm install --global @rply/cli`, then `rply init https://app.rply.sh --name \"<a name for you>\"`, show the human the claim link it prints, then run `rply guide setup` and follow it.",
            "- The CLI has a built-in guide written for agents: `rply guide <topic>` with the topics setup, basics, ask, blocks, html, pins, apps, secrets and files (`rply guide all` prints everything but setup).",
            "- Every docs page is also available as Markdown: add `.md` to its URL, e.g. https://rply.sh/docs/start/quickstart.md.",
            "- Each documentation section below has its own file; the complete and abridged files contain all of them.",
          ].join("\n"),
          customSets: sections.map(([label, dir, description]) => ({ label, description, paths: [`docs/${dir}/**`] })),
          optionalLinks: [
            { label: "rply.sh", url: "https://rply.sh", description: "the homepage: features, supported agents and setup options" },
            { label: "app.rply.sh", url: "https://app.rply.sh", description: "the hosted web app where people read and answer their agents" },
            { label: "GitHub", url: "https://github.com/joshuaKnauber/rply", description: "source code for the server, CLI, web and mobile apps" },
            { label: "npm: @rply/cli", url: "https://www.npmjs.com/package/@rply/cli", description: "the CLI package" },
          ],
        }),
      ],
      favicon: "/favicon.svg",
      customCss: ["@fontsource-variable/inter/opsz.css", "@fontsource-variable/geist-mono", "./src/styles/docs.css"],
      components: {
        Head: "./src/components/docs/Head.astro",
        Header: "./src/components/docs/Header.astro",
        PageTitle: "./src/components/docs/PageTitle.astro",
        SiteTitle: "./src/components/docs/SiteTitle.astro",
        SocialIcons: "./src/components/docs/SocialIcons.astro",
        ThemeSelect: "./src/components/docs/ThemeSelect.astro",
      },
      expressiveCode: {
        themes: ["github-dark-default"],
        styleOverrides: {
          borderRadius: "0.75rem",
          borderColor: "transparent",
          codeBackground: "oklch(0.16 0.0015 80)",
          codeFontFamily: "'Geist Mono Variable', ui-monospace, monospace",
          codeFontSize: "0.8125rem",
          codeLineHeight: "1.7",
          frames: {
            shadowColor: "transparent",
            editorTabBarBackground: "oklch(0.13 0.0015 80)",
            editorActiveTabBackground: "oklch(0.16 0.0015 80)",
            terminalTitlebarBackground: "oklch(0.13 0.0015 80)",
            terminalBackground: "oklch(0.16 0.0015 80)",
          },
        },
      },
      sidebar: sections.map(([label, dir]) => ({ label, items: [{ autogenerate: { directory: `docs/${dir}` } }] })),
    }),
  ],
});
