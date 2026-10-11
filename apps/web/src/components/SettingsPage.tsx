import { ArrowLeftIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { RadioGroup } from "radix-ui";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const themes = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

export function SettingsPage() {
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
          <Setting title="Theme" description="Follow your system, or pick light or dark.">
            <ThemePicker />
          </Setting>
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
