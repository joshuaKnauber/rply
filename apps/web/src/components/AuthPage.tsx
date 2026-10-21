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
import type { OAuthProvider } from "@rply/schema";

type Mode = "sign-in" | "sign-up" | "forgot";

const PROVIDERS: Record<OAuthProvider, { label: string; icon: string }> = {
  github: {
    label: "GitHub",
    icon: "M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .32.21.69.82.57A12 12 0 0 0 12 .3",
  },
  google: {
    label: "Google",
    icon: "M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.08 1.08-2.77 2.26-5.72 2.26-4.6 0-8.2-3.71-8.2-8.31s3.6-8.31 8.2-8.31c2.48 0 4.3.98 5.63 2.24l2.31-2.31C18.85 1.9 16.2.48 12.48.48 5.86.48.33 5.88.33 12.5s5.53 12.02 12.15 12.02c3.58 0 6.28-1.18 8.39-3.37 2.17-2.17 2.84-5.21 2.84-7.67 0-.76-.06-1.46-.18-2.04z",
  },
};

function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={PROVIDERS[provider].icon} />
    </svg>
  );
}

export function AuthPage() {
  const info = useServerInfo();
  const claiming = useLocation()[0] === "/claim";
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  // the provider redirects back here with ?error=<code> when sign-in fails, e.g. closed registration
  const oauthError = new URLSearchParams(useSearch()).get("error");

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
  const social = useMutation({
    mutationFn: (provider: OAuthProvider) => {
      const back = location.pathname + location.search;
      return orThrow(authClient.signIn.social({ provider, callbackURL: back, newUserCallbackURL: back, errorCallbackURL: location.pathname }));
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
  const error = submit.error ?? social.error ?? passkey.error ?? magicLink.error;
  const oauth = mode === "forgot" ? [] : (info?.oauth ?? []);
  const signInExtras = !signingUp && mode === "sign-in";

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
            {error ? (
              <p className="text-destructive text-sm">{error.message}</p>
            ) : (
              oauthError && <p className="text-destructive text-sm">Sign-in failed: {oauthError.replaceAll("_", " ")}.</p>
            )}
            <Button type="submit" size="lg" disabled={submit.isPending}>
              {mode === "forgot" ? "Send reset link" : signingUp ? "Create account" : "Sign in"}
            </Button>
            {(oauth.length > 0 || (signInExtras && (info?.passkeys || info?.email))) && (
              <div className="flex flex-col gap-2">
                {oauth.map((provider) => (
                  <Button key={provider} type="button" variant="outline" size="lg" disabled={social.isPending} onClick={() => social.mutate(provider)}>
                    <ProviderIcon provider={provider} />
                    Continue with {PROVIDERS[provider].label}
                  </Button>
                ))}
                {signInExtras && info?.passkeys && (
                  <Button type="button" variant="outline" size="lg" disabled={passkey.isPending} onClick={() => passkey.mutate()}>
                    <KeyRoundIcon />
                    Sign in with a passkey
                  </Button>
                )}
                {signInExtras && info?.email && (
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
