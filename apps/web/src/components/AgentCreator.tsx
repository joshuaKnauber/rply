import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, DicesIcon, HeartIcon, MusicIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { BIRD_COLORS, BIRD_CRESTS, BIRD_EYES, BIRD_HATS, birdLook, type AgentParticipant, type BirdLook, type ChannelEntry } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Bird, Emote } from "@/lib/bird";
import { closeCustomizer, useCustomizer } from "@/lib/customize";
import { useAgents, useUpdateAgent } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./AgentAvatar";

// monocle is drawn in ink, the others take the accent color
const usesAccent = (hat: number) => hat !== 0 && hat !== 4;

export function AgentCreatorHost() {
  const target = useCustomizer();
  return target && <CreatorDialog key={target.agentId} entry={target.entry} agentId={target.agentId} />;
}

function CreatorDialog({ entry, agentId }: { entry: ChannelEntry; agentId: string }) {
  const { data: agents = [] } = useAgents(entry);
  const agent = agents.find((a) => a.id === agentId);
  return (
    <Dialog open onOpenChange={(open) => !open && closeCustomizer()}>
      {agent && <AgentCreator entry={entry} agent={agent} agents={agents} />}
    </Dialog>
  );
}

function AgentCreator({ entry, agent, agents }: { entry: ChannelEntry; agent: AgentParticipant; agents: AgentParticipant[] }) {
  const generated = birdLook(agent.id, agents.map((a) => (a.id === agent.id ? { ...a, avatar: null } : a)));
  const [look, setLook] = useState<BirdLook>(() => birdLook(agent.id, agents));
  const [name, setName] = useState(agent.label ?? "");
  const bird = useRef<Bird | null>(null);
  const lastChirp = useRef(0);
  const update = useUpdateAgent(entry);
  const [wide] = useState(() => matchMedia("(min-width: 768px)").matches);

  const change = (patch: Partial<BirdLook>, emote: Emote) => {
    setLook((current) => ({ ...current, ...patch }));
    bird.current?.emote(emote);
  };

  const randomize = () => {
    const pick = (n: number) => Math.floor(Math.random() * n);
    change(
      { color: pick(BIRD_COLORS.length), crest: pick(BIRD_CRESTS.length), eyes: pick(BIRD_EYES.length), hat: pick(BIRD_HATS.length), accent: pick(BIRD_COLORS.length), cheeks: Math.random() < 0.5, belly: Math.random() < 0.5 },
      "spin",
    );
  };

  const typeName = (value: string) => {
    setName(value);
    if (Date.now() - lastChirp.current < 350) return;
    lastChirp.current = Date.now();
    bird.current?.say();
  };

  const save = () => {
    const label = name.trim();
    const isGenerated = JSON.stringify(look) === JSON.stringify(generated);
    update.mutate(
      { id: agent.id, avatar: isGenerated ? null : look, ...(label && label !== agent.label && { label }) },
      { onSuccess: closeCustomizer, onError: (err) => toast.error(err.message) },
    );
  };

  useEffect(() => {
    const hello = setTimeout(() => bird.current?.emote("love"), 350);
    return () => clearTimeout(hello);
  }, []);

  return (
    <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-3xl">
      <div className="grid md:grid-cols-[1fr_340px]">
        <div className="bg-muted flex flex-col items-center justify-center gap-4 px-6 pt-10 pb-5 md:gap-6 md:p-8">
          <AgentAvatar look={look} mood="idle" size={wide ? 200 : 120} group={`creator-${entry.id}`} dot={false} follow birdRef={bird} onClick={() => bird.current?.poke()} title="Poke" />
          <div className="flex flex-col items-center gap-2">
            <p className="max-w-56 truncate text-lg font-semibold">{name.trim() || "Agent"}</p>
            <div className="flex gap-1">
              <EmoteButton label="Love" icon={HeartIcon} onClick={() => bird.current?.emote("love")} />
              <EmoteButton label="Surprise" icon={CircleAlertIcon} onClick={() => bird.current?.emote("surprise")} />
              <EmoteButton label="Dance" icon={MusicIcon} onClick={() => bird.current?.emote("music")} />
              <EmoteButton label="Sparkle" icon={SparklesIcon} onClick={() => bird.current?.emote("sparkle")} />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5 p-5 md:p-6">
          <div className="flex flex-col gap-1">
            <DialogTitle>Customize agent</DialogTitle>
            <DialogDescription>Everyone in {entry.name} sees this bird and name.</DialogDescription>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-name">Name</Label>
            <Input id="agent-name" value={name} maxLength={100} onChange={(e) => typeName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
          </div>

          <Swatches label="Color" value={look.color} onChange={(color) => change({ color }, "sparkle")} />
          <div className="flex flex-col gap-1">
            <Cycler label="Crest" options={BIRD_CRESTS} value={look.crest} onChange={(crest) => change({ crest }, "surprise")} />
            <Cycler label="Eyes" options={BIRD_EYES} value={look.eyes} onChange={(eyes) => change({ eyes }, "sparkle")} />
            <Cycler label="Accessory" options={BIRD_HATS} value={look.hat} onChange={(hat) => change({ hat }, "love")} />
          </div>
          <Swatches label="Accessory color" value={look.accent} disabled={!usesAccent(look.hat)} onChange={(accent) => change({ accent }, "music")} />
          <div className="flex gap-6">
            <Toggle label="Cheeks" checked={look.cheeks} onChange={(cheeks) => change({ cheeks }, "love")} />
            <Toggle label="Belly" checked={look.belly} onChange={(belly) => change({ belly }, "music")} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={randomize}>
              <DicesIcon /> Randomize
            </Button>
            <Button variant="ghost" size="sm" onClick={() => change(generated, "surprise")}>
              <RotateCcwIcon /> Reset
            </Button>
          </div>

          <div className="bg-popover sticky bottom-0 -mx-5 -mb-5 mt-auto flex justify-end gap-2 border-t px-5 py-3 md:static md:m-0 md:border-0 md:p-0 md:pt-2">
            <Button variant="outline" onClick={closeCustomizer}>
              Cancel
            </Button>
            <Button onClick={save} disabled={update.isPending}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}

function Swatches({ label, value, disabled, onChange }: { label: string; value: number; disabled?: boolean; onChange: (index: number) => void }) {
  return (
    <div className={cn("flex flex-col gap-2 transition-opacity", disabled && "pointer-events-none opacity-40")} aria-disabled={disabled}>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {BIRD_COLORS.map((color, i) => (
          <button
            key={color}
            type="button"
            aria-label={`${label} ${i + 1}`}
            aria-pressed={i === value}
            disabled={disabled}
            onClick={() => onChange(i)}
            className={cn("ring-offset-background size-6 rounded-full transition-transform hover:scale-110", i === value && "ring-foreground ring-2 ring-offset-2")}
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}

function Cycler({ label, options, value, onChange }: { label: string; options: readonly string[]; value: number; onChange: (index: number) => void }) {
  const step = (by: number) => onChange((value + by + options.length) % options.length);
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" aria-label={`Previous ${label.toLowerCase()}`} onClick={() => step(-1)}>
          <ChevronLeftIcon />
        </Button>
        <span className="w-24 text-center text-sm tabular-nums">{options[value]}</span>
        <Button size="icon-sm" variant="ghost" aria-label={`Next ${label.toLowerCase()}`} onClick={() => step(1)}>
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Label className="flex items-center gap-2 font-normal">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </Label>
  );
}

function EmoteButton({ label, icon: Icon, onClick }: { label: string; icon: typeof HeartIcon; onClick: () => void }) {
  return (
    <Button size="icon-sm" variant="ghost" className="text-muted-foreground" aria-label={label} title={label} onClick={onClick}>
      <Icon />
    </Button>
  );
}
