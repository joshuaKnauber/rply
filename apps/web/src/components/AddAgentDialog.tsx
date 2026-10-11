import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { StoredChannel } from "@/lib/channels";
import { formatTime } from "@/lib/format";
import { createAgentCode } from "@/lib/pairing";
import { useAgents } from "@/lib/queries";
import { JoinInstructions } from "./JoinInstructions";

export function AddAgentDialog({ entry }: { entry: StoredChannel }) {
  const [open, setOpen] = useState(false);
  const code = useMutation({ mutationFn: () => createAgentCode(entry) });
  const { data: agents = [] } = useAgents(entry, open ? 2000 : 60_000);
  const countAtOpen = useRef(0);

  useEffect(() => {
    if (!open || !code.data || agents.length <= countAtOpen.current) return;
    toast.success("An agent joined");
    setOpen(false);
  }, [open, code.data, agents.length]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return code.reset();
    countAtOpen.current = agents.length;
    code.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon-xs" variant="ghost" className="text-muted-foreground -mr-1" aria-label="Add an agent">
          <PlusIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add an agent</DialogTitle>
          <DialogDescription>
            Paste this prompt to the agent. It installs rply, joins "{entry.channel.name}" and sets itself up. Also use it to reconnect an agent that lost its setup.
          </DialogDescription>
        </DialogHeader>
        {code.error && <p className="text-destructive text-sm">{code.error.message}</p>}
        {code.data && (
          <div className="flex min-w-0 flex-col gap-3">
            <JoinInstructions code={code.data.code} />
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <Loader2Icon className="size-3.5 animate-spin" />
                Waiting for the agent…
              </span>
              <span>Single use, expires at {formatTime(code.data.expires_at)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
