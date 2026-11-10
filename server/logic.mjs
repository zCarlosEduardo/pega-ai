// Pega Aí — lógica pura do enviador de push (sem Firebase/rede), para poder ser testada.
// Datas são tratadas em UTC puro (Date.UTC) para não depender do fuso do servidor.

export const REMINDER_DAYS = { "No dia": 0, "1 dia antes": 1, "3 dias antes": 3, "7 dias antes": 7 };

/** "agora" no fuso configurado: { y, m, d, hh, mm, dayKey, minutes } */
export function nowInTz(tz, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const g = (t) => parts.find((p) => p.type === t).value;
  // algumas versões do ICU devolvem "24" à meia-noite
  const hh = +g("hour") % 24, mm = +g("minute");
  return {
    y: +g("year"), m: +g("month"), d: +g("day"), hh, mm,
    dayKey: `${g("year")}-${g("month")}-${g("day")}`, minutes: hh * 60 + mm,
  };
}

const daysInMonth = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Dias até a próxima ocorrência (0 = hoje). Negativo = já passou (só "Não repete"). */
export function daysAwayTo(startISO, recurrence, today) {
  const [y0, mo, d] = startISO.split("-").map(Number);
  const t = Date.UTC(today.y, today.m - 1, today.d);
  const diff = (ms) => Math.round((ms - t) / 86400000);
  if (recurrence === "Todo ano") {
    let occ = Date.UTC(today.y, mo - 1, Math.min(d, daysInMonth(today.y, mo - 1)));
    if (occ < t) occ = Date.UTC(today.y + 1, mo - 1, Math.min(d, daysInMonth(today.y + 1, mo - 1)));
    return diff(occ);
  }
  if (recurrence === "Todo mês") {
    let occ = Date.UTC(today.y, today.m - 1, Math.min(d, daysInMonth(today.y, today.m - 1)));
    if (occ < t) {
      const ny = today.m === 12 ? today.y + 1 : today.y;
      const nm0 = today.m % 12; // mês seguinte (0-based)
      occ = Date.UTC(ny, nm0, Math.min(d, daysInMonth(ny, nm0)));
    }
    return diff(occ);
  }
  return diff(Date.UTC(y0, mo - 1, d)); // não repete
}

/** Chave de dedupe da ocorrência: "YYYY-MM-DD:diasAntes" */
export function dateOccKey(today, away, target) {
  const occ = new Date(Date.UTC(today.y, today.m - 1, today.d + away)).toISOString().slice(0, 10);
  return `${occ}:${target}`;
}

/**
 * Horários de remédio que devem ser avisados agora.
 * Janela: do horário até `windowMin` minutos depois (o cron roda a cada 10–15 min).
 * Ignora o que já foi avisado (notifiedSlots) e o que já foi marcado como tomado (taken).
 */
export function dueMedSlots({ times, minutes, dayKey, notifiedSlots = [], taken = {}, windowMin = 45 }) {
  const out = [];
  for (const t of times) {
    const [h, mn] = String(t).split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(mn)) continue;
    const start = h * 60 + mn;
    if (minutes < start || minutes >= start + windowMin) continue;
    const slot = `${dayKey}:${t}`;
    if (notifiedSlots.includes(slot)) continue;
    if (taken && taken[`${dayKey}_${t}`]) continue; // já tomou: não incomoda
    out.push({ t, slot });
  }
  return out;
}

/**
 * Agrupa atividades pendentes em UMA notificação por autor (evita 1 push por item numa lista grande).
 * acts: [{ id, actorUid, actorName, text, type, whenMs }]
 * Retorna { messages: [{ actorUid, body, ids }], staleIds } — staleIds são antigas demais: só marcar como vistas.
 */
export function groupActivity(acts, nowMs, staleMs = 6 * 3600e3) {
  const byActor = new Map();
  const staleIds = [];
  for (const a of acts.slice().sort((x, y) => x.whenMs - y.whenMs)) {
    if (a.whenMs && nowMs - a.whenMs > staleMs) { staleIds.push(a.id); continue; }
    if (!byActor.has(a.actorUid)) byActor.set(a.actorUid, []);
    byActor.get(a.actorUid).push(a);
  }
  const messages = [];
  for (const [actorUid, list] of byActor) {
    const name = list[list.length - 1].actorName || "Seu par";
    let body;
    if (list.length === 1) body = `${name} ${list[0].text}`;
    else if (list.every((a) => a.type === "item_add")) body = `${name} adicionou ${list.length} itens`;
    else if (list.every((a) => a.type === "item_done")) body = `${name} concluiu ${list.length} itens`;
    else body = `${name} fez ${list.length} atualizações. Última: ${list[list.length - 1].text}`;
    messages.push({ actorUid, body, ids: list.map((a) => a.id) });
  }
  return { messages, staleIds };
}

/** Texto do resumo diário; null quando não há nada para o dia. */
export function dailySummaryBody({ meds = 0, dateTitles = [], pending = 0 }) {
  const parts = [];
  if (meds > 0) parts.push(`${meds} ${meds === 1 ? "horário de remédio" : "horários de remédio"}`);
  if (dateTitles.length === 1) parts.push(`hoje: ${dateTitles[0]}`);
  else if (dateTitles.length > 1) parts.push(`${dateTitles.length} datas hoje`);
  if (pending > 0) parts.push(`${pending} ${pending === 1 ? "item a fazer" : "itens a fazer"}`);
  return parts.length ? parts.join(" · ") : null;
}
