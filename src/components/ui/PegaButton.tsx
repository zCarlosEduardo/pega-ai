"use client";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  children,
  variant = "primary",
  full,
  className,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  variant?: Variant;
  full?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md text-[15px] font-semibold h-12 px-5 select-none transition-all duration-[180ms] ease-out active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40 disabled:pointer-events-none";

  const variants: Record<Variant, string> = {
    primary: "bg-accent text-[#0a0a0e] hover:brightness-105",
    secondary:
      "bg-surface-hi text-text border border-border hover:bg-[#222431]",
    ghost: "bg-transparent text-text-2 hover:text-text hover:bg-surface",
    danger: "bg-transparent text-error border border-error/30 hover:bg-error/10",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(base, variants[variant], full && "w-full", className)}
    >
      {children}
    </button>
  );
}
