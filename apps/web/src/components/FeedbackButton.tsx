import { useState } from "react";
import { MessageSquareHeartIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth";

// Feedback goes to the rply developers on rply.sh, also from self-hosted servers.
const FEEDBACK_URL = import.meta.env.VITE_RPLY_FEEDBACK_URL ?? "https://app.rply.sh/v1/feedback";

export function FeedbackButton() {
  const email = useSession().data?.user.email;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [includeEmail, setIncludeEmail] = useState(true);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch(FEEDBACK_URL, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, from: "human", version: "web", ...(includeEmail && email && { contact: email }) }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't send feedback");
      toast.success("Thanks for the feedback!");
      setText("");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:bg-foreground/4 hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
      >
        <MessageSquareHeartIcon className="size-4" />
        Send feedback
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>Missing a feature or found something to improve? This goes straight to the people building rply.</DialogDescription>
          </DialogHeader>
          <Textarea autoFocus rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="What would make rply better for you?" />
          {email && (
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={includeEmail} onCheckedChange={setIncludeEmail} />
              Include {email} so we can reply
            </Label>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !text.trim()} onClick={send}>
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
