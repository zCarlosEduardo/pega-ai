"use client";
import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { useStore, List } from "@/lib/store";
import { useNav } from "@/lib/nav";
import { Card, Segmented } from "@/components/ui/Surface";
import { Checkbox, Avatar } from "@/components/ui/Inputs";
import { cn } from "@/lib/cn";

const DOT: Record<List["dotColor"], string> = { success: "bg-success", accent: "bg-accent", warning: "bg-warning" };

export function ListsScreen() {
  const s = useStore();
  const { open } = useNav();
  const [tab, setTab] = useState<"shared" | "mine">("shared");

  const lists = s.lists.filter((l) => (tab === "shared" ? l.shared : !l.shared));

  return (
    <div className="anim-screen px-5 pb-28">
      <h1 className="pt-2 text-[28px] font-semibold">Listas</h1>

      <div className="mt-4">
        <Segmented
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "shared", label: "Compartilhadas" },
            { id: "mine", label: "Minhas" },
          ]}
        />
      </div>

      {lists.length === 0 ? (
        <EmptyLists shared={tab === "shared"} />
      ) : (
        <div className="mt-5 space-y-4">
          {lists.map((l) => {
            const done = l.items.filter((i) => i.done).length;
            const total = l.items.length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <Card key={l.id} className="p-4" onClick={() => open({ kind: "list", id: l.id })}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[16px] font-semibold">
                    <span className={cn("h-2.5 w-2.5 rounded-full", DOT[l.dotColor])} />
                    {l.name}
                  </span>
                  <span className="font-mono text-[13px] text-text-3">{done}/{total}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hi">
                  <div className={cn("h-full rounded-full transition-all duration-[240ms]", DOT[l.dotColor])} style={{ width: `${pct}%` }} />
                </div>
                {total > 0 && (
                  <div className="mt-3 space-y-1" onClick={(e) => e.stopPropagation()}>
                    {l.items.slice(0, 4).map((it) => {
                      if (it.everyone) {
                        const doneBy = it.doneBy ?? [];
                        return (
                          <div key={it.id} className="flex items-center gap-2 py-1">
                            <span className={cn("flex-1 text-[15px]", it.done ? "text-text-3 line-through" : "text-text")}>{it.text}</span>
                            <div className="flex items-center gap-3">
                              {s.people.map((p) => (
                                <span key={p.id} className="flex items-center gap-1.5">
                                  <Checkbox checked={doneBy.includes(p.id)} size={18} onChange={() => s.toggleItemMember(l.id, it.id, p.id)} />
                                  <Avatar name={p.name} color={p.color} size={18} />
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      const who = s.personById(it.assignee);
                      return (
                        <div key={it.id} className="flex items-center gap-3 py-1">
                          <Checkbox checked={it.done} onChange={() => s.toggleItem(l.id, it.id)} />
                          <span className={cn("flex-1 text-[15px]", it.done ? "text-text-3 line-through" : "text-text")}>{it.text}</span>
                          {who ? (
                            <span className="flex items-center gap-1.5">
                              <Avatar name={who.name} color={who.color} size={20} />
                              <span className="text-[12px] text-text-3">{who.name.split(" ")[0]}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-3">qualquer um</span>
                          )}
                        </div>
                      );
                    })}
                    {total > 4 && <p className="pt-1 text-[12px] text-text-3">+{total - 4} itens</p>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <button
        onClick={() => open({ kind: "new-list", shared: tab === "shared" })}
        className="absolute bottom-5 right-5 grid h-12 w-12 place-items-center rounded-full bg-accent text-[#0a0a0e] shadow-[0_8px_24px_-6px_rgba(157,140,246,0.6)] active:scale-95 transition-transform"
        aria-label="Nova lista"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function EmptyLists({ shared }: { shared: boolean }) {
  const { open } = useNav();
  return (
    <div className="mt-10 grid place-items-center rounded-lg border border-border bg-surface px-6 py-12 text-center">
      <p className="text-[16px] font-semibold">{shared ? "Nenhuma lista compartilhada" : "Nenhuma lista sua ainda"}</p>
      <p className="mt-1 max-w-[240px] text-[13px] text-text-2">
        {shared ? "Comecem por uma — o mercado da semana é um bom começo." : "Crie uma lista só sua para o que for pessoal."}
      </p>
      <button
        onClick={() => open({ kind: "new-list", shared })}
        className="mt-4 rounded-md border border-border bg-surface-hi px-4 py-2 text-[14px] font-medium"
      >
        Criar lista
      </button>
    </div>
  );
}
