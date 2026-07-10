"use client";
import { Check, Pill, Plus } from "lucide-react";
import { useStore, Med } from "@/lib/store";
import { useNav } from "@/lib/nav";
import { Badge } from "@/components/ui/PegaBadge";
import { Button } from "@/components/ui/PegaButton";
import { cn } from "@/lib/cn";

export function HealthScreen() {
  const s = useStore();
  const { open } = useNav();
  const adherence = s.meds.length
    ? Math.round(s.meds.reduce((a, m) => a + m.adherence, 0) / s.meds.length)
    : 0;

  return (
    <div className="anim-screen px-5 pb-28">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-[28px] font-semibold">Remédios</h1>
        <div className="flex items-center gap-2">
          {s.meds.length > 0 && (
            <Badge tone="success" dot>
              Adesão {adherence}%
            </Badge>
          )}
          <button
            onClick={() => open({ kind: "new-med" })}
            className="grid h-9 w-9 place-items-center rounded-full bg-surface-hi text-accent"
            aria-label="Novo remédio"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {s.meds.length === 0 ? (
        <div className="mt-24 flex flex-col items-center px-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-hi text-accent">
            <Pill size={26} />
          </span>
          <p className="mt-4 text-[16px] font-semibold">Nenhum remédio ainda</p>
          <p className="mt-1 text-[13px] text-text-3">
            Cadastre os remédios de vocês pra acompanhar horários e adesão juntos.
          </p>
          <Button className="mt-5" onClick={() => open({ kind: "new-med" })}>
            <Plus size={16} /> Adicionar remédio
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-3 mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-3">
            Hoje
          </p>
          <div className="space-y-3">
            {s.meds.map((m) => (
              <MedRow key={m.id} med={m} onOpen={() => open({ kind: "med", id: m.id })} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MedRow({ med, onOpen }: { med: Med; onOpen: () => void }) {
  const s = useStore();
  const who = s.personById(med.assignee);
  const active = med.status === "agora";

  return (
    <div className="flex items-stretch gap-3">
      <span className="w-12 shrink-0 pt-3.5 text-right font-mono text-[13px] text-text-3">
        {med.time}
      </span>
      <div
        onClick={onOpen}
        className={cn(
          "flex-1 cursor-pointer rounded-lg border px-4 py-3.5 transition-colors",
          active ? "border-accent/40 bg-surface-hi" : "border-border bg-surface hover:border-[#2a2c38]",
        )}
      >
        <div className="flex items-center gap-3">
          {med.status === "tomado" ? (
            <span className="grid h-8 w-8 place-items-center rounded-md bg-success/15 text-success">
              <Check size={17} strokeWidth={3} />
            </span>
          ) : active ? (
            <span className="grid h-8 w-8 place-items-center rounded-md bg-accent/15 text-accent">
              <Pill size={16} />
            </span>
          ) : (
            <span className="h-8 w-8 rounded-md border border-border" />
          )}
          <div className="flex-1">
            <p className="text-[15px] font-semibold">{med.name}</p>
            <p className="text-[12px] text-text-3">
              {med.dose} · {who?.name}
            </p>
          </div>
          <span
            className={cn(
              "text-[12px]",
              med.status === "tomado" ? "text-text-3" : active ? "text-accent" : "text-text-3",
            )}
          >
            {med.status === "tomado" ? "tomado" : active ? med.inLabel : "pendente"}
          </span>
        </div>
        {active && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button full className="mt-3 h-10" onClick={() => s.toggleMedIntake(med.id, med.time, true)}>
              Marcar como tomado
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
