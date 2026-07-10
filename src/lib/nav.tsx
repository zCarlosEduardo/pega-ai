"use client";
import { createContext, useCallback, useContext, useState } from "react";

export type Tab = "inicio" | "listas" | "saude" | "agenda";

export type Overlay =
  | { kind: "list"; id: string }
  | { kind: "med"; id: string }
  | { kind: "date"; id: string }
  | { kind: "new-med"; editId?: string }
  | { kind: "new-list"; shared?: boolean }
  | { kind: "new-date"; id?: string }
  | { kind: "search" }
  | { kind: "achievements" }
  | { kind: "profile" }
  | { kind: "settings" };

type Nav = {
  tab: Tab;
  setTab: (t: Tab) => void;
  overlay: Overlay | null;
  open: (o: Overlay) => void;
  close: () => void;
};

const Ctx = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("inicio");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const open = useCallback((o: Overlay) => setOverlay(o), []);
  const close = useCallback(() => setOverlay(null), []);
  return (
    <Ctx.Provider value={{ tab, setTab: (t) => { setOverlay(null); setTab(t); }, overlay, open, close }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNav() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNav fora do provider");
  return v;
}
