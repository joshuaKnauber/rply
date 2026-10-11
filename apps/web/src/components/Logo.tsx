import { cn } from "@/lib/utils";
import { Bird } from "./Bird";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-brand-600 from-brand-400 to-brand-500 grid size-6 shrink-0 place-items-center rounded-lg border bg-linear-to-b text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]",
        className,
      )}
    >
      <Bird className="w-[58%]" />
    </span>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <Bird className="w-5" />
      rply.sh
    </span>
  );
}
