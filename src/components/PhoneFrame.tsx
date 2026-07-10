"use client";
import { Home, ListTodo, Pill, CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";
import { StatusBar } from "@/components/ui/Surface";
import { Tab, useNav } from "@/lib/nav";

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
        <div className="relative flex-1 overflow-y-auto">{children}</div>
        {showTabBar && <TabBar />}
        {overlay}
      </div>
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
    <nav className="shrink-0 border-t border-border bg-bg/90 backdrop-blur-xl px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
      <div className="flex items-stretch justify-around">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
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
