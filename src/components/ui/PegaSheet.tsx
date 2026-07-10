"use client";
import { cn } from "@/lib/cn";

export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50">
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-[3px] anim-fade"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 anim-sheet">
        <div className="rounded-t-xl bg-surface border-t border-border px-5 pb-6 pt-3">
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border" />
          {children}
        </div>
      </div>
    </div>
  );
}

// Modal de tela cheia que sobe (ex: Novo remédio / Nova data)
export function FullSheet({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 bg-bg anim-sheet flex flex-col">
      {children}
    </div>
  );
}

export function Row({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md bg-surface border border-border px-4 py-3.5",
        onClick && "cursor-pointer transition-colors hover:border-[#2a2c38]",
        className,
      )}
    >
      {children}
    </div>
  );
}
