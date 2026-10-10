import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { claimPairing } from "@/lib/pairing";

export function PairPage() {
  const code = new URLSearchParams(useSearch()).get("c");
  const [, navigate] = useLocation();
  const started = useRef(false);
  const claim = useMutation({
    mutationFn: claimPairing,
    onSuccess: (channel) => navigate(`/c/${channel.id}`, { replace: true }),
  });

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;
    claim.mutate(code);
  }, [code, claim]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      {!code && <p>This pairing link has no code.</p>}
      {claim.isPending && <p className="text-muted-foreground">Pairing…</p>}
      {claim.error && <p className="text-destructive">{claim.error.message}</p>}
      {(!code || claim.error) && (
        <Link href="/" className="text-sm underline underline-offset-4">
          Back to inbox
        </Link>
      )}
    </div>
  );
}
