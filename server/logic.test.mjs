// Rode com:  node --test server/logic.test.mjs   (Node 18+, sem dependências)
import test from "node:test";
import assert from "node:assert/strict";
import {
  REMINDER_DAYS, nowInTz, daysAwayTo, dateOccKey, dueMedSlots, groupActivity, dailySummaryBody,
} from "./logic.mjs";

const day = (y, m, d) => ({ y, m, d });

test("nowInTz respeita o fuso e nunca devolve hora 24", () => {
  // 2026-11-10 02:30 UTC = 2026-11-09 23:30 em São Paulo (UTC-3)
  const t = nowInTz("America/Sao_Paulo", new Date("2026-11-10T02:30:00Z"));
  assert.equal(t.dayKey, "2026-11-09");
  assert.equal(t.hh, 23);
  assert.equal(t.minutes, 23 * 60 + 30);
  const mid = nowInTz("America/Sao_Paulo", new Date("2026-11-10T03:05:00Z"));
  assert.equal(mid.hh, 0);
  assert.equal(mid.dayKey, "2026-11-10");
});

test("daysAwayTo: não repete", () => {
  assert.equal(daysAwayTo("2026-11-13", "Não repete", day(2026, 11, 10)), 3);
  assert.equal(daysAwayTo("2026-11-10", "Não repete", day(2026, 11, 10)), 0);
  assert.equal(daysAwayTo("2026-11-08", "Não repete", day(2026, 11, 10)), -2);
});

test("daysAwayTo: todo ano (incl. virada de ano e 29/02)", () => {
  assert.equal(daysAwayTo("1990-11-17", "Todo ano", day(2026, 11, 10)), 7);
  assert.equal(daysAwayTo("1990-11-09", "Todo ano", day(2026, 11, 10)), 364); // já passou: ano que vem
  assert.equal(daysAwayTo("2000-02-29", "Todo ano", day(2027, 2, 27)), 1);   // 2027 não é bissexto: 28/02
});

test("daysAwayTo: todo mês (incl. dia 31 e dezembro)", () => {
  assert.equal(daysAwayTo("2026-01-15", "Todo mês", day(2026, 11, 10)), 5);
  assert.equal(daysAwayTo("2026-01-05", "Todo mês", day(2026, 11, 10)), 25); // próximo mês: 05/12
  assert.equal(daysAwayTo("2026-01-05", "Todo mês", day(2026, 12, 10)), 26); // dez -> jan
  assert.equal(daysAwayTo("2026-01-31", "Todo mês", day(2026, 2, 27)), 1);   // fev tem 28: dia 28
});

test("lembrete: valores do app mapeiam para dias", () => {
  assert.deepEqual(REMINDER_DAYS, { "No dia": 0, "1 dia antes": 1, "3 dias antes": 3, "7 dias antes": 7 });
  assert.equal(dateOccKey(day(2026, 11, 10), 3, 3), "2026-11-13:3");
  assert.equal(dateOccKey(day(2026, 12, 30), 3, 3), "2027-01-02:3");
});

test("dueMedSlots: janela, dedupe e dose já tomada", () => {
  const base = { times: ["08:00", "20:00"], dayKey: "2026-11-10" };
  assert.deepEqual(dueMedSlots({ ...base, minutes: 7 * 60 + 59 }), []);
  assert.deepEqual(dueMedSlots({ ...base, minutes: 8 * 60 }).map((x) => x.t), ["08:00"]);
  assert.deepEqual(dueMedSlots({ ...base, minutes: 8 * 60 + 44 }).map((x) => x.t), ["08:00"]);
  assert.deepEqual(dueMedSlots({ ...base, minutes: 8 * 60 + 45 }), []); // fora da janela
  assert.deepEqual(dueMedSlots({ ...base, minutes: 8 * 60 + 10, notifiedSlots: ["2026-11-10:08:00"] }), []);
  assert.deepEqual(dueMedSlots({ ...base, minutes: 8 * 60 + 10, taken: { "2026-11-10_08:00": "2026-11-10T11:05:00Z" } }), []);
  // tomado ontem não bloqueia hoje
  assert.equal(dueMedSlots({ ...base, minutes: 8 * 60 + 10, taken: { "2026-11-09_08:00": "x" } }).length, 1);
  // horário inválido é ignorado
  assert.deepEqual(dueMedSlots({ times: ["abc"], minutes: 0, dayKey: "2026-11-10" }), []);
});

test("groupActivity: 1 push por autor, resumo para lista grande, descarta antigas", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const mk = (i, who, type, ageMin) => ({
    id: `a${i}`, actorUid: who, actorName: who === "u1" ? "Ana" : "Beto",
    text: `fez ${i}`, type, whenMs: now - ageMin * 60000,
  });
  const many = Array.from({ length: 40 }, (_, i) => mk(i, "u1", "item_add", 40 - i));
  const { messages, staleIds } = groupActivity([...many, mk(100, "u2", "item_done", 5), mk(200, "u1", "item_add", 60 * 7)], now);
  assert.equal(messages.length, 2);
  const ana = messages.find((m) => m.actorUid === "u1");
  assert.equal(ana.body, "Ana adicionou 40 itens");
  assert.equal(ana.ids.length, 40);
  assert.equal(messages.find((m) => m.actorUid === "u2").body, "Beto fez 100");
  assert.deepEqual(staleIds, ["a200"]); // 7h atrás: só marca como vista
  const mixed = groupActivity([mk(1, "u1", "item_add", 3), mk(2, "u1", "item_done", 2)], now);
  assert.match(mixed.messages[0].body, /^Ana fez 2 atualizações\. Última: fez 2$/);
});

test("dailySummaryBody", () => {
  assert.equal(dailySummaryBody({}), null);
  assert.equal(dailySummaryBody({ meds: 2, dateTitles: ["Aniversário da Ana"], pending: 1 }),
    "2 horários de remédio · hoje: Aniversário da Ana · 1 item a fazer");
  assert.equal(dailySummaryBody({ dateTitles: ["a", "b"], pending: 5 }), "2 datas hoje · 5 itens a fazer");
});
