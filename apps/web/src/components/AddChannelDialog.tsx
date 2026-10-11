import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { claimPairing } from "@/lib/pairing";
import { SetupCommand } from "./SetupCommand";

export function AddChannelDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [, navigate] = useLocation();
  const claim = useMutation({
    mutationFn: claimPairing,
    onSuccess: (channel) => {
      setOpen(false);
      setInput("");
      navigate(`/c/${channel.id}`);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    claim.mutate(input);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add channel</DialogTitle>
            <DialogDescription>
              Paste the pairing code or link printed by <code>rply init</code> or <code>rply pair</code>.
            </DialogDescription>
          </DialogHeader>
          <Input autoFocus placeholder="K7QX-M2PD" value={input} onChange={(e) => setInput(e.target.value)} />
          {claim.error && <p className="text-destructive text-sm">{claim.error.message}</p>}
          <DialogFooter>
            <Button type="submit" disabled={!input.trim() || claim.isPending}>
              Pair
            </Button>
          </DialogFooter>
        </form>
        <div className="flex min-w-0 flex-col gap-3 pt-2">
          <p className="text-sm font-medium">New agent?</p>
          <SetupCommand />
        </div>
      </DialogContent>
    </Dialog>
  );
}
