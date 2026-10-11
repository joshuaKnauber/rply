import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "./ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { signInAsAdmin, signOutAdmin, useAdminToken } from "@/lib/channels";
import { useServerInfo } from "@/lib/queries";

export function OwnerButton() {
  const info = useServerInfo();
  const admin = useAdminToken();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const signIn = useMutation({
    mutationFn: signInAsAdmin,
    onSuccess: () => {
      setOpen(false);
      setToken("");
    },
  });

  if (!info?.server_token_required) return null;

  if (admin) {
    return (
      <Button
        size="icon"
        variant="ghost"
        aria-label="Signed in as owner. Click to sign out"
        title="Signed in as owner. Click to sign out"
        onClick={async () => {
          const ok = await confirmDialog({ title: "Sign out as owner?", description: "Only channels paired with this browser will stay visible.", action: "Sign out" });
          if (ok) signOutAdmin();
        }}
      >
        <ShieldCheckIcon />
      </Button>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn.mutate(token.trim());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Sign in as owner" title="Sign in as owner">
          <KeyRoundIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Sign in as owner</DialogTitle>
            <DialogDescription>
              Enter the server's <code>RPLY_ADMIN_TOKEN</code> to see every channel on this server in this browser, without pairing each one.
            </DialogDescription>
          </DialogHeader>
          <Input autoFocus type="password" placeholder="Admin token" value={token} onChange={(e) => setToken(e.target.value)} />
          {signIn.error && <p className="text-destructive text-sm">{signIn.error.message}</p>}
          <DialogFooter>
            <Button type="submit" disabled={!token.trim() || signIn.isPending}>
              Sign in
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
