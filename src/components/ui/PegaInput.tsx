"use client";
import { cn } from "@/lib/cn";

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-mono text-[11px] tracking-[0.12em] uppercase text-text-3 mb-2">
      {children}
    </span>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  leading,
  className,
  mono,
  autoFocus,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  leading?: React.ReactNode;
  className?: string;
  mono?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className={className}>
      <div
        className={cn(
          "flex items-center gap-2 h-12 px-4 rounded-md bg-surface border transition-colors duration-[180ms]",
          "border-border focus-within:border-accent",
          error && "border-error focus-within:border-error",
        )}
      >
        {leading && <span className="text-text-3 shrink-0">{leading}</span>}
        <input
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          type={type}
          className={cn(
            "w-full bg-transparent outline-none text-[15px] text-text placeholder:text-text-3",
            mono && "font-mono tracking-[0.18em]",
          )}
        />
      </div>
      {error && <p className="mt-2 text-[13px] text-error">{error}</p>}
    </div>
  );
}
