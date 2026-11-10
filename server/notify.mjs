// Pega Aí — enviador de Web Push. O cron-job.org chama GET /notify?key=CRON_SECRET.
// Lê o Firestore (admin), calcula o que está vencido e dispara push via VAPID.
//
//   GET /notify?key=SEGREDO            roda os lembretes (datas, remédios, atividade, resumo diário)
//   GET /notify?key=SEGREDO&test=1     manda um "teste" para todos os aparelhos inscritos
//   GET /health                        responde 200 (para o host saber que está de pé)
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import admin from "firebase-admin";
import * as webpushNs from "web-push";
// web-push 3.x (CJS) expõe tudo em `default`; 4.x (ESM) em exports nomeados. Aceita as duas.
const webpush = webpushNs.default ?? webpushNs;
import {
  REMINDER_DAYS, nowInTz, daysAwayTo, dateOccKey, dueMedSlots, groupActivity, dailySummaryBody,
} from "./logic.mjs";

const {
  PORT = 8787, CRON_SECRET, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT = "mailto:admin@pega.ai",
  FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, TZ_NAME = "America/Sao_Paulo",
  DATE_HOUR = "9",   // lembretes de data só a partir desta hora (evita aviso à meia-noite)
  DAILY_HOUR = "8",  // resumo diário a partir desta hora (janela de 4 h)
} = process.env;

