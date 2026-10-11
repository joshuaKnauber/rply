import { MonitorIcon, TerminalIcon } from "lucide-react";
import { RadioGroup } from "radix-ui";

export type Method = "agent" | "here";

const methods = [
  { value: "agent", icon: TerminalIcon, title: "On the agent's machine", description: "Run rply init, then pair this browser." },
  { value: "here", icon: MonitorIcon, title: "In this browser", description: "Create it here, then send the agent a join command." },
] as const;

export function MethodPicker({ value, onChange }: { value: Method; onChange: (value: Method) => void }) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onChange(v as Method)}
      aria-label="How to add the channel"
      className="flex flex-col divide-y overflow-hidden rounded-lg border"
    >
      {methods.map((m) => (
        <RadioGroup.Item
          key={m.value}
          value={m.value}
          className="group hover:bg-muted/50 data-[state=checked]:bg-muted/60 focus-visible:bg-muted/60 flex items-center gap-3 px-4 py-3 text-left transition-colors outline-none"
        >
          <m.icon className="text-muted-foreground group-data-[state=checked]:text-brand-500 size-4 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{m.title}</span>
            <span className="text-muted-foreground text-sm">{m.description}</span>
          </span>
          <span className="group-data-[state=checked]:border-brand-500 group-data-[state=checked]:bg-brand-500 group-focus-visible:ring-ring/50 flex size-4 shrink-0 items-center justify-center rounded-full border group-focus-visible:ring-3">
            <RadioGroup.Indicator className="size-1.5 rounded-full bg-white" />
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
