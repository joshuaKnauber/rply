import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinPrompt } from "@/lib/onboarding";
import { CommandBlock } from "./CommandBlock";

export function JoinInstructions({ code }: { code: string }) {
  const [name, setName] = useState("");
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-name">Agent name</Label>
        <Input id="agent-name" placeholder="Optional, defaults to the hostname" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <CommandBlock text={joinPrompt(code, name)} wrap />
    </div>
  );
}
