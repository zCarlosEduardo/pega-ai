"use client";
import { Check } from "lucide-react";
import { cn, PERSON_HEX, PersonColor, initial } from "@/lib/cn";

export function Checkbox({
  checked,
  onChange,
  size = 22,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!checked)}
      style={{ width: size, height: size }}
      className={cn(
        "grid place-items-center rounded-[7px] border transition-all duration-[120ms] ease-out shrink-0",
        checked
          ? "bg-accent border-accent anim-reward"
          : "bg-transparent border-border hover:border-text-3",
      )}
      aria-pressed={checked}
    >
      {checked && <Check size={size * 0.62} strokeWidth={3} className="text-[#0a0a0e]" />}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors duration-[180ms] ease-out shrink-0",
        checked ? "bg-accent" : "bg-surface-hi border border-border",
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-[18px] w-[18px] rounded-full bg-white transition-all duration-[180ms] ease-out",
          checked ? "left-[22px]" : "left-[3px]",
        )}
      />
    </button>
  );
}

export function Avatar({
  name,
  color,
  size = 36,
  src,
}: {
  name: string;
  color?: PersonColor;
  size?: number;
  src?: string;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: color ? PERSON_HEX[color] : "var(--surface-hi)",
        color: color ? "#0a0a0e" : "var(--text-2)",
      }}
      className="inline-grid place-items-center rounded-full font-semibold overflow-hidden shrink-0"
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initial(name)
      )}
    </span>
  );
}

// pequeno avatar de atribuição (canto do item)
export function PersonDot({
  name,
  color,
  size = 20,
}: {
  name: string;
  color: PersonColor;
  size?: number;
}) {
  return <Avatar name={name} color={color} size={size} />;
}