const missing = Object.entries({
  CRON_SECRET, VAPID_PUBLIC, VAPID_PRIVATE, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
}).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Faltam variáveis de ambiente: ${missing.join(", ")} (veja server/.env.example)`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const fs = admin.firestore();
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const dateHour = Number(DATE_HOUR), dailyHour = Number(DAILY_HOUR);

/* ---------- envio ---------- */
/** Envia para cada inscrição; devolve quantas foram entregues ao serviço de push. */
async function sendTo(subDocs, payload, ttlSeconds = 3600) {
  let delivered = 0;
  await Promise.all(subDocs.map(async (doc) => {
    const sub = doc.get("subscription");
    if (!sub) return;
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: ttlSeconds, urgency: "high" });
      delivered++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await doc.ref.delete().catch(() => {}); // inscrição morta
      else console.error("push err", e.statusCode, e.body || e.message); // 401/403 = chave VAPID diferente da do app
    }
  }));
  return delivered;
}
const prefOn = (member, key) => member?.notifyPrefs?.[key] !== false; // padrão: ligado
const prefOnlyIfSet = (member, key) => member?.notifyPrefs?.[key] === true; // padrão: desligado (resumo diário)

async function runSpace(spaceRef, today) {
  const [membersSnap, subsSnap, datesSnap, medsSnap, actSnap] = await Promise.all([
    spaceRef.collection("members").get(),
    spaceRef.collection("pushSubs").get(),
    spaceRef.collection("dates").get(),
    spaceRef.collection("meds").get(),
    spaceRef.collection("activity").where("notified", "==", false).get(),
  ]);

  const members = {}; membersSnap.forEach((m) => (members[m.id] = m.data()));
  const subByUid = {}; subsSnap.forEach((s) => (subByUid[s.id] = s));
  const subsFor = (uids) => uids.map((u) => subByUid[u]).filter(Boolean);
  const allUids = Object.keys(members);

  let sent = 0;

  // 1) DATAS — a partir de DATE_HOUR; 1 aviso por ocorrência (notifiedKey)
  if (today.hh >= dateHour) {
    for (const doc of datesSnap.docs) {
      const v = doc.data();
      const target = REMINDER_DAYS[v.reminder];
      if (target === undefined || !v.startISO) continue;
      const away = daysAwayTo(v.startISO, v.recurrence || "Não repete", today);
      if (away !== target) continue;
      const occKey = dateOccKey(today, away, target);
      if (v.notifiedKey === occKey) continue;
      const uids = allUids.filter((u) => prefOn(members[u], "dates"));
      sent += await sendTo(subsFor(uids), {
        title: v.title,
        body: away === 0 ? "É hoje!" : away === 1 ? "É amanhã!" : `Faltam ${away} dias`,
        tag: `date-${doc.id}`, url: "/",
      }, 6 * 3600);
      await doc.ref.update({ notifiedKey: occKey }).catch(() => {});
    }
  }

  // 2) REMÉDIOS — no horário (janela de 45 min), sem repetir e sem avisar dose já tomada
  for (const doc of medsSnap.docs) {
    const v = doc.data();
    if (v.notify === false || !Array.isArray(v.times)) continue;
    const slots = Array.isArray(v.notifiedSlots) ? v.notifiedSlots.slice() : [];
    const due = dueMedSlots({ times: v.times, minutes: today.minutes, dayKey: today.dayKey, notifiedSlots: slots, taken: v.taken });
    if (!due.length) continue;
    const uids = (v.assignee ? [v.assignee] : allUids).filter((u) => prefOn(members[u], "med"));
    for (const { t, slot } of due) {
      sent += await sendTo(subsFor(uids), {
        title: v.name, body: `Hora do remédio${v.dose ? ` (${v.dose})` : ""} — ${t}`,
        tag: `med-${doc.id}-${t}`, url: "/",
      }, 2 * 3600);
      slots.push(slot);
    }
    await doc.ref.update({ notifiedSlots: slots.slice(-40) }).catch(() => {});
  }

  // 3) ATIVIDADE — 1 push por autor (não 1 por item), só para o(s) outro(s); antigas só são marcadas
  if (!actSnap.empty) {
    const acts = actSnap.docs.map((d) => {
      const v = d.data();
      return {
        id: d.id, actorUid: v.actorUid, actorName: v.actorName, text: v.text, type: v.type,
        whenMs: v.when?.toMillis?.() ?? 0,
      };
    });
    const { messages, staleIds } = groupActivity(acts, Date.now());
    for (const m of messages) {
      const uids = allUids.filter((u) => u !== m.actorUid && prefOn(members[u], "partner"));
      if (uids.length) {
        sent += await sendTo(subsFor(uids), { title: "Pega Aí", body: m.body, tag: `act-${m.actorUid}`, url: "/" }, 3600);
      }
    }
    const ids = new Set([...staleIds, ...messages.flatMap((m) => m.ids)]);
    for (let i = 0; i < [...ids].length; i += 400) {
      const batch = fs.batch();
      [...ids].slice(i, i + 400).forEach((id) => batch.update(spaceRef.collection("activity").doc(id), { notified: true }));
      await batch.commit().catch((e) => console.error("activity mark err", e.message));
    }
  }

  // 4) RESUMO DIÁRIO — opt-in ("daily"), 1x por dia por pessoa, entre DAILY_HOUR e DAILY_HOUR+4h
  if (today.hh >= dailyHour && today.hh < dailyHour + 4) {
    const wanting = allUids.filter((u) => prefOnlyIfSet(members[u], "daily") && subByUid[u] && members[u].lastDailyKey !== today.dayKey);
    if (wanting.length) {
      const [listsSnap, itemsSnap] = await Promise.all([
        spaceRef.collection("lists").get(),
        spaceRef.collection("listItems").where("done", "==", false).get(),
      ]);
      const listById = {}; listsSnap.forEach((l) => (listById[l.id] = l.data()));
      const todayDates = datesSnap.docs
        .map((d) => d.data())
        .filter((v) => v.startISO && daysAwayTo(v.startISO, v.recurrence || "Não repete", today) === 0)
        .map((v) => v.title);
      for (const uid of wanting) {
        const meds = medsSnap.docs
          .map((d) => d.data())
          .filter((v) => v.notify !== false && Array.isArray(v.times) && (!v.assignee || v.assignee === uid))
          .reduce((n, v) => n + v.times.length, 0);
        let pending = 0;
        itemsSnap.forEach((it) => {
          const l = listById[it.get("listId")];
          if (l && (l.shared || !l.ownerId || l.ownerId === uid)) pending++;
        });
        const body = dailySummaryBody({ meds, dateTitles: todayDates, pending });
        if (body) sent += await sendTo([subByUid[uid]], { title: "Seu dia", body, tag: "daily", url: "/" }, 6 * 3600);
        await spaceRef.collection("members").doc(uid).update({ lastDailyKey: today.dayKey }).catch(() => {});
      }
    }
  }

  return sent;
}

async function run() {
  const today = nowInTz(TZ_NAME);
  const spaces = await fs.collection("spaces").get();
  let total = 0;
  for (const sp of spaces.docs) {
    try { total += await runSpace(sp.ref, today); }
    catch (e) { console.error(`erro no espaço ${sp.id}:`, e.message); } // um espaço com problema não derruba os outros
  }
  return { spaces: spaces.size, sent: total, at: new Date().toISOString() };
}

/** Teste ponta a ponta: manda uma notificação para TODOS os aparelhos inscritos. */
async function runTest() {
  const spaces = await fs.collection("spaces").get();
  let devices = 0, delivered = 0;
  for (const sp of spaces.docs) {
    const subs = await sp.ref.collection("pushSubs").get();
    devices += subs.size;
    delivered += await sendTo(subs.docs, {
      title: "Pega Aí", body: "Teste de notificação: está funcionando!", tag: "test", url: "/",
    }, 300);
  }
  return { devices, delivered, at: new Date().toISOString() };
}

const secretBuf = Buffer.from(CRON_SECRET);
function keyOk(given) {
  const g = Buffer.from(given || "");
  return g.length === secretBuf.length && timingSafeEqual(g, secretBuf);
}

let running = false;
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/health") { res.writeHead(200).end("ok"); return; }
  if (url.pathname !== "/notify") { res.writeHead(404).end("not found"); return; }
  if (!keyOk(url.searchParams.get("key"))) { res.writeHead(401).end("unauthorized"); return; }
  if (running) { res.writeHead(429).end(JSON.stringify({ error: "já está rodando" })); return; } // evita envio duplicado
  running = true;
  try {
    const out = url.searchParams.get("test") ? await runTest() : await run();
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(JSON.stringify({ error: e.message }));
  } finally {
    running = false;
  }
}).listen(PORT, () => console.log(`pega-ai-notify ouvindo na porta ${PORT}`));
