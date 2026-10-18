import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { ArrowUpIcon, Loader2Icon, PlusIcon, ReplyIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import HardBreak from "@tiptap/extension-hard-break";
import Mention from "@tiptap/extension-mention";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import type { FileRef } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { useChannelEntry } from "@/lib/channel-context";
import { uploadFile } from "@/lib/files";
import { useServerInfo } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Pending = { key: string; name: string; file?: FileRef };
export type Mentionable = { id: string; label: string };
type Suggestion = { items: Mentionable[]; index: number; select: (item: Mentionable) => void };

const touchKeyboard = () => matchMedia("(pointer: coarse)").matches;

type Props = {
  onSend: (text: string, attachments: FileRef[], mentions: string[]) => void;
  disabled?: boolean;
  replyTo?: { name: string; text: string } | null;
  onCancelReply?: () => void;
  agents?: Mentionable[];
};

export function Composer({ onSend, disabled, replyTo, onCancelReply, agents = [] }: Props) {
  const entry = useChannelEntry();
  const filesEnabled = useServerInfo()?.files.enabled ?? false;
  const [empty, setEmpty] = useState(true);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const uploading = pending.some((p) => !p.file);
  const ready = pending.flatMap((p) => (p.file ? [p.file] : []));
  const canSend = !disabled && !uploading && (!empty || ready.length > 0);

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
    if (!canSend || !editor) return;
    const { text, mentions } = read(editor);
    onSend(text, ready, mentions);
    editor.commands.clearContent(true);
    setPending([]);
  };

  // the editor is created once, so its callbacks read the latest values through this ref
  const latest = useRef({ submit, add, agents, suggestion, replyTo, onCancelReply });
  latest.current = { submit, add, agents, suggestion, replyTo, onCancelReply };

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      UndoRedo,
      Placeholder.configure({ placeholder: () => (latest.current.agents.length ? "Message the agents… (@ to mention one)" : "Message the agent…") }),
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          items: ({ query }) => latest.current.agents.filter((a) => a.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
          render: () => ({
            onStart: ({ items, command }) => setSuggestion({ items, index: 0, select: command }),
            onUpdate: ({ items, command }) => setSuggestion({ items, index: 0, select: command }),
            onExit: () => setSuggestion(null),
            onKeyDown: ({ event }) => {
              const s = latest.current.suggestion;
              if (!s?.items.length) return false;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                const step = event.key === "ArrowDown" ? 1 : -1;
                setSuggestion({ ...s, index: (s.index + step + s.items.length) % s.items.length });
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                s.select(s.items[s.index]!);
                return true;
              }
              if (event.key === "Escape") {
                setSuggestion(null);
                return true;
              }
              return false;
            },
          }),
        },
      }),
      Extension.create({
        name: "sendOnEnter",
        addKeyboardShortcuts: () => ({
          Enter: () => {
            if (touchKeyboard() || latest.current.suggestion?.items.length) return false;
            latest.current.submit();
            return true;
          },
          Escape: () => {
            if (!latest.current.replyTo) return false;
            latest.current.onCancelReply?.();
            return true;
          },
        }),
      }),
    ],
    editorProps: {
      attributes: { class: "max-h-60 min-h-12 overflow-y-auto px-4 pt-3.5 pb-1 text-base outline-none wrap-anywhere", "aria-label": "Message" },
      handlePaste: (_view, event) => {
        if (!event.clipboardData?.files.length) return false;
        latest.current.add(event.clipboardData.files);
        return true;
      },
      // the form's drop handler uploads the files
      handleDrop: (_view, event) => Boolean(event.dataTransfer?.files.length),
    },
    onUpdate: ({ editor }) => setEmpty(editor.getText().trim() === ""),
  });

  useEffect(() => {
    if (replyTo) editor?.commands.focus("end");
  }, [replyTo, editor]);

  useEffect(() => {
    if (!editor) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!typedAnywhere(e) || editor.isFocused) return;
      e.preventDefault();
      editor.chain().focus("end").insertContent(e.key).run();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor]);

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
      <div className={cn("bg-muted focus-within:border-ring/60 relative mx-auto flex max-w-3xl flex-col rounded-xl border transition-colors", dragging && "border-ring")}>
        {suggestion && suggestion.items.length > 0 && (
          <div role="listbox" aria-label="Mention an agent" className="bg-popover text-popover-foreground absolute bottom-full left-0 mb-2 flex min-w-56 flex-col rounded-lg border p-1 shadow-md">
            {suggestion.items.map((agent, i) => (
              <button
                key={agent.id}
                type="button"
                role="option"
                aria-selected={i === suggestion.index}
                className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", i === suggestion.index && "bg-accent")}
                onMouseDown={(e) => (e.preventDefault(), suggestion.select(agent))}
                onMouseEnter={() => setSuggestion({ ...suggestion, index: i })}
              >
                <span className="truncate">{agent.label}</span>
              </button>
            ))}
          </div>
        )}
        {replyTo && (
          <div className="flex items-center gap-2 border-b py-2 pr-2 pl-3 text-sm">
            <ReplyIcon className="text-attention size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium">Replying to {replyTo.name}</span>
              <p className="text-muted-foreground truncate">{replyTo.text}</p>
            </div>
            <Button type="button" size="icon-xs" variant="ghost" className="text-muted-foreground" onClick={onCancelReply} aria-label="Cancel reply">
              <XIcon />
            </Button>
          </div>
        )}
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
        <EditorContent editor={editor} />
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

// a printable key pressed while nothing else wants it: not in a field, dialog or menu, no shortcut, no IME
function typedAnywhere(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.key.length !== 1 || e.key === " ") return false;
  const target = e.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])")) return false;
  if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return false;
  return !getSelection()?.toString();
}

function read(editor: Editor) {
  const mentions = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === "mention") mentions.add(node.attrs.id);
  });
  return { text: editor.getText({ blockSeparator: "\n" }).trim(), mentions: [...mentions] };
}
