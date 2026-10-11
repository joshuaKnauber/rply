import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import type { Pairing } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { auth, type StoredChannel } from "@/lib/channels";
import { formatTime } from "@/lib/format";

export function LinkDeviceDialog({ entry }: { entry: StoredChannel }) {
  const [open, setOpen] = useState(false);
  const pairing = useMutation({
    mutationFn: async () => {
      const res = await api<Pairing>("/pairings", { ...auth(entry), method: "POST" });
      const link = `${location.origin}/pair?c=${res.code}`;
      return { ...res, link, qr: await QRCode.toString(link, { type: "svg", margin: 0 }) };
    },
  });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) pairing.mutate();
    else pairing.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon-xs" variant="ghost" className="text-muted-foreground -mr-1" aria-label="Link another device">
          <PlusIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Link another device</DialogTitle>
          <DialogDescription>Scan the code with your phone, or open the link on another computer.</DialogDescription>
        </DialogHeader>
        {pairing.error && <p className="text-destructive text-sm">{pairing.error.message}</p>}
        {pairing.data && (
          <div className="flex flex-col items-center gap-4">
            <div className="size-48 rounded-lg bg-white p-3 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: pairing.data.qr }} />
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-xl tracking-widest">{pairing.data.code}</span>
              <span className="text-muted-foreground text-sm">Single use, expires at {formatTime(pairing.data.expires_at)}</span>
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigator.clipboard.writeText(pairing.data.link).then(() => toast.success("Link copied"), () => toast.error("Couldn't copy the link"))}>
              Copy link
            </Button>
          </div>
        )}
        <p className="text-muted-foreground text-sm">
          In another rply app, choose <span className="text-foreground">Add channel</span> and enter the code. On the agent's machine, <code className="font-mono">rply pair</code> prints a new code too.
        </p>
      </DialogContent>
    </Dialog>
  );
}
