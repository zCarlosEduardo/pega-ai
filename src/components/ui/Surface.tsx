"use client";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  onClick,
  elevated,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  elevated?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border p-5",
        elevated ? "bg-surface-hi" : "bg-surface",
        onClick && "cursor-pointer transition-colors hover:border-[#2a2c38]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-md bg-surface p-1 border border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 h-9 rounded-[10px] text-[14px] font-medium transition-all duration-[180ms] ease-out",
            value === t.id
              ? "bg-surface-hi text-text shadow-[0_1px_0_rgba(255,255,255,0.03)]"
              : "text-text-3 hover:text-text-2",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Logo "dois círculos" do espaço (lilás + pêssego sobrepostos)
export function SpaceLogo({ size = 80 }: { size?: number }) {
  return (
    <div
      className="relative anim-fade"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.72,
          height: size * 0.72,
          left: 0,
          top: size * 0.14,
          background: "radial-gradient(circle at 35% 30%, #b6a6ff, var(--p1))",
          filter: "blur(0.2px)",
        }}
      />
      <div
        className="absolute rounded-full mix-blend-screen"
        style={{
          width: size * 0.72,
          height: size * 0.72,
          right: 0,
          top: size * 0.14,
          background: "radial-gradient(circle at 65% 35%, #ffd9b8, var(--p2))",
        }}
      />
    </div>
  );
}

export function StatusBar() {
  // Sem hora/bateria falsa. No mobile só reservamos a área do notch
  // (a barra real do aparelho aparece por cima); no desktop, um respiro.
  return <div style={{ height: "max(env(safe-area-inset-top), 8px)" }} />;
}
