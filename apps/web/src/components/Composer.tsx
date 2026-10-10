import { useState, type FormEvent, type KeyboardEvent } from "react";
import { SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Composer({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState("");

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) submit(e);
  };

  return (
    <form onSubmit={submit} className="border-t p-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          rows={1}
          placeholder="Message the agent…"
          className="max-h-40 min-h-10 resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" size="icon" disabled={disabled || !text.trim()} aria-label="Send">
          <SendIcon />
        </Button>
      </div>
    </form>
  );
}
