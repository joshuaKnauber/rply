import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useLocation } from "wouter";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { claimPairing, parsePairingInput } from "@/lib/pairing";

const LENGTH = 8;
const clean = (text: string) => text.toUpperCase().replace(/[^0-9A-Z]/g, "");

export function PairingCodeInput({ autoFocus }: { autoFocus?: boolean }) {
  const [code, setCode] = useState("");
  const [, navigate] = useLocation();
  const claim = useMutation({ mutationFn: claimPairing, onSuccess: (channel) => navigate(`/c/${channel.id}`) });

  const slot = (index: number) => <InputOTPSlot key={index} index={index} aria-invalid={Boolean(claim.error)} className="size-10 font-mono text-base" />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <InputOTP
          autoFocus={autoFocus}
          maxLength={LENGTH}
          value={code}
          pattern="^[0-9A-Za-z]*$"
          pasteTransformer={(text) => clean(parsePairingInput(text)).slice(0, LENGTH)}
          onChange={(value) => {
            setCode(clean(value));
            claim.reset();
          }}
          onComplete={(value) => claim.mutate(clean(value))}
          disabled={claim.isPending}
        >
          <InputOTPGroup>{[0, 1, 2, 3].map(slot)}</InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>{[4, 5, 6, 7].map(slot)}</InputOTPGroup>
        </InputOTP>
        {claim.isPending && <Loader2Icon className="text-muted-foreground size-4 animate-spin" />}
      </div>
      {claim.error && <p className="text-destructive text-sm">{claim.error.message}</p>}
    </div>
  );
}
