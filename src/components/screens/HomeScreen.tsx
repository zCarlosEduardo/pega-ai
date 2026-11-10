"use client";
import { Check, ChevronRight, Gift, Plane, CalendarDays, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/nav";
import { Avatar } from "@/components/ui/Inputs";
import { Card } from "@/components/ui/Surface";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { PERSON_HEX } from "@/lib/cn";
import { ImportantDate } from "@/lib/types";

const WD = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MM = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function dateIcon(type: ImportantDate["type"]) {
  if (type === "Viagem" || type === "Férias") return <Plane size={18} />;
  if (type === "Aniversário" || type === "Mensário") return <Gift size={18} />;
  return <CalendarDays size={18} />;
}

export function HomeScreen() {
  const s = useStore();
  const { setTab, open } = useNav();
  const now = new Date();
  const hr = now.getHours();
  const greet = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";
  const dateStr = `${WD[now.getDay()]}, ${now.getDate()} ${MM[now.getMonth()]}`;
  const nextDate = s.dates[0];
  const proximas = s.dates.slice(0, 3);

  return (
    <div className="anim-screen px-5 pb-8">
      {/* header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <p className="text-[12px] font-medium text-text-3">{dateStr}</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight">{greet}, {s.me.name}</h1>
        </div>
        <button onClick={() => open({ kind: "settings" })} className="flex -space-x-2 pt-1">
          {s.people.map((p) => (
            <span key={p.id} className="ring-2 ring-bg rounded-full">
              <Avatar name={p.name} color={p.color} size={30} />
            </span>
          ))}
        </button>
      </div>

      {/* progresso da semana */}
      <Card elevated className="mt-5 flex items-center gap-4">
        <ProgressRing value={s.week.pct} size={72} stroke={6}>
          <div className="text-center leading-none">
            <span className="font-mono text-[20px] font-semibold">{s.week.pct}</span>
            <span className="block font-mono text-[10px] text-text-3">%</span>
          </div>
        </ProgressRing>
        <div className="flex-1">
          <p className="text-[15px] font-semibold">Progresso das listas</p>
          <p className="mt-0.5 text-[13px] text-text-2">
            {s.week.total > 0 ? (
              <>Vocês concluíram <span className="text-text font-medium">{s.week.done} de {s.week.total}</span> tarefas juntos.{s.stats.sequencia > 1 ? ` Sequência de ${s.stats.sequencia} dias.` : ""}</>
            ) : (
              <>Criem uma lista compartilhada pra começar a contar.</>
            )}
          </p>
          {s.week.total > 0 && (
            <div className="mt-2 flex gap-4">
              {s.week.perPerson.map((p) => (
                <span key={p.name} className="flex items-center gap-1.5 text-[12px] text-text-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: PERSON_HEX[p.color] }} />
                  {p.name} {p.n}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* stats */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card className="py-4">
          <p className="text-[12px] font-medium text-text-3">A fazer</p>
          <p className="mt-1"><span className="font-mono text-[28px] font-semibold">{s.stats.pendentes}</span><span className="ml-1 text-[13px] text-text-2">itens</span></p>
        </Card>
        <Card className="py-4" onClick={() => setTab("agenda")}>
          <p className="text-[12px] font-medium text-text-3">Próxima data</p>
          <p className="mt-1">
            <span className="font-mono text-[28px] font-semibold">{nextDate ? nextDate.daysAway : "—"}</span>
            <span className="ml-1 text-[13px] text-text-2">{nextDate ? "dias" : ""}</span>
          </p>
        </Card>
      </div>

      {/* próximos */}
      <SectionHeader title="Próximos" action="agenda" onAction={() => setTab("agenda")} />
      {proximas.length > 0 ? (
        <div className="space-y-2">
          {proximas.map((d) => (
            <Card key={d.id} className="flex items-center gap-3 py-3.5" onClick={() => open({ kind: "date", id: d.id })}>
              <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-hi" style={{ color: PERSON_HEX[d.color] }}>
                {dateIcon(d.type)}
              </span>
              <div className="flex-1">
                <p className="text-[14px] font-medium">{d.title}</p>
                <p className="text-[12px] text-text-3">{d.dateLabel}</p>
              </div>
              <span className="font-mono text-[13px] text-text-2">{d.daysAway === 0 ? "hoje" : `${d.daysAway}d`}</span>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex items-center gap-3 py-3.5" onClick={() => open({ kind: "new-date" })}>
          <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-hi text-accent"><Plus size={18} /></span>
          <div className="flex-1">
            <p className="text-[14px] font-medium">Adicionar uma data</p>
            <p className="text-[12px] text-text-3">Aniversários, viagens, mensário…</p>
          </div>
          <ChevronRight size={16} className="text-text-3" />
        </Card>
      )}

      {/* atividade recente */}
      {s.activity.length > 0 && (
        <>
          <SectionHeader title="Atividade recente" />
          <div className="space-y-3">
            {s.activity.map((a) => {
              const who = s.personById(a.who);
              return (
                <div key={a.id} className="flex items-center gap-3">
                  {a.done ? (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-success/15 text-success">
                      <Check size={15} strokeWidth={3} />
                    </span>
                  ) : (
                    <Avatar name={who?.name ?? "?"} color={who?.color} size={28} />
                  )}
                  <p className="flex-1 text-[13px] text-text-2">
                    {who && <span className="font-medium text-text">{who.name.split(" ")[0]} </span>}
                    {a.text}
                  </p>
                  <span className="text-[12px] text-text-3">{relTime(a.when)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** "agora", "há 5 min", "há 3 h", "ontem" ou "12 nov" a partir de um ISO */
function relTime(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  const dt = new Date(t);
  return `${dt.getDate()} ${MM[dt.getMonth()]}`;
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {action && (
        <button onClick={onAction} className="flex items-center gap-0.5 text-[12px] text-text-3 hover:text-text-2">
          {action} <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}
