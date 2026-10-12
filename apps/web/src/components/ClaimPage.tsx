import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { channelsKey } from "@/lib/channels";
import { claimChannel } from "@/lib/onboarding";

export function ClaimPage() {
  const code = new URLSearchParams(useSearch()).get("c");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const started = useRef(false);
  const claim = useMutation({
    mutationFn: claimChannel,
    onSuccess: async (channel) => {
      await queryClient.invalidateQueries({ queryKey: channelsKey });
      navigate(`/c/${channel.id}`, { replace: true });
    },
  });

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;
    claim.mutate(code);
  }, [code, claim]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      {!code && <p>This link has no claim code.</p>}
      {claim.isPending && <p className="text-muted-foreground">Adding the channel…</p>}
      {claim.error && <p className="text-destructive">{claim.error.message}</p>}
      {(!code || claim.error) && (
        <Link href="/" className="text-sm underline underline-offset-4">
          Back to inbox
        </Link>
      )}
    </div>
  );
}
