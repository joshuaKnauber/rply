import { useState } from "react";
import { BellIcon, BellRingIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminToken, type StoredChannel } from "@/lib/channels";
import { disablePush, enablePush, needsHomeScreen, pushSupported, usePushEndpoint } from "@/lib/push";
import { useServerInfo } from "@/lib/queries";

export function NotificationsButton({ channels }: { channels: StoredChannel[] }) {
  const info = useServerInfo();
  const admin = useAdminToken();
  const endpoint = usePushEndpoint();
  const [busy, setBusy] = useState(false);
  const [explain, setExplain] = useState(false);

  if (!info?.push) return null;
  const supported = pushSupported();
  if (!supported && !needsHomeScreen()) return null;
  const on = Boolean(endpoint);

  const toggle = async () => {
    if (!supported) return setExplain(true);
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        toast.success("Notifications turned off for this browser");
      } else {
        await enablePush(info.push!.public_key, channels, admin);
        toast.success("Notifications are on for this browser");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const label = on ? "Notifications on. Click to turn off" : "Turn on notifications";
  return (
    <>
      <Button size="icon" variant="ghost" disabled={busy} onClick={toggle} aria-label={label} title={label}>
        {on ? <BellRingIcon /> : <BellIcon />}
      </Button>
      <Dialog open={explain} onOpenChange={setExplain}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add rply to your Home Screen</DialogTitle>
            <DialogDescription>
              On iPhone and iPad, notifications only work for web apps on the Home Screen. Tap the Share button, choose "Add to Home Screen", then open rply
              from there and tap the bell again.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
