import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import type { Pairing } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminToken, type StoredChannel } from "@/lib/channels";
import { formatTime } from "@/lib/format";
import { createChannel } from "@/lib/pairing";
import { useAgents, useServerInfo } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { MethodPicker, type Method } from "./MethodPicker";
import { CommandBlock } from "./CommandBlock";
import { JoinInstructions } from "./JoinInstructions";
import { PairingCodeInput } from "./PairingCodeInput";

export function AddChannelPage({ first }: { first?: boolean }) {
  const [method, setMethod] = useState<Method>("agent");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
        {!first && (
          <Button asChild size="icon" variant="ghost" className="-ml-3 md:hidden" aria-label="Back">
            <Link href="/">
              <ArrowLeftIcon />
            </Link>
          </Button>
        )}
        <h1 className="font-medium tracking-normal">{first ? "Welcome to rply" : "Add channel"}</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-8 py-12">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-semibold">{first ? "Add your first channel" : "Add a channel"}</h2>
            <p className="text-muted-foreground">Agents send you messages, questions and status updates in a channel.</p>
          </div>
          <MethodPicker value={method} onChange={setMethod} />
          <div className="border-t pt-8">
            {method === "agent" && <FromAgent />}
            {method === "here" && <FromHere />}
          </div>
        </div>
      </div>
    </div>
  );
}

function FromAgent() {
  const info = useServerInfo();
  const tokenFlag = info?.server_token_required ? " --server-token <admin token>" : "";
  return (
    <ol>
      <Step n={1} title="Install the CLI">
        <CommandBlock text="npm install --global @rply/cli" />
      </Step>
      <Step n={2} title="Create a channel">
        <CommandBlock text={`rply init ${location.origin} --name "My agent"${tokenFlag}`} />
        {tokenFlag && (
          <p className="text-muted-foreground text-sm">
            Replace <code className="font-mono">&lt;admin token&gt;</code> with the server's <code className="font-mono">RPLY_ADMIN_TOKEN</code>.
          </p>
        )}
      </Step>
      <Step n={3} title="Pair this browser" last>
        <p className="text-muted-foreground text-sm">Open the printed link, or enter or paste the code. Codes from rply pair or another device work too.</p>
        <PairingCodeInput />
      </Step>
    </ol>
  );
}

function FromHere() {
  const info = useServerInfo();
  const admin = useAdminToken();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => createChannel(name.trim(), admin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-channels"] }),
  });
  const blocked = Boolean(info?.server_token_required && !admin);

  if (create.data) return <WaitForAgent entry={create.data.entry} code={create.data.code} />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <ol>
      <Step n={1} title="Name the channel">
        <form onSubmit={submit} className="flex gap-2">
          <Input autoFocus placeholder="SEO bot" className="h-9" value={name} onChange={(e) => setName(e.target.value)} disabled={blocked} aria-label="Channel name" />
          <Button type="submit" size="lg" disabled={!name.trim() || blocked || create.isPending}>
            Create
          </Button>
        </form>
        {blocked && <p className="text-muted-foreground text-sm">Creating channels needs the admin token. Sign in as owner with the key icon in the sidebar.</p>}
        {create.error && <p className="text-destructive text-sm">{create.error.message}</p>}
      </Step>
      <Step n={2} title="Give the agent a code" upcoming>
        <p className="text-muted-foreground text-sm">You get a command to paste to the agent. You can add more agents later.</p>
      </Step>
      <Step n={3} title="Wait for the agent" upcoming last />
    </ol>
  );
}

function WaitForAgent({ entry, code }: { entry: StoredChannel; code: Pairing }) {
  const [, navigate] = useLocation();
  const { data: agents = [] } = useAgents(entry, 2000);
  const joined = agents.length > 0;

  useEffect(() => {
    if (!joined) return;
    toast.success(`An agent joined "${entry.channel.name}"`);
    navigate(`/c/${entry.channel.id}`);
  }, [joined, entry, navigate]);

  return (
    <ol>
      <Step n={1} title={`Created "${entry.channel.name}"`} done />
      <Step n={2} title="Give the agent a code">
        <p className="text-muted-foreground text-sm">Paste these commands to the agent, or run them on its machine. The code works once and expires at {formatTime(code.expires_at)}.</p>
        <JoinInstructions code={code.code} />
      </Step>
      <Step n={3} title="Wait for the agent" last>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2Icon className="size-3.5 animate-spin" />
            The channel opens when it joins.
          </span>
          <Button asChild variant="ghost" className="-mr-2">
            <Link href={`/c/${entry.channel.id}`}>Open now</Link>
          </Button>
        </div>
      </Step>
    </ol>
  );
}

function Step({ n, title, done, upcoming, last, children }: { n: number; title: string; done?: boolean; upcoming?: boolean; last?: boolean; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "bg-background flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
            done && "border-brand-600 bg-brand-500 text-white",
            upcoming && "text-muted-foreground",
          )}
        >
          {done ? <CheckIcon className="size-3.5" /> : n}
        </span>
        {!last && <span className="bg-border my-1 w-px flex-1" />}
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-2 pt-0.5", !last && "pb-6")}>
        <span className={cn("font-medium", upcoming && "text-muted-foreground")}>{title}</span>
        {children}
      </div>
    </li>
  );
}
