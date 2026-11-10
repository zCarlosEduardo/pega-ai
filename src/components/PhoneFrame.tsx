"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Home, ListTodo, Pill, CalendarDays, Plus, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { StatusBar } from "@/components/ui/Surface";
import { Tab, useNav } from "@/lib/nav";
import { useStore } from "@/lib/store";

/**
 * O botão de ação (+) NÃO pode ser filho do container que rola: um `absolute` dentro de um
 * `overflow-y-auto` rola junto com o conteúdo e acaba no fim da lista. Ele é renderizado num
 * "slot" irmão da área de scroll (ver <Fab/>), então fica fixo sobre a barra de abas.
 */
const FabSlotCtx = createContext<HTMLElement | null>(null);

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  const slot = useContext(FabSlotCtx);
  if (!slot) return null;
  return createPortal(
    <button
      onClick={onClick}
      aria-label={label}
      className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-[#0a0a0e] shadow-[0_8px_24px_-6px_rgba(157,140,246,0.6)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
    >
      <Plus size={22} strokeWidth={2.5} />
    </button>,
    slot,
  );
}

export function PhoneFrame({
  children,
  overlay,
  showTabBar = true,
  showStatus = true,
}: {
  children: React.ReactNode;
  overlay?: React.ReactNode;
  showTabBar?: boolean;
  showStatus?: boolean;
}) {
  const [fabSlot, setFabSlot] = useState<HTMLElement | null>(null);
  return (
    <div className="h-[100dvh] w-full flex items-stretch justify-center md:items-center md:py-8">
      <div
        className={cn(
          "relative w-full max-w-[440px] bg-bg flex flex-col overflow-hidden",
          // no desktop vira "celular"; no mobile ocupa tudo
          "h-[100dvh] md:h-[860px] md:max-h-[90dvh] md:rounded-[40px] md:border md:border-border md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]",
        )}
      >
        {showStatus && <StatusBar />}
        <SyncBanner />
        <FabSlotCtx.Provider value={fabSlot}>
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 overflow-y-auto overscroll-contain">{children}</div>
            <div ref={setFabSlot} className="pointer-events-none absolute bottom-5 right-5 z-30" />
          </div>
        </FabSlotCtx.Provider>
        {showTabBar && <TabBar />}
        {overlay}
        <Toaster />
      </div>
    </div>
  );
}

function SyncBanner() {
  const s = useStore();
  if (s.unsynced && !s.syncWarning) {
    return (
      <div role="status" className="mx-4 mb-1 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-text">
        <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warning" />
        <span className="flex-1">Algumas alterações ainda não chegaram ao servidor. Enquanto isso, só este aparelho vê o que foi criado. Verifique a internet e mantenha o app aberto.</span>
      </div>
    );
  }
  if (!s.syncWarning) return null;
  return (
    <div role="status" className="mx-4 mb-1 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-text">
      <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warning" />
      <span className="flex-1">{s.syncWarning}</span>
      <button onClick={s.retryBoot} className="shrink-0 font-medium text-accent-soft underline underline-offset-2">Tentar de novo</button>
    </div>
  );
}

function Toaster() {
  const { toast, dismissToast } = useStore();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 5000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role={toast.tone === "error" ? "alert" : "status"}
      className={cn(
        "anim-fade absolute inset-x-4 bottom-24 z-[70] flex items-start gap-2 rounded-md border px-3.5 py-3 text-[13px] shadow-lg",
        toast.tone === "error" ? "border-error/40 bg-surface-hi text-text" : "border-border bg-surface-hi text-text",
      )}
    >
      <span className="flex-1">{toast.msg}</span>
      <button onClick={dismissToast} aria-label="Fechar aviso" className="shrink-0 text-text-3 hover:text-text">
        <X size={16} />
      </button>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "listas", label: "Listas", icon: ListTodo },
  { id: "saude", label: "Saúde", icon: Pill },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
];

function TabBar() {
  const { tab, setTab } = useNav();
  return (
    <nav aria-label="Principal" className="shrink-0 border-t border-border bg-bg/90 backdrop-blur-xl px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
      <div className="flex items-stretch justify-around">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-1 py-1.5 transition-colors"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={cn(active ? "text-accent" : "text-text-3")}
              />
              <span
                className={cn(
                  "text-[11px]",
                  active ? "text-accent font-medium" : "text-text-3",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
