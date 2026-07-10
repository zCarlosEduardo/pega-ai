"use client";
import { useState } from "react";
import { Users, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/nav";
import { StatusBar } from "@/components/ui/Surface";
import { Input, Label } from "@/components/ui/PegaInput";
import { Button } from "@/components/ui/PegaButton";
import { cn } from "@/lib/cn";

export function NewList({ shared: initialShared = true }: { shared?: boolean }) {
  const s = useStore();
  const { close, open } = useNav();
  const [name, setName] = useState("");
  const [shared, setShared] = useState(initialShared);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const id = await s.addList(name.trim(), shared);
    setBusy(false);
    if (id) open({ kind: "list", id });
    else close();
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-bg anim-sheet">
      <StatusBar />
      <div className="flex items-center justify-between px-5 py-2">
        <h1 className="text-[22px] font-semibold">Nova lista</h1>
        <button onClick={close} className="text-[14px] text-text-2 hover:text-text">Cancelar</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mt-3">
          <Label>Título</Label>
          <Input value={name} onChange={setName} placeholder="Mercado da semana" autoFocus />
        </div>

        <Label>Tipo</Label>
        <div className="grid grid-cols-2 gap-2">
          <TypeCard
            active={shared}
            onClick={() => setShared(true)}
            icon={<Users size={18} />}
            title="Compartilhada"
            sub="Os dois veem e editam"
          />
          <TypeCard
            active={!shared}
            onClick={() => setShared(false)}
            icon={<Lock size={18} />}
            title="Minha"
            sub="Só você vê"
          />
        </div>
      </div>

      <div className="border-t border-border p-5">
        <Button full onClick={create} disabled={busy || !name.trim()}>{busy ? "Criando…" : "Criar lista"}</Button>
      </div>
    </div>
  );
}

function TypeCard({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border px-4 py-3.5 text-left transition-all",
        active ? "border-accent bg-accent/10" : "border-border bg-surface",
      )}
    >
      <span className={cn("grid h-9 w-9 place-items-center rounded-md", active ? "bg-accent/20 text-accent" : "bg-surface-hi text-text-2")}>{icon}</span>
      <span className="text-[14px] font-semibold">{title}</span>
      <span className="text-[12px] text-text-3">{sub}</span>
    </button>
  );
}
