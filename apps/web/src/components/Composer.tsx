import { useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUpIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { FileRef } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChannelEntry } from "@/lib/channel-context";
import { uploadFile } from "@/lib/files";
import { useServerInfo } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Pending = { key: string; name: string; file?: FileRef };

export function Composer({ onSend, disabled }: { onSend: (text: string, attachments: FileRef[]) => void; disabled?: boolean }) {
  const entry = useChannelEntry();
  const filesEnabled = useServerInfo()?.files.enabled ?? false;
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const uploading = pending.some((p) => !p.file);
  const ready = pending.flatMap((p) => (p.file ? [p.file] : []));
  const canSend = !disabled && !uploading && (text.trim() || ready.length > 0);

  const add = (files: FileList | File[]) => {
    if (!entry || !filesEnabled) return;
    for (const file of Array.from(files)) {
      const key = crypto.randomUUID();
      setPending((p) => [...p, { key, name: file.name }]);
      uploadFile(entry, file)
        .then((info) => setPending((p) => p.map((x) => (x.key === key ? { ...x, file: info } : x))))
        .catch((err) => {
          toast.error(`${file.name}: ${err.message}`);
          setPending((p) => p.filter((x) => x.key !== key));
        });
    }
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    onSend(text.trim(), ready);
    setText("");
    setPending([]);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) submit(e);
  };
  const onPaste = (e: ClipboardEvent) => {
    if (e.clipboardData.files.length) {
      e.preventDefault();
      add(e.clipboardData.files);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    add(e.dataTransfer.files);
  };

  return (
    <form
      onSubmit={submit}
      onDragOver={(e) => filesEnabled && (e.preventDefault(), setDragging(true))}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className="shrink-0 px-6 pb-5"
    >
      <div className={cn("bg-muted focus-within:border-ring/60 mx-auto flex max-w-3xl flex-col rounded-xl border transition-colors", dragging && "border-ring")}>
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {pending.map((p) => (
              <span key={p.key} className="bg-background flex items-center gap-1.5 rounded-md border py-1 pr-1 pl-2 text-sm">
                {!p.file && <Loader2Icon className="size-3.5 animate-spin" />}
                <span className="max-w-48 truncate">{p.name}</span>
                <button type="button" className="hover:bg-muted rounded p-0.5" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))} aria-label={`Remove ${p.name}`}>
                  <XIcon className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Textarea
          rows={1}
          placeholder="Message the agent…"
          className="max-h-60 min-h-12 resize-none border-0 bg-transparent px-4 pt-3.5 pb-1 text-base shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        <div className="flex items-center justify-between px-2 pb-2">
          {filesEnabled ? (
            <>
              <input ref={input} type="file" multiple hidden onChange={(e) => (e.target.files && add(e.target.files), (e.target.value = ""))} />
              <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground" onClick={() => input.current?.click()} aria-label="Attach files">
                <PlusIcon />
              </Button>
            </>
          ) : (
            <span />
          )}
          <Button type="submit" size="icon-sm" variant={canSend ? "default" : "ghost"} disabled={!canSend} aria-label="Send">
            <ArrowUpIcon />
          </Button>
        </div>
      </div>
    </form>
  );
}
