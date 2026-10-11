import { DownloadIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";

type Props = { url: string; name: string; open: boolean; onOpenChange: (open: boolean) => void };

export function ImagePreview({ url, name, open, onOpenChange }: Props) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/85" />
        <DialogPrimitive.Content
          className="data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 flex flex-col outline-none"
          onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
        >
          <div className="flex items-center gap-2 px-4 py-3 text-white">
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-sm font-medium">{name}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Image preview</DialogPrimitive.Description>
            <Button asChild size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <a href={url} download={name} aria-label="Download">
                <DownloadIcon />
              </a>
            </Button>
            <DialogPrimitive.Close asChild>
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" aria-label="Close">
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0" onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}>
            <img src={url} alt={name} className="max-h-full max-w-full rounded-md object-contain" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
