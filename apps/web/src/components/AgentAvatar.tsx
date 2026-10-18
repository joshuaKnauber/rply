import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from "react";
import { agentMood, type AgentMood, type AgentParticipant, type BirdLook, type Message } from "@rply/schema";
import { Bird as BirdIcon } from "./Bird";
import { Bird } from "@/lib/bird";
import { cn } from "@/lib/utils";

const groups = new Map<string, Set<Bird>>();
const groupFor = (key: string) => {
  if (!groups.has(key)) groups.set(key, new Set());
  return groups.get(key)!;
};

type Props = {
  look: BirdLook;
  mood: AgentMood;
  size: number;
  // the channel id: birds of one channel glance at whoever chirps
  group: string;
  // grows when the agent sends a message, which makes the bird chirp
  chirp?: number;
  chirpOnMount?: boolean;
  // the "waiting on you" dot; off where the message itself already shows it
  dot?: boolean;
  // follow the pointer with its eye (big birds only)
  follow?: boolean;
  birdRef?: RefObject<Bird | null>;
  onClick?: (e: MouseEvent) => void;
  title?: string;
  className?: string;
};

export function AgentAvatar({ look, mood, size, group, chirp, chirpOnMount, dot = true, follow, birdRef, onClick, title, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const bird = useRef<Bird | null>(null);

  useEffect(() => {
    const b = new Bird({ look, size, state: mood, group: groupFor(group), dot, follow });
    if (birdRef) birdRef.current = b;
    ref.current!.appendChild(b.svg);
    bird.current = b;
    const observer = new IntersectionObserver(([entry]) => (b.visible = entry!.isIntersecting));
    observer.observe(ref.current!);
    const greet = chirpOnMount ? setTimeout(() => b.say(), 150) : undefined;
    return () => {
      clearTimeout(greet);
      observer.disconnect();
      b.destroy();
      bird.current = null;
      if (birdRef) birdRef.current = null;
    };
    // look and mood are applied below, recreating the bird would reset its motion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, group, dot, follow]);

  const lookKey = JSON.stringify(look);
  useEffect(() => bird.current?.setLook(JSON.parse(lookKey)), [lookKey]);

  // working → idle means it just finished: celebrate before settling
  const prevMood = useRef(mood);
  useEffect(() => {
    const b = bird.current;
    const finished = prevMood.current === "working" && mood === "idle";
    prevMood.current = mood;
    if (!b) return;
    if (!finished) return b.setState(mood);
    b.setState("done");
    const settle = setTimeout(() => b.setState(mood), 3000);
    return () => clearTimeout(settle);
  }, [mood]);

  const prevChirp = useRef(chirp);
  useEffect(() => {
    if (chirp !== undefined && prevChirp.current !== undefined && chirp > prevChirp.current) bird.current?.say();
    prevChirp.current = chirp;
  }, [chirp]);

  return (
    <span
      ref={ref}
      className={cn("inline-block shrink-0", onClick && "cursor-pointer", className)}
      style={{ width: size, height: size }}
      onClick={onClick}
      title={title}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? title : undefined}
    />
  );
}

export function AvatarPlaceholder({ size, className }: { size: number; className?: string }) {
  return (
    <span className={cn("text-muted-foreground/40 grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <BirdIcon className="w-4/5" />
    </span>
  );
}

function useMinuteTick() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function useAgentMoods(agents: AgentParticipant[], messages: Message[]) {
  const now = useMinuteTick();
  return useMemo(() => new Map(agents.map((a) => [a.id, agentMood(a, messages, now)])), [agents, messages, now]);
}
