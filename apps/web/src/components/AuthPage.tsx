import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRoundIcon, MailIcon } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, orThrow } from "@/lib/auth";
import { useServerInfo } from "@/lib/queries";
import { Logo } from "./Logo";

type Mode = "sign-in" | "sign-up" | "forgot";

export function AuthPage() {
  const info = useServerInfo();
  const claiming = useLocation()[0] === "/claim";
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const setup = info?.needs_setup ?? false;
  const signingUp = setup || mode === "sign-up";
  const canRegister = setup || info?.registration === "open";

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "forgot") {
        await orThrow(authClient.requestPasswordReset({ email, redirectTo: `${location.origin}/reset-password` }));
        return setSent("If that email has an account, a reset link is on its way.");
      }
      if (signingUp) {
        await orThrow(authClient.signUp.email({ email, password, name: email.split("@")[0]! }));
        if (info?.email) setSent("Check your email to confirm your address, then sign in.");
        return;
      }
      await orThrow(authClient.signIn.email({ email, password }));
    },
  });
  const passkey = useMutation({ mutationFn: () => orThrow(authClient.signIn.passkey()) });
  const magicLink = useMutation({
    mutationFn: async () => {
      await orThrow(authClient.signIn.magicLink({ email, callbackURL: location.pathname + location.search }));
      setSent(`We sent a sign-in link to ${email}.`);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit.mutate();
  };
  const switchTo = (next: Mode) => {
    setMode(next);
    setSent(null);
    submit.reset();
  };

  const title = setup ? "Set up rply" : mode === "forgot" ? "Reset your password" : signingUp ? "Create an account" : "Sign in";
  const description = setup
    ? "Create the first account. It owns this server."
    : claiming
      ? "Sign in to add the channel your agent created."
      : mode === "forgot"
        ? "We'll email you a link to choose a new password."
        : "Your agents' messages, questions and apps, on every device.";
  const error = submit.error ?? passkey.error ?? magicLink.error;

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {sent ? (
          <p className="bg-muted rounded-lg p-3 text-sm">{sent}</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
            </div>
            {mode !== "forgot" && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {!signingUp && info?.email && (
                    <button type="button" className="text-muted-foreground hover:text-foreground text-sm" onClick={() => switchTo("forgot")}>
                      Forgot it?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9"
                />
                {signingUp && <p className="text-muted-foreground text-sm">At least 8 characters.</p>}
              </div>
            )}
            {error && <p className="text-destructive text-sm">{error.message}</p>}
            <Button type="submit" size="lg" disabled={submit.isPending}>
              {mode === "forgot" ? "Send reset link" : signingUp ? "Create account" : "Sign in"}
            </Button>
            {!signingUp && mode === "sign-in" && (info?.passkeys || info?.email) && (
              <div className="flex flex-col gap-2">
                {info.passkeys && (
                  <Button type="button" variant="outline" size="lg" disabled={passkey.isPending} onClick={() => passkey.mutate()}>
                    <KeyRoundIcon />
                    Sign in with a passkey
                  </Button>
                )}
                {info.email && (
                  <Button type="button" variant="outline" size="lg" disabled={!email || magicLink.isPending} onClick={() => magicLink.mutate()}>
                    <MailIcon />
                    Email me a sign-in link
                  </Button>
                )}
              </div>
            )}
            {!signingUp && mode === "sign-in" && !info?.email && (
              <p className="text-muted-foreground text-sm">
                Forgot your password? The server's owner can reset it with <code className="font-mono">reset-password</code>.
              </p>
            )}
          </form>
        )}

        {!setup && (
          <p className="text-muted-foreground text-sm">
            {mode === "sign-in" ? (
              canRegister && (
                <>
                  New here?{" "}
                  <button className="text-foreground underline underline-offset-4" onClick={() => switchTo("sign-up")}>
                    Create an account
                  </button>
                </>
              )
            ) : (
              <button className="text-foreground underline underline-offset-4" onClick={() => switchTo("sign-in")}>
                Back to sign in
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const token = new URLSearchParams(useSearch()).get("token");
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const reset = useMutation({
    mutationFn: () => orThrow(authClient.resetPassword({ newPassword: password, token: token! })),
    onSuccess: () => navigate("/", { replace: true }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    reset.mutate();
  };

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
          <p className="text-muted-foreground">You'll be signed out on your other devices.</p>
        </div>
        {!token ? (
          <p className="text-destructive text-sm">This link has no reset token. Request a new one from the sign-in page.</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" autoFocus required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-9" />
            </div>
            {reset.error && <p className="text-destructive text-sm">{reset.error.message}</p>}
            <Button type="submit" size="lg" disabled={reset.isPending}>
              Save password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
