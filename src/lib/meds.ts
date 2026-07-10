import { Med, MedFreq } from "@/lib/types";

export function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function intakeKey(dateKey: string, hhmm: string) { return `${dateKey}_${hhmm}`; }

/** "08:00" -> minutos desde 0h */
export function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}
export function minToHm(min: number): string {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/**
 * Calcula os horários do dia para um remédio.
 * - freq="interval": parte de startHour e adiciona everyXHours até cobrir durationHours.
 *   ex.: start=08:00, every=8h, duration=24h -> ["08:00","16:00","00:00"]
 * - outros: usa apenas startHour.
 */
export function computeTimes(input: {
  freq: MedFreq; startHour: string; everyXHours?: number; durationHours?: number;
}): string[] {
  const start = input.startHour || "08:00";
  if (input.freq !== "interval") return [start];
  const every = Math.max(1, Math.min(24, Number(input.everyXHours) || 8));
  const duration = Math.max(every, Math.min(24, Number(input.durationHours) || 24));
  const count = Math.max(1, Math.floor(duration / every));
  const startMin = hmToMin(start);
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(minToHm(startMin + i * every * 60));
  return out;
}

export function freqLabel(m: { freq: MedFreq; everyXHours?: number }): string {
  if (m.freq === "interval") return `A cada ${m.everyXHours ?? 8}h`;
  if (m.freq === "weekly") return "Semanal";
  if (m.freq === "custom") return "Custom";
  return "Todos os dias";
}

/** Próximo horário do dia atual (ou primeiro do próximo dia se já passaram todos). */
export function nextSlot(times: string[], now = new Date()): { hhmm: string; minutesAway: number } {
  if (!times.length) return { hhmm: "00:00", minutesAway: 0 };
  const curMin = now.getHours() * 60 + now.getMinutes();
  const sorted = [...times].sort((a, b) => hmToMin(a) - hmToMin(b));
  for (const t of sorted) {
    const tm = hmToMin(t);
    if (tm >= curMin - 15) return { hhmm: t, minutesAway: tm - curMin };
  }
  // todos já passaram → primeiro do dia seguinte
  return { hhmm: sorted[0], minutesAway: 24 * 60 - curMin + hmToMin(sorted[0]) };
}

export function inLabelFromMinutes(min: number): string | undefined {
  if (min <= -15) return undefined;
  if (min < -5) return "agora";
  if (min < 60) return `em ${Math.max(1, Math.round(min))}min`;
  const h = Math.round(min / 60);
  return `em ${h}h`;
}

/**
 * Deriva campos visuais do remédio para o dia de hoje.
 */
export function deriveMed(base: {
  id: string; name: string; dose: string; assignee: string; freq: MedFreq;
  everyXHours?: number; startHour: string; durationHours?: number;
  times: string[]; notify: boolean; stock?: number;
  taken: Record<string, string>; createdAtISO?: string;
}, now = new Date()): Med {
  const tKey = todayKey(now);
  const slots = base.times.length ? base.times : computeTimes(base);
  const taken7: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = todayKey(d);
    taken7[key] = slots.filter((s) => base.taken?.[intakeKey(key, s)]).length;
  }

  const todayTaken = slots.filter((s) => base.taken?.[intakeKey(tKey, s)]).length;
  const next = nextSlot(slots, now);
  const slotTakenToday = !!base.taken?.[intakeKey(tKey, next.hhmm)];

  let status: Med["status"] = "pendente";
  if (slotTakenToday) status = "tomado";
  else if (next.minutesAway > -15 && next.minutesAway < 60) status = "agora";

  // adesão dos últimos 7 dias
  const expected = slots.length * 7;
  const taken = Object.values(taken7).reduce((a, b) => a + b, 0);
  const adherence = expected ? Math.round((taken / expected) * 100) : 0;

  const last7: ("ok" | "miss" | "none")[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = todayKey(d);
    const n = taken7[k] ?? 0;
    if (i === 0 && todayTaken === 0) last7.push("none");
    else if (n >= slots.length) last7.push("ok");
    else if (n === 0) last7.push("miss");
    else last7.push("ok");
  }

  const start = base.createdAtISO ? new Date(base.createdAtISO) : null;
  const startLabel = start
    ? start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return {
    ...base,
    times: slots,
    time: next.hhmm,
    inLabel: inLabelFromMinutes(next.minutesAway),
    status,
    adherence,
    last7,
    freqLabel: freqLabel(base),
    startLabel,
    stock: base.stock,
  };
}
