import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerInfo } from "@/lib/queries";

export function SetupCommand() {
  const info = useServerInfo();
  const [copied, setCopied] = useState(false);

  const init = `rply init ${window.location.origin} --name "My agent"${info?.server_token_required ? " --server-token <admin token>" : ""}`;
  const command = `npm install --global @rply/cli\n${init}`;

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2 text-left">
      <p className="text-muted-foreground text-sm">Run this on your agent's machine, then open the pairing link it prints:</p>
      <div className="bg-muted relative rounded-md">
        <pre className="overflow-x-auto p-3 pr-12 text-xs leading-relaxed">
          <code>{command}</code>
        </pre>
        <Button size="icon" variant="ghost" className="absolute top-1.5 right-1.5 size-7" onClick={copy} aria-label="Copy command">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      {info?.server_token_required && (
        <p className="text-muted-foreground text-xs">
          Replace <code>&lt;admin token&gt;</code> with the server's <code>RPLY_ADMIN_TOKEN</code>.
        </p>
      )}
    </div>
  );
}
