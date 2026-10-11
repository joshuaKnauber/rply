import { useSyncExternalStore } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Request = { title: string; description?: string; action: string; destructive?: boolean; resolve: (ok: boolean) => void };

let current: Request | null = null;
const listeners = new Set<() => void>();
const set = (next: Request | null) => {
  current = next;
  listeners.forEach((l) => l());
};

export const confirmDialog = (options: Omit<Request, "resolve">) =>
  new Promise<boolean>((resolve) => set({ ...options, resolve }));

export function ConfirmDialog() {
  const request = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  );
  const close = (ok: boolean) => {
    request?.resolve(ok);
    set(null);
  };

  return (
    <AlertDialog open={Boolean(request)} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          {request?.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant={request?.destructive ? "destructive" : "default"} onClick={() => close(true)}>
            {request?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
