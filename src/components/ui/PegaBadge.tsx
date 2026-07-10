import { cn } from "@/lib/cn";

type Tone = "accent" | "neutral" | "success" | "warning" | "error";

export function Badge({
  children,
  tone = "neutral",
  dot,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  const tones: Record<Tone, string> = {
    accent: "bg-accent/12 text-accent-soft",
    neutral: "bg-surface-hi text-text-2 border border-border",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
    error: "bg-error/12 text-error",
  };
  const dotColor: Record<Tone, string> = {
    accent: "bg-accent",
    neutral: "bg-text-3",
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-error",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none",
        tones[tone],
      )}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[tone])} />
      )}
      {children}
    </span>
  );
}
