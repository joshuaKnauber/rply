import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, KeyRoundIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { RadioGroup } from "radix-ui";
import { toast } from "sonner";
import { Link } from "wouter";
import type { AccountUsage } from "@rply/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { authClient, orThrow, signOut, useSession } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { useServerInfo } from "@/lib/queries";
import { confirmDialog } from "./ConfirmDialog";

const themes = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

export function SettingsPage() {
  const info = useServerInfo();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
        <Button asChild size="icon" variant="ghost" className="-ml-3 md:hidden" aria-label="Back">
          <Link href="/">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h1 className="font-medium tracking-normal">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto flex max-w-2xl flex-col divide-y py-6">
          <Account />
          <UsageSection />
          <Setting title="Theme" description="Follow your system, or pick light or dark.">
            <ThemePicker />
          </Setting>
          <Password />
          {info?.passkeys && <Passkeys />}
          <Setting title="Your data" description="Download your account and every channel you're in, with messages, agents and app storage, as JSON.">
            <Button asChild variant="outline">
              <a href="/v1/account/export" download>
                Download
              </a>
            </Button>
          </Setting>
          <DeleteAccount />
        </div>
      </div>
    </div>
  );
}

function Setting({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-medium tracking-normal">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Section({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 py-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-medium tracking-normal">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Account() {
  const { data } = useSession();
  const queryClient = useQueryClient();
  return (
    <Setting title="Account" description={data?.user.email ?? ""}>
      <Button variant="outline" onClick={() => signOut(() => queryClient.clear())}>
        Sign out
      </Button>
    </Setting>
  );
}

const megabytes = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

// only what this server limits; self-hosted servers without quotas show nothing
function UsageSection() {
  const { data } = useQuery({ queryKey: ["usage"], queryFn: () => api<AccountUsage>("/account/usage"), refetchOnWindowFocus: true });
  if (!data) return null;
  const rows = [
    data.channels && { label: "Channels you own", ...data.channels, text: `${data.channels.used} of ${data.channels.limit}` },
    data.messages_per_day && { label: "Messages in the last 24 hours", ...data.messages_per_day, text: `${data.messages_per_day.used} of ${data.messages_per_day.limit}` },
    data.storage && { label: "File storage", ...data.storage, text: `${megabytes(data.storage.used)} of ${megabytes(data.storage.limit)}` },
  ].filter((row) => row !== null);
  if (rows.length === 0 && data.message_retention_days === null) return null;

  return (
    <Section title="Usage" description="Your account's limits on this server, counted over the channels you own.">
      {rows.length > 0 && (
        <ul className="flex max-w-sm flex-col gap-4">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{row.label}</span>
                <span className="text-muted-foreground tabular-nums">{row.text}</span>
              </div>
              <Progress value={Math.min(100, (row.used / row.limit) * 100)} />
            </li>
          ))}
        </ul>
      )}
      {data.message_retention_days !== null && (
        <p className="text-muted-foreground text-sm">Messages are kept for {data.message_retention_days} days, pinned ones until they're removed.</p>
      )}
    </Section>
  );
}

function Password() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const change = useMutation({
    mutationFn: () => orThrow(authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true })),
    onSuccess: () => {
      toast.success("Password changed. Your other devices were signed out.");
      setOpen(false);
      setCurrent("");
      setNext("");
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    change.mutate();
  };

  return (
    <Section
      title="Password"
      description="Changing it signs you out on your other devices."
      action={!open && <Button variant="outline" onClick={() => setOpen(true)}>Change</Button>}
    >
      {open && (
        <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
          <Input type="password" autoComplete="current-password" placeholder="Current password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="h-9" />
          <Input type="password" autoComplete="new-password" placeholder="New password, at least 8 characters" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className="h-9" />
          {change.error && <p className="text-destructive text-sm">{change.error.message}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={change.isPending}>Save</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </Section>
  );
}

function Passkeys() {
  const queryClient = useQueryClient();
  const { data: passkeys } = useQuery({ queryKey: ["passkeys"], queryFn: async () => (await orThrow(authClient.passkey.listUserPasskeys())) ?? [] });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["passkeys"] });
  const add = useMutation({
    mutationFn: () => orThrow(authClient.passkey.addPasskey()),
    onSuccess: () => (refresh(), toast.success("Passkey added")),
    onError: (err) => toast.error(err.message),
  });
  const remove = async (id: string) => {
    const ok = await confirmDialog({ title: "Remove this passkey?", description: "You can't sign in with it anymore.", action: "Remove", destructive: true });
    if (!ok) return;
    await orThrow(authClient.passkey.deletePasskey({ id })).then(refresh, (err: Error) => toast.error(err.message));
  };

  return (
    <Section
      title="Passkeys"
      description="Sign in with your fingerprint, face or device PIN instead of a password."
      action={<Button variant="outline" disabled={add.isPending} onClick={() => add.mutate()}>Add passkey</Button>}
    >
      {passkeys && passkeys.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {passkeys.map((p) => (
            <li key={p.id} className="group/row flex items-center gap-2.5">
              <KeyRoundIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate">{p.name ?? "Passkey"}</span>
              <span className="text-muted-foreground ml-auto text-xs group-hover/row:hidden">Added {formatTime(new Date(p.createdAt).getTime())}</span>
              <Button size="xs" variant="ghost" className="text-muted-foreground -mr-2 ml-auto hidden group-hover/row:flex" onClick={() => remove(p.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function DeleteAccount() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const remove = useMutation({
    mutationFn: async () => {
      await orThrow(authClient.deleteUser(password ? { password } : {}));
      await signOut(() => queryClient.clear());
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    remove.mutate();
  };

  return (
    <Section
      title="Delete account"
      description="Deletes your account and every channel you own, with their messages, files and apps. Their agents lose access. This can't be undone."
      action={!open && <Button variant="outline" onClick={() => setOpen(true)}>Delete account</Button>}
    >
      {open && (
        <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
          <Input type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-9" />
          <p className="text-muted-foreground text-sm">Signed in without a password? Leave it empty if you signed in today.</p>
          {remove.error && <p className="text-destructive text-sm">{remove.error.message}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={remove.isPending}>Delete everything</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </Section>
  );
}

function ThemePicker() {
  const { theme = "system", setTheme } = useTheme();
  return (
    <RadioGroup.Root value={theme} onValueChange={setTheme} aria-label="Theme" className="bg-muted flex w-fit shrink-0 gap-1 rounded-lg p-1">
      {themes.map(({ value, label, icon: Icon }) => (
        <RadioGroup.Item
          key={value}
          value={value}
          className="text-muted-foreground hover:text-foreground data-[state=checked]:bg-background data-[state=checked]:text-foreground focus-visible:ring-ring/50 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 data-[state=checked]:shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_1px_2px_rgb(0_0_0/0.1)] dark:data-[state=checked]:bg-gray-800 dark:data-[state=checked]:shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
        >
          <Icon className="size-4" />
          {label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
