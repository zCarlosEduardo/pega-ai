// Helpers de data + recorrência (produção, sem libs externas).

export type Recurrence = "Não repete" | "Todo mês" | "Todo ano";

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MONTHS_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

export function toISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function atMidnight(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Quantos dias o evento dura (inclusivo). Sem fim => 1 dia.
export function rangeLen(startISO: string, endISO?: string) {
  if (!endISO) return 1;
  const a = parseISO(startISO);
  const b = parseISO(endISO);
  const da = new Date(a.y, a.m, a.d);
  const db = new Date(b.y, b.m, b.d);
  return Math.max(1, diffDays(da, db) + 1);
}

export function formatDayMonth(iso: string) {
  const { m, d } = parseISO(iso);
  return `${d} de ${MONTHS_PT[m]}`;
}

export function formatShort(iso: string) {
  const { m, d } = parseISO(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS_ABBR[m]}`;
}

// Próxima ocorrência (>= hoje) considerando recorrência.
export function nextOccurrence(startISO: string, recurrence: Recurrence): { iso: string; daysAway: number } {
  const today = atMidnight();
  const { y, m, d } = parseISO(startISO);

  if (recurrence === "Não repete") {
    const occ = new Date(y, m, d);
    return { iso: startISO, daysAway: diffDays(today, occ) };
  }

  if (recurrence === "Todo ano") {
    let occ = new Date(today.getFullYear(), m, d);
    if (occ < today) occ = new Date(today.getFullYear() + 1, m, d);
    return { iso: toISO(occ), daysAway: diffDays(today, occ) };
  }

  // Todo mês — mesmo dia do mês (clampado ao tamanho do mês)
  const dimNow = daysInMonth(today.getFullYear(), today.getMonth());
  let occ = new Date(today.getFullYear(), today.getMonth(), Math.min(d, dimNow));
  if (occ < today) {
    const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const dimNext = daysInMonth(nm.getFullYear(), nm.getMonth());
    occ = new Date(nm.getFullYear(), nm.getMonth(), Math.min(d, dimNext));
  }
  return { iso: toISO(occ), daysAway: diffDays(today, occ) };
}

// Datas de início de ocorrências que podem cair no mês visível (inclui vizinhas
// pra cobrir eventos multi-dia que cruzam a virada de mês).
function occurrenceStartsNear(startISO: string, recurrence: Recurrence, year: number, month: number): Date[] {
  const { y, m, d } = parseISO(startISO);

  if (recurrence === "Todo ano") {
    return [-1, 0, 1].map((o) => new Date(year + o, m, d));
  }
  if (recurrence === "Todo mês") {
    return [-1, 0, 1].map((o) => {
      const base = new Date(year, month + o, 1);
      const dim = daysInMonth(base.getFullYear(), base.getMonth());
      return new Date(base.getFullYear(), base.getMonth(), Math.min(d, dim));
    });
  }
  return [new Date(y, m, d)];
}

// Conjunto de dias do mês visível que devem ser destacados (multi-dia incluso).
export function occurrenceDaysInMonth(
  startISO: string,
  endISO: string | undefined,
  recurrence: Recurrence,
  year: number,
  month: number,
): number[] {
  const len = rangeLen(startISO, endISO);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const days = new Set<number>();

  for (const start of occurrenceStartsNear(startISO, recurrence, year, month)) {
    for (let i = 0; i < len; i++) {
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      if (cur >= monthStart && cur <= monthEnd) days.add(cur.getDate());
    }
  }
  return Array.from(days);
}

// Rótulo amigável da próxima ocorrência (com intervalo se multi-dia).
export function occurrenceLabel(startISO: string, endISO: string | undefined, recurrence: Recurrence): string {
  const next = nextOccurrence(startISO, recurrence);
  if (!endISO) return formatDayMonth(next.iso);
  const len = rangeLen(startISO, endISO);
  const ns = parseISO(next.iso);
  const endDate = new Date(ns.y, ns.m, ns.d + len - 1);
  return `${formatDayMonth(next.iso)} a ${formatDayMonth(toISO(endDate))}`;
}

export { MONTHS_PT, MONTHS_ABBR };
