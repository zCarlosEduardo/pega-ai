"use client";
import { useState } from "react";
import { ChevronLeft, Heart, Trash2, Pencil } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/nav";
import { StatusBar } from "@/components/ui/Surface";
import { Input, Label } from "@/components/ui/PegaInput";
import { Button } from "@/components/ui/PegaButton";
import { PERSON_HEX, PersonColor, cn } from "@/lib/cn";
import { DateType } from "@/lib/types";
import { Recurrence } from "@/lib/dates";

const COLORS: PersonColor[] = ["p1", "p2", "p3", "p4"];
const TYPES: DateType[] = ["Viagem", "Aniversário", "Mensário", "Férias", "Outro"];
const RECURRENCES: Recurrence[] = ["Não repete", "Todo mês", "Todo ano"];
const REMINDERS = ["No dia", "1 dia antes", "3 dias antes", "7 dias antes"];

function defaultRecurrence(type: DateType): Recurrence {
  if (type === "Aniversário") return "Todo ano";
  if (type === "Mensário") return "Todo mês";
  return "Não repete";
}

/* ---------- Detalhe da data ---------- */
export function DateDetail({ id }: { id: string }) {
  const s = useStore();
  const { close, open } = useNav();
  const d = s.dates.find((x) => x.id === id);
  if (!d) return null;
  const hex = PERSON_HEX[d.color];

  async function remove() {
    await s.deleteDate(d!.id);
    close();
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg anim-screen">
      <StatusBar />
      <div className="flex items-center justify-between px-4 py-2">
        <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-surface" aria-label="Voltar">
          <ChevronLeft size={22} />
        </button>
        <button onClick={() => open({ kind: "new-date", id: d.id })} className="flex items-center gap-1 px-2 text-[14px] font-medium text-accent">
          <Pencil size={15} /> Editar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="rounded-lg border px-5 py-7 text-center" style={{ background: `${hex}14`, borderColor: `${hex}33` }}>
          <p className="text-[13px] font-medium text-text-2">{d.daysAway === 0 ? "É hoje" : d.daysAway > 0 ? "Faltam" : "Foi há"}</p>
          <p className="my-1 font-mono text-[64px] font-semibold leading-none" style={{ color: hex }}>
            {String(Math.abs(d.daysAway)).padStart(2, "0")}
          </p>
          <p className="text-[13px] font-medium text-text-2">Dias</p>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: hex }} />
          <h1 className="text-[22px] font-semibold">{d.title}</h1>
        </div>
        <p className="mt-1 text-[13px] text-text-2">{d.dateLabel}</p>

        <div className="mt-5 overflow-hidden rounded-md border border-border bg-surface">
          <DRow label="Tipo" value={d.type} />
          <DRow label="Repete" value={d.recurrence} />
          <DRow label="Lembrete" value={d.reminder} last />
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-hi text-p4"><Heart size={16} /></span>
          <p className="text-[13px] text-text-2">Vocês começaram essa história em {s.space.createdYear}.</p>
        </div>

        <button onClick={remove} className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-error/30 py-3 text-[14px] font-medium text-error">
          <Trash2 size={16} /> Excluir data
        </button>
      </div>
    </div>
  );
}

function DRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-3.5", !last && "border-b border-border")}>
      <span className="text-[14px] text-text-2">{label}</span>
      <span className="text-[14px] font-medium">{value}</span>
    </div>
  );
}

/* ---------- Nova data / Editar data ---------- */
export function NewDate({ id }: { id?: string }) {
  const s = useStore();
  const { close } = useNav();
  const existing = id ? s.dates.find((x) => x.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [start, setStart] = useState(existing?.startISO ?? "");
  const [end, setEnd] = useState(existing?.endISO ?? "");
  const [type, setType] = useState<DateType>(existing?.type ?? "Viagem");
  const [recurrence, setRecurrence] = useState<Recurrence>((existing?.recurrence as Recurrence) ?? "Não repete");
  const [reminder, setReminder] = useState(existing?.reminder ?? "3 dias antes");
  const [color, setColor] = useState<PersonColor>(existing?.color ?? "p1");
  const [touchedRec, setTouchedRec] = useState(false);
  const [busy, setBusy] = useState(false);

  function pickType(t: DateType) {
    setType(t);
    if (!touchedRec) setRecurrence(defaultRecurrence(t));
  }

  async function save() {
    if (!title.trim() || !start || busy) return;
    setBusy(true);
    const payload = {
      title: title.trim(),
      startISO: start,
      endISO: end || undefined,
      type,
      color,
      recurrence,
      reminder,
    };
    if (id) await s.updateDate(id, payload);
    else await s.addDate(payload);
    setBusy(false);
    close();
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-bg anim-sheet">
      <StatusBar />
      <div className="flex items-center justify-between px-5 py-2">
        <h1 className="text-[22px] font-semibold">{id ? "Editar data" : "Nova data"}</h1>
        <button onClick={close} className="text-[14px] text-text-2 hover:text-text">Cancelar</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mt-3">
          <Label>Título</Label>
          <Input value={title} onChange={setTitle} placeholder="Ex.: Aniversário de namoro" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <Label>Início</Label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
              className="h-12 w-full rounded-md border border-border bg-surface px-4 font-mono text-[14px] text-text outline-none focus:border-accent [color-scheme:dark]" />
          </div>
          <div>
            <Label>Fim <span className="normal-case text-text-3">(opcional)</span></Label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
              className="h-12 w-full rounded-md border border-border bg-surface px-4 font-mono text-[14px] text-text outline-none focus:border-accent [color-scheme:dark]" />
          </div>
        </div>

        <div className="mt-4">
          <Label>Tipo</Label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Chip key={t} active={type === t} onClick={() => pickType(t)}>{t}</Chip>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Label>Repetição</Label>
          <div className="grid grid-cols-3 gap-2">
            {RECURRENCES.map((r) => (
              <Chip key={r} active={recurrence === r} onClick={() => { setRecurrence(r); setTouchedRec(true); }} center>{r}</Chip>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Label>Lembrete</Label>
          <div className="flex flex-wrap gap-2">
            {REMINDERS.map((r) => (
              <Chip key={r} active={reminder === r} onClick={() => setReminder(r)}>{r}</Chip>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Label>Cor</Label>
          <div className="flex gap-3">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className="h-9 w-9 rounded-md transition-transform"
                style={{ background: PERSON_HEX[c], boxShadow: color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${PERSON_HEX[c]}` : undefined }} />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border p-5">
        <Button full onClick={save} disabled={busy || !title.trim() || !start}>{busy ? "Salvando…" : id ? "Salvar" : "Criar data"}</Button>
      </div>
    </div>
  );
}

function Chip({ children, active, onClick, center }: { children: React.ReactNode; active: boolean; onClick: () => void; center?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-[13px] font-medium transition-all",
        center && "flex items-center justify-center px-2 text-center",
        active ? "border-accent bg-accent/10 text-text" : "border-border bg-surface text-text-2",
      )}
    >
      {children}
    </button>
  );
}
