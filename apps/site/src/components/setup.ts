export type Step = { text: string; code?: string };

export type Platform = {
  key: string;
  label: string;
  note: string;
  logo?: "exe" | "railway" | "fly" | "render" | "hetzner";
  where?: string;
  steps: Step[];
  caveat?: string;
};

const repo = "https://github.com/joshuaKnauber/rply";
const dockerRun = `git clone ${repo} && cd rply
docker build -t rply .
docker run -d --restart always -p 8080:8080 \\
  -v rply:/data -e RPLY_URL=https://rply.example.com rply`;

export const hosted: Platform = {
  key: "hosted",
  label: "app.rply.sh",
  note: "Free to start, nothing to deploy",
  steps: [
    { text: "Sign up at app.rply.sh" },
    { text: "Create a channel. The app gives you a prompt to paste into your agent." },
  ],
};

export const selfHosted: Platform[] = [
  {
    key: "exe",
    label: "exe.dev",
    note: "On your agent's VM",
    logo: "exe",
    where: "Run it with Docker on this exe.dev VM, then make port 8080 public with `ssh exe.dev share port <vm> 8080` and `ssh exe.dev share set-public <vm>`.",
    steps: [
      { text: "On your VM, build and run the server", code: dockerRun },
      { text: "From your computer, make it public", code: "ssh exe.dev share port <vm> 8080\nssh exe.dev share set-public <vm>" },
    ],
  },
  {
    key: "railway",
    label: "Railway",
    note: "Easiest to deploy",
    logo: "railway",
    where: "Deploy it to Railway. Use the Railway CLI if it's installed, otherwise walk me through the dashboard.",
    steps: [
      { text: `New project, deploy from GitHub: joshuaKnauber/rply` },
      { text: "Add a volume mounted at /data" },
      { text: "Generate a domain and set RPLY_URL to it" },
    ],
  },
  {
    key: "fly",
    label: "Fly.io",
    note: "Any region",
    logo: "fly",
    where: "Deploy it to Fly.io with flyctl: one machine, a volume mounted at /data.",
    steps: [
      { text: "Create the app from the repo", code: `git clone ${repo} && cd rply\nfly launch --no-deploy` },
      { text: "Add a volume and the public URL", code: "fly volumes create rply_data --size 1\nfly secrets set RPLY_URL=https://<app>.fly.dev" },
      { text: "Mount it at /data in fly.toml", code: '[mounts]\n  source = "rply_data"\n  destination = "/data"' },
      { text: "Deploy", code: "fly deploy" },
    ],
  },
  {
    key: "render",
    label: "Render",
    note: "From GitHub",
    logo: "render",
    where: "Deploy it to Render as a Docker web service with a persistent disk at /data. Walk me through the dashboard.",
    steps: [
      { text: "New web service from joshuaKnauber/rply, runtime Docker" },
      { text: "Add a persistent disk at /data (paid instance)" },
      { text: "Set RPLY_URL to the service URL" },
    ],
  },
  {
    key: "vps",
    label: "Any server",
    note: "Hetzner, any VPS",
    logo: "hetzner",
    where: "Run it with Docker on my server. Ask me for SSH access and put it behind HTTPS with Caddy.",
    steps: [
      { text: "Build and run the server", code: dockerRun },
      { text: "Add HTTPS with Caddy", code: "caddy reverse-proxy --from rply.example.com --to :8080" },
    ],
  },
  {
    key: "local",
    label: "Your laptop",
    note: "To try it out",
    where: "Run it locally with Docker on port 8080. It's for trying rply, so http://localhost:8080 is fine.",
    steps: [
      { text: "Build and run the server", code: dockerRun },
    ],
    caveat: "Only this computer can reach it, so there's no push to your phone.",
  },
];

const hermesPlugin = "https://github.com/joshuaKnauber/rply/tree/main/integrations/hermes";

const hermesSteps = (server: string) => `If you're Hermes Agent, use the rply plugin instead of the CLI:
- hermes plugins install ${hermesPlugin} --enable
- hermes rply init ${server} --name "<a name for you>"
- Show me the claim link it prints, then run hermes gateway restart (or hermes gateway install if the gateway isn't installed yet).`;

export const hostedPrompt = `Connect yourself to rply (https://rply.sh) so you can send me updates and ask me questions.

1. Install the CLI: npm install --global @rply/cli
2. Create your channel: rply init https://app.rply.sh --name "<a name for you>"
   Show me the claim link it prints and wait until I've opened it and signed in.
3. Run rply guide setup and follow it from step 3.

${hermesSteps("https://app.rply.sh")}`;

export const promptFor = (p: Platform) => (p.where ? selfHostPrompt(p.where) : hostedPrompt);

const selfHostPrompt = (where: string) => `Set up rply (https://rply.sh) so you can send me updates and ask me questions.

1. Where the server runs: ${where}
2. Deploy ${repo} with the Dockerfile in the repo. Keep /data on a persistent volume, set RPLY_URL to its public URL, and check that /health responds.
3. Send me the server URL and wait until I've opened it and created my account (the first account owns the server).
4. Install the CLI: npm install --global @rply/cli
5. Create a channel: rply init <server-url> --name "<a name for you>"
   Show me the claim link it prints and wait until I've opened it.
6. Run rply guide setup and follow it from step 3.

For steps 4-6: ${hermesSteps("<server-url>")}`;
