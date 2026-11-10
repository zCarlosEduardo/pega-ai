"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/nav";
import { Fab } from "@/components/PhoneFrame";
import { PERSON_HEX, cn } from "@/lib/cn";
import { occurrenceDaysInMonth, rangeLen, Recurrence } from "@/lib/dates";

const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { day: number; inMonth: boolean }[] = [];
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = 0; i < start; i++) cells.push({ day: prevDays - start + 1 + i, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - start + 1, inMonth: false });
  return cells;
}

function daysLabel(n: number) {
  if (n === 0) return "hoje";
  if (n < 0) return "passou";
  return `${n}d`;
}

export function AgendaScreen() {
  const s = useStore();
  const { open } = useNav();
  const now = new Date();
  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const [cursor, setCursor] = useState({ y: today.y, m: today.m });
  const cells = monthGrid(cursor.y, cursor.m);

  // ocorrências (recorrência + multi-dia) no mês visível
  const dayColors: Record<number, string[]> = {};
  const spanColor: Record<number, string> = {};
  for (const d of s.dates) {
    if (!d.startISO) continue;
    const rec = (d.recurrence ?? "Não repete") as Recurrence;
    const days = occurrenceDaysInMonth(d.startISO, d.endISO, rec, cursor.y, cursor.m);
    const multi = !!d.endISO && rangeLen(d.startISO, d.endISO) > 1;
    for (const day of days) {
      (dayColors[day] ??= []).push(PERSON_HEX[d.color]);
      if (multi) spanColor[day] = PERSON_HEX[d.color];
    }
  }

  // card de destaque: mensário mais próximo, senão a próxima data
  const upcoming = s.dates.filter((d) => d.daysAway >= 0);
  const featured = upcoming.find((d) => d.recurrence === "Todo mês") ?? upcoming[0];

  return (
    <div className="anim-screen px-5 pb-28">
      <h1 className="pt-2 text-[28px] font-semibold">Agenda</h1>

      {featured ? (
        <div
          className="mt-5 flex items-center gap-4 rounded-lg border bg-surface p-5"
          style={{ borderColor: `${PERSON_HEX[featured.color]}33` }}
          onClick={() => open({ kind: "date", id: featured.id })}
        >
          <div className="text-center">
            <span className="font-mono text-[40px] font-semibold leading-none" style={{ color: PERSON_HEX[featured.color] }}>
              {String(featured.daysAway).padStart(2, "0")}
            </span>
            <span className="mt-1 block text-[11px] font-medium text-text-3">Dias</span>
          </div>
          <div>
            <p className="text-[15px] font-semibold">{featured.title}</p>
            <p className="mt-0.5 text-[13px] text-text-2">
              {featured.dateLabel}
              {featured.recurrence !== "Não repete" ? ` · ${featured.recurrence.toLowerCase()}` : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface p-5" onClick={() => open({ kind: "new-date" })}>
          <span className="grid h-10 w-10 place-items-center rounded-md bg-surface-hi text-accent"><CalendarDays size={18} /></span>
          <div>
            <p className="text-[15px] font-semibold">Nenhuma data ainda</p>
            <p className="mt-0.5 text-[13px] text-text-2">Toque pra adicionar a primeira.</p>
          </div>
        </div>
      )}

      {/* calendário */}
      <div className="mt-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-[15px] font-semibold">{MONTHS[cursor.m]} {cursor.y}</p>
          <div className="flex gap-1">
            <CalNav onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}><ChevronLeft size={16} /></CalNav>
            <CalNav onClick={() => setCursor({ y: today.y, m: today.m })}><span className="px-1 text-[11px] font-medium">hoje</span></CalNav>
            <CalNav onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}><ChevronRight size={16} /></CalNav>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-y-1.5">
          {WD.map((w, i) => (
            <span key={i} className="text-center font-mono text-[11px] text-text-3">{w}</span>
          ))}
          {cells.map((c, i) => {
            const isToday = c.inMonth && c.day === today.d && cursor.y === today.y && cursor.m === today.m;
            const colors = c.inMonth ? dayColors[c.day] ?? [] : [];
            const span = c.inMonth ? spanColor[c.day] : undefined;
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full font-mono text-[13px]",
                    isToday && "bg-text text-bg font-semibold",
                    !isToday && c.inMonth && "text-text",
                    !c.inMonth && "text-text-3/50",
                  )}
                  style={!isToday && span ? { background: `${span}22` } : undefined}
                >
                  {c.day}
                </span>
                <span className="flex h-1 items-center gap-0.5">
                  {colors.slice(0, 3).map((col, k) => (
                    <span key={k} className="h-1 w-1 rounded-full" style={{ background: col }} />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* próximas datas */}
      <div className="mt-4 space-y-3">
        {s.dates.map((d) => (
          <div
            key={d.id}
            onClick={() => open({ kind: "date", id: d.id })}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-4 py-4 transition-colors hover:border-[#2a2c38]"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PERSON_HEX[d.color] }} />
            <div className="flex-1">
              <p className="text-[15px] font-semibold">{d.title}</p>
              <p className="text-[12px] text-text-3">
                {d.dateLabel}
                {d.recurrence !== "Não repete" ? ` · ${d.recurrence.toLowerCase()}` : ""}
              </p>
            </div>
            <span className="font-mono text-[13px] text-text-2">{daysLabel(d.daysAway)}</span>
          </div>
        ))}
      </div>

      <Fab label="Nova data" onClick={() => open({ kind: "new-date" })} />
    </div>
  );
}

function CalNav({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="grid h-7 min-w-7 place-items-center rounded-md px-1 text-text-2 hover:bg-surface-hi">
      {children}
    </button>
  );
}
