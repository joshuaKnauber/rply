export const FPS = 30;
export const DURATION = 51;

export const MESSAGE = "Add a page for the Teams plan";

export const AGENT = { left: 40, top: 440, width: 600, height: 440 };
export const BROWSER = { left: 760, top: 280, width: 1180, height: 700 };
export const PHONE = { left: 2080, top: 270, width: 310, height: 680 };

export const T = {
  logoPop: 2.0,
  introOut: 3.9,
  worldIn: 4.1,

  research: 4.6,
  researchDone: 6.6,
  sendLog: 8.4,
  sendArrive: 9.5,
  draft: 10.1,
  draftDone: 11.4,

  askLog: 12.4,
  askArrive: 13.6,
  notify: 14.6,
  tapNotification: 17.2,
  tapPublish: 18.2,
  answerArrive: 20.4,
  publishing: 20.8,

  statusLog: 21.4,
  statusArrive: 22.5,
  patches: [
    { at: 23.5, value: 2 },
    { at: 24.3, value: 4 },
    { at: 25.1, value: 5 },
  ],
  liveLog: 25.8,
  liveArrive: 26.8,

  secretLog: 27.7,
  secretArrive: 28.9,
  secretClickField: 30.3,
  secretTypeStart: 30.45,
  secretTypeEnd: 31.2,
  secretSend: 31.9,
  secretWritten: 33.2,

  composerClick: 37.0,
  messageType: 37.15,
  messageSend: 38.9,
  messageSeen: 40.0,
  ack: 40.7,
  writing: 41.1,

  outro: 42.0,
  devicesOut: 43.0,
  ring: 43.4,
  lockup: 47.4,
};

export type Line = { at: number; kind: "think" | "cmd" | "out"; text: string; until?: number };

export const LOG: Line[] = [
  { at: T.research, kind: "think", text: "Researching keywords for acme.dev", until: T.researchDone },
  { at: T.researchDone, kind: "out", text: "14 new topics found" },
  { at: T.sendLog, kind: "cmd", text: `rply send "Keyword research for acme.dev is done." --file keywords.csv` },
  { at: T.sendLog + 0.4, kind: "out", text: "Sent" },
  { at: T.draft, kind: "think", text: "Drafting 5 pages", until: T.draftDone },
  { at: T.draftDone, kind: "out", text: "/pricing, /pricing/teams, /compare, /faq, /security" },
  { at: T.askLog, kind: "cmd", text: `rply ask "Publish 5 new pages to acme.dev?" --choices Publish,"Not yet" --wait` },
  { at: T.askLog + 0.3, kind: "out", text: "Waiting for an answer", until: T.answerArrive },
  { at: T.answerArrive, kind: "out", text: "Publish" },
  { at: T.publishing, kind: "think", text: "Publishing 5 pages", until: T.liveLog },
  { at: T.statusLog, kind: "cmd", text: `rply status set '[{"type":"progress","id":"pub","max":5}]'` },
  ...T.patches.map((p): Line => ({ at: p.at - 0.9, kind: "cmd", text: `rply status patch '{"id":"pub","value":${p.value}}'` })),
  { at: T.liveLog, kind: "cmd", text: `rply send "All 5 pages are live. Indexing requested."` },
  { at: T.secretLog, kind: "cmd", text: `rply secret request STRIPE_SECRET_KEY --to .env --wait` },
  { at: T.secretLog + 0.3, kind: "out", text: "Waiting for the value", until: T.secretWritten },
  { at: T.secretWritten, kind: "out", text: "STRIPE_SECRET_KEY written to /home/agent/acme/.env" },
  { at: T.messageSeen, kind: "think", text: `New message: "${MESSAGE}"` },
  { at: T.ack - 0.1, kind: "cmd", text: "rply ack m_7d2q working" },
  { at: T.writing, kind: "think", text: "Writing /pricing/teams", until: 99 },
];

const CHAT = { x: 1150, y: 830 };
const STATUS = { x: 1795, y: 430 };
const AGENT_OUT = { x: 560, y: 800 };

export type Flight = { from: { x: number; y: number }; to: { x: number; y: number }; at: number; dur: number; arc?: number; lock?: boolean };

export const FLIGHTS: Flight[] = [
  { from: AGENT_OUT, to: CHAT, at: T.sendArrive - 1, dur: 1 },
  { from: AGENT_OUT, to: CHAT, at: T.askArrive - 1.1, dur: 1.1 },
  { from: AGENT_OUT, to: { x: 2235, y: 560 }, at: T.notify - 1.9, dur: 1.9, arc: 380 },
  { from: { x: 2176, y: 836 }, to: AGENT_OUT, at: T.answerArrive - 1.8, dur: 1.8, arc: 320 },
  { from: AGENT_OUT, to: STATUS, at: T.statusArrive - 1, dur: 1, arc: 260 },
  ...T.patches.map((p): Flight => ({ from: AGENT_OUT, to: STATUS, at: p.at - 0.9, dur: 0.9, arc: 260 })),
  { from: AGENT_OUT, to: CHAT, at: T.liveArrive - 0.9, dur: 0.9 },
  { from: AGENT_OUT, to: CHAT, at: T.secretArrive - 1.1, dur: 1.1 },
  { from: { x: 1180, y: 860 }, to: AGENT_OUT, at: T.secretWritten - 1.2, dur: 1.2, lock: true },
  { from: { x: 1500, y: 900 }, to: AGENT_OUT, at: T.messageSeen - 1, dur: 1 },
];

const WIDE = { x: 1225, y: 560, s: 0.72 };
const SHOT = (x: number) => ({ x, y: 560, s: 1.12 });

export const CAMERA = [
  { ...WIDE, at: T.worldIn, dur: 1.6 },
  { ...SHOT(800), at: 7.0, dur: 1.2 },
  { ...SHOT(1700), at: 12.6, dur: 1.6 },
  { x: 2235, y: 610, s: 1.4, at: 16.0, dur: 0.9 },
  { ...SHOT(760), at: T.answerArrive - 1.8, dur: 1.9 },
  { ...SHOT(1450), at: 21.3, dur: 1.3 },
  { ...SHOT(1050), at: 27.4, dur: 1.2 },
  { ...SHOT(800), at: 35.4, dur: 1.2 },
  { ...WIDE, at: T.outro, dur: 1.3 },
];

export const HEADLINES = [
  { x: 1225, from: 5.2, to: 6.9, strong: "Your agent works in the background.", soft: "rply keeps you in the loop." },
  { x: 800, from: 7.7, to: 12.1, strong: "It keeps you posted.", soft: "Updates land the moment they happen." },
  { x: 1700, from: 13.9, to: 16.0, strong: "It asks before it ships.", soft: "Answer from wherever you are." },
  { x: 1450, from: 22.4, to: 27.3, strong: "A live status, pinned on top.", soft: "Updated in place, not in a flood of messages." },
  { x: 1050, from: 28.6, to: 35.6, strong: "Keys go straight to a file.", soft: "The value never enters the agent's context." },
  { x: 800, from: 36.4, to: 42.0, strong: "Message it anytime.", soft: "It picks it up and gets to work." },
];
