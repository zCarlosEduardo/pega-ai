"use client";
import { useState } from "react";
import { ChevronLeft, Pill, Check, X, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { MedInput } from "@/lib/store";
import { useNav } from "@/lib/nav";
import { StatusBar } from "@/components/ui/Surface";
import { Input, Label } from "@/components/ui/PegaInput";
import { Button } from "@/components/ui/PegaButton";
import { Toggle, Avatar } from "@/components/ui/Inputs";
import { cn } from "@/lib/cn";
import { computeTimes, intakeKey, todayKey } from "@/lib/meds";

export function MedDetail({ id }: { id: string }) {
  const s = useStore();
  const { close, open } = useNav();
  const med = s.meds.find((m) => m.id === id);
  if (!med) return null;
  const who = s.personById(med.assignee);
  const tKey = todayKey();

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg anim-screen">
      <StatusBar />
      <div className="flex items-center justify-between px-4 py-2">
        <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-surface" aria-label="Voltar">
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => open({ kind: "new-med", editId: med.id })} className="rounded-md border border-border px-3 py-1.5 text-[13px] text-text-2 hover:bg-surface">
            Editar
          </button>
          <button
            onClick={async () => { if (confirm("Excluir este remédio?")) { await s.deleteMed(med.id); close(); } }}
            className="grid h-9 w-9 place-items-center rounded-full text-error hover:bg-surface" aria-label="Excluir"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-md bg-surface-hi text-accent">
            <Pill size={22} />
          </span>
          <div>
            <h1 className="text-[22px] font-semibold">{med.name}</h1>
            <p className="text-[13px] text-text-2">
              {med.dose}{who ? ` · ${who.name}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border bg-surface px-4 py-3">
            <Label>Próximo</Label>
            <p className="font-mono text-[24px] font-semibold">{med.time}</p>
            {med.inLabel && <p className="font-mono text-[11px] text-text-3">{med.inLabel}</p>}
          </div>
          <div className="rounded-md border border-border bg-surface px-4 py-3">
            <Label>Adesão</Label>
            <p className="font-mono text-[24px] font-semibold text-success">{med.adherence}%</p>
          </div>
        </div>

        <p className="mb-2 mt-6 text-[12px] font-medium text-text-3">Detalhes</p>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <DetailRow label="Frequência" value={med.freqLabel} />
          <DetailRow label="Início" value={med.startLabel} />
          {typeof med.stock === "number" && (
            <DetailRow label="Estoque" value={`${med.stock} comprimidos`} warn={med.stock <= 8} last />
          )}
        </div>

        <p className="mb-2 mt-6 text-[12px] font-medium text-text-3">Horários de hoje</p>
        <div className="space-y-2">
          {med.times.map((hhmm) => {
            const taken = !!(s.meds.find((m) => m.id === med.id) as any)?.taken?.[intakeKey(tKey, hhmm)];
            return (
              <button
                key={hhmm}
                onClick={() => s.toggleMedIntake(med.id, hhmm, !taken)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-4 py-3 transition-colors",
                  taken ? "border-success/30 bg-success/10" : "border-border bg-surface hover:bg-surface-hi"
                )}
              >
                <span className="font-mono text-[15px] font-medium">{hhmm}</span>
                <span className={cn("flex items-center gap-2 text-[13px]", taken ? "text-success" : "text-text-2")}>
                  {taken ? "Tomado" : "Marcar como tomado"}
                  {taken && <Check size={16} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mb-2 mt-6 text-[12px] font-medium text-text-3">Últimos 7 dias</p>
        <div className="flex gap-1.5">
          {med.last7.map((d, i) => (
            <span key={i} className={cn(
              "grid h-9 flex-1 place-items-center rounded-md",
              d === "ok" && "bg-success/15 text-success",
              d === "miss" && "bg-error/15 text-error",
              d === "none" && "bg-surface-hi text-text-3",
            )}>
              {d === "ok" && <Check size={15} strokeWidth={3} />}
              {d === "miss" && <X size={15} strokeWidth={3} />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, warn, last }: { label: string; value: string; warn?: boolean; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-3.5", !last && "border-b border-border")}>
      <span className="text-[14px] text-text-2">{label}</span>
      <span className={cn("text-[14px] font-medium", warn ? "text-warning" : "text-text")}>{value}</span>
    </div>
  );
}

/* ---------- Novo / editar remédio ---------- */

export function NewMed({ editId }: { editId?: string } = {}) {
  const s = useStore();
  const { close } = useNav();
  const existing = editId ? s.meds.find((m) => m.id === editId) : undefined;

  const [name, setName] = useState(existing?.name ?? "");
  const [dose, setDose] = useState(existing?.dose ?? "");
  const [startHour, setStartHour] = useState(existing?.startHour ?? "08:00");
  const [freq, setFreq] = useState<"interval" | "daily" | "weekly" | "custom">(existing?.freq ?? "interval");
  const [everyXHours, setEveryXHours] = useState<number>(existing?.everyXHours ?? 8);
  const [durationHours, setDurationHours] = useState<number>(existing?.durationHours ?? 24);
  const [assignee, setAssignee] = useState(existing?.assignee ?? s.partner.id ?? s.me.id);
  const [notify, setNotify] = useState(existing?.notify ?? true);
  const [stockStr, setStockStr] = useState(existing?.stock != null ? String(existing.stock) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const previewTimes = computeTimes({ freq, startHour, everyXHours, durationHours });

  async function save() {
    if (!name.trim()) { setErr("Informe o nome do remédio."); return; }
    if (!assignee) { setErr("Selecione para quem é o remédio."); return; }
    if (freq === "interval" && (!everyXHours || everyXHours < 1)) { setErr("Intervalo precisa ser ≥ 1h."); return; }
    setErr(null); setSaving(true);
    const payload: MedInput = {
      name, dose, assignee,
      freq, everyXHours: freq === "interval" ? everyXHours : undefined,
      startHour, durationHours: freq === "interval" ? durationHours : undefined,
      notify, stock: stockStr ? Math.max(0, parseInt(stockStr, 10) || 0) : undefined,
    };
    try {
      if (editId) await s.updateMed(editId, payload);
      else await s.addMed(payload);
      close();
    } finally { setSaving(false); }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-bg anim-sheet">
      <StatusBar />
      <div className="flex items-center justify-between px-5 py-2">
        <h1 className="text-[22px] font-semibold">{editId ? "Editar remédio" : "Novo remédio"}</h1>
        <button onClick={close} className="text-[14px] text-text-2 hover:text-text">Cancelar</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mt-3">
          <Label>Nome</Label>
          <Input value={name} onChange={setName} placeholder="Ex.: Vitamina D" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <Label>Dose</Label>
            <Input value={dose} onChange={setDose} placeholder="1 cápsula" />
          </div>
          <div>
            <Label>Primeiro horário</Label>
            <input
              type="time"
              value={startHour}
              onChange={(e) => setStartHour(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-surface px-3 font-mono text-[15px] text-text outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>Frequência</Label>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["interval", "A cada Xh"],
              ["daily", "Diário"],
              ["weekly", "Semanal"],
            ] as const).map(([key, lbl]) => (
              <Choice key={key} active={freq === key} onClick={() => setFreq(key)}>{lbl}</Choice>
            ))}
          </div>
        </div>

        {freq === "interval" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label>A cada quantas horas?</Label>
              <input
                type="number" min={1} max={24} value={everyXHours}
                onChange={(e) => setEveryXHours(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 1)))}
                className="h-11 w-full rounded-md border border-border bg-surface px-3 font-mono text-[15px] text-text outline-none focus:border-accent"
              />
            </div>
            <div>
              <Label>Janela (horas)</Label>
              <input
                type="number" min={everyXHours} max={24} value={durationHours}
                onChange={(e) => setDurationHours(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 24)))}
                className="h-11 w-full rounded-md border border-border bg-surface px-3 font-mono text-[15px] text-text outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {/* Preview de horários calculados */}
        <div className="mt-3 rounded-md border border-border bg-surface px-4 py-3">
          <p className="text-[12px] font-medium text-text-3">Horários calculados</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {previewTimes.map((t) => (
              <span key={t} className="rounded-md border border-border bg-surface-hi px-2.5 py-1 font-mono text-[13px]">{t}</span>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Label>Para quem</Label>
          <div className="grid grid-cols-2 gap-2">
            {s.people.map((p) => (
              <Choice key={p.id} active={assignee === p.id} onClick={() => setAssignee(p.id)}>
                <Avatar name={p.name} color={p.color} size={20} /> {p.name}
              </Choice>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Label>Estoque (opcional)</Label>
          <Input value={stockStr} onChange={setStockStr} placeholder="Ex.: 30" />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3.5">
          <span className="text-[15px]">Lembrete por notificação</span>
          <Toggle checked={notify} onChange={setNotify} />
        </div>

        {err && <p className="mt-3 text-[13px] text-error">{err}</p>}
      </div>

      <div className="border-t border-border p-5">
        <Button full onClick={save} disabled={saving}>
          {saving ? "Salvando…" : (editId ? "Salvar alterações" : "Salvar remédio")}
        </Button>
      </div>
    </div>
  );
}

function Choice({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "flex h-11 items-center justify-center gap-2 rounded-md border text-[14px] font-medium transition-all",
      active ? "border-accent bg-accent/10 text-text" : "border-border bg-surface text-text-2",
    )}>
      {children}
    </button>
  );
}
