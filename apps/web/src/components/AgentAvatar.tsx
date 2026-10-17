import { useEffect, useMemo, useRef, useState } from "react";
import { agentMood, type AgentMood, type AgentParticipant, type Message } from "@rply/schema";
import { Bird as BirdIcon } from "./Bird";
import { Bird } from "@/lib/bird";
import { cn } from "@/lib/utils";

const groups = new Map<string, Set<Bird>>();
const groupFor = (key: string) => {
  if (!groups.has(key)) groups.set(key, new Set());
  return groups.get(key)!;
};

type Props = {
  id: string;
  channel: string[];
  mood: AgentMood;
  size: number;
  // the channel id: birds of one channel glance at whoever chirps
  group: string;
  // grows when the agent sends a message, which makes the bird chirp
  chirp?: number;
  chirpOnMount?: boolean;
  // the "waiting on you" dot; off where the message itself already shows it
  dot?: boolean;
  className?: string;
};

export function AgentAvatar({ id, channel, mood, size, group, chirp, chirpOnMount, dot = true, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const bird = useRef<Bird | null>(null);
  const channelKey = channel.join(",");

  useEffect(() => {
    const b = new Bird({ id, channel: channelKey.split(","), size, state: mood, group: groupFor(group), dot });
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
    };
    // mood is applied below, recreating the bird would reset its motion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, channelKey, size, group, dot]);

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

  return <span ref={ref} className={cn("inline-block shrink-0", className)} style={{ width: size, height: size }} />;
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
