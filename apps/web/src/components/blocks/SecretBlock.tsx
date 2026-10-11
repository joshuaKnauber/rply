import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckIcon, EyeIcon, EyeOffIcon, KeyRoundIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { secretStatus } from "@rply/schema/helpers";
import { keyFingerprint } from "@rply/schema/crypto";
import type { BlockOf, SecretStatus } from "@rply/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { declineSecret, fetchPublicKey, KeyChangedError, provideSecret, useChannelEntry } from "@/lib/secrets";

const statusLabel: Record<Exclude<SecretStatus, "open">, string> = {
  provided: "Provided, waiting for the agent to write it",
  delivered: "Written by the agent",
  declined: "Declined",
  cancelled: "Cancelled by the agent",
  expired: "Expired",
};

export function SecretBlock({ block }: { block: BlockOf<"secret"> }) {
  const entry = useChannelEntry();
  const status = secretStatus(block);
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [keyChange, setKeyChange] = useState<KeyChangedError | null>(null);
  const open = status === "open" && entry && !entry.revoked;

  const { data: publicKey } = useQuery({
    queryKey: ["public-key", entry?.channel.id],
    queryFn: () => fetchPublicKey(entry!),
    enabled: Boolean(open),
    staleTime: 60_000,
  });

  const provide = useMutation({
    mutationFn: (acceptNewKey: boolean) => provideSecret(entry!, block.id, value, acceptNewKey),
    onSuccess: () => {
      setValue("");
      setKeyChange(null);
      toast.success(`${block.name} sent securely`);
    },
    onError: (err) => (err instanceof KeyChangedError ? setKeyChange(err) : toast.error(err.message)),
  });
  const decline = useMutation({ mutationFn: () => declineSecret(entry!, block.id), onError: (err) => toast.error(err.message) });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value) provide.mutate(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <KeyRoundIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-medium">
            Secret requested: <code className="bg-muted rounded px-1 py-0.5 text-sm">{block.name}</code>
          </p>
          <p className="text-muted-foreground text-sm break-all">
            {block.mode === "env" ? "Written as a line in " : "Written as the whole file "}
            <code>{block.target}</code>
          </p>
          {block.reason && <p className="text-sm">{block.reason}</p>}
        </div>
      </div>

      {open ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            {block.mode === "file" ? (
              <Textarea
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste the file contents"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono text-sm"
                style={visible ? undefined : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)}
              />
            ) : (
              <Input
                type={visible ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                placeholder={`Value for ${block.name}`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono"
              />
            )}
            <Button type="button" size="icon" variant="ghost" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide value" : "Show value"}>
              {visible ? <EyeOffIcon /> : <EyeIcon />}
            </Button>
          </div>

          {keyChange ? (
            <div className="bg-destructive/10 text-destructive flex flex-col gap-2 rounded-md p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <ShieldAlertIcon className="size-4" /> This agent's encryption key changed
              </p>
              <p>
                It was <code>{keyChange.previous}</code> and is now <code>{keyChange.current}</code>. That's expected if the agent was set up again; otherwise
                someone may be trying to intercept the secret.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" type="button" onClick={() => provide.mutate(true)}>
                  Trust the new key and send
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setKeyChange(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={!value || provide.isPending}>
                Send securely
              </Button>
              <Button type="button" variant="ghost" disabled={decline.isPending} onClick={() => decline.mutate()}>
                Decline
              </Button>
              <span className="text-muted-foreground text-xs">
                Encrypted in this browser for the agent's key{publicKey ? ` ${keyFingerprint(publicKey)}` : ""}. The server can't read it.
              </span>
            </div>
          )}
        </form>
      ) : (
        <Badge variant={status === "delivered" ? "secondary" : "outline"} className="self-start">
          {status === "delivered" && <CheckIcon />}
          {status === "open" ? "Waiting" : statusLabel[status]}
        </Badge>
      )}
    </div>
  );
}
