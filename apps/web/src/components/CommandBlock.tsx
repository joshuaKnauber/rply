import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CommandBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="bg-muted flex items-start gap-2 rounded-md border py-1 pr-1 pl-3">
      <pre className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-sm leading-6">{text}</pre>
      <Button size="icon-sm" variant="ghost" className="text-muted-foreground" onClick={copy} aria-label="Copy">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}
