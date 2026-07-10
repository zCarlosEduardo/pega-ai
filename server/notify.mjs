// Pega Aí — enviador de Web Push. O cron-job.org chama GET /notify?key=CRON_SECRET.
// Lê o Firestore (admin), calcula o que está vencido e dispara push via VAPID.
import http from "node:http";
import admin from "firebase-admin";
import webpush from "web-push";

const {
  PORT = 8787, CRON_SECRET, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT = "mailto:admin@pega.ai",
  FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, TZ_NAME = "America/Sao_Paulo",
} = process.env;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: (FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
});
const fs = admin.firestore();
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

/* ---------- tempo no fuso configurado ---------- */
function nowInTz() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_NAME, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  const y = +g("year"), m = +g("month"), d = +g("day"), hh = +g("hour"), mm = +g("minute");
  return { y, m, d, hh, mm, dayKey: `${g("year")}-${g("month")}-${g("day")}`, minutes: hh * 60 + mm };
}

/* ---------- recorrência (espelha src/lib/dates.ts) ---------- */
function daysAwayTo(startISO, recurrence, today) {
  const [y, mo, d] = startISO.split("-").map(Number);
  const t = new Date(today.y, today.m - 1, today.d);
  const diff = (occ) => Math.round((occ - t) / 86400000);
  if (recurrence === "Todo ano") {
    let occ = new Date(today.y, mo - 1, d);
    if (occ < t) occ = new Date(today.y + 1, mo - 1, d);
    return diff(occ);
  }
  if (recurrence === "Todo mês") {
    const dim = (yy, mm) => new Date(yy, mm + 1, 0).getDate();
    let occ = new Date(today.y, today.m - 1, Math.min(d, dim(today.y, today.m - 1)));
    if (occ < t) { const nm = new Date(today.y, today.m, 1); occ = new Date(nm.getFullYear(), nm.getMonth(), Math.min(d, dim(nm.getFullYear(), nm.getMonth()))); }
    return diff(occ);
  }
  return diff(new Date(y, mo - 1, d)); // não repete
}
const REMINDER_DAYS = { "No dia": 0, "1 dia antes": 1, "3 dias antes": 3, "7 dias antes": 7 };

/* ---------- envio ---------- */
async function sendTo(subDocs, payload) {
  await Promise.all(subDocs.map(async (doc) => {
    const sub = doc.get("subscription");
    if (!sub) return;
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await doc.ref.delete().catch(() => {}); // sub morta
      else console.error("push err", e.statusCode, e.body || e.message);
    }
  }));
}
const prefOn = (member, key) => member?.notifyPrefs?.[key] !== false; // default ligado

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

  // 1) DATAS
  for (const doc of datesSnap.docs) {
    const v = doc.data();
    const target = REMINDER_DAYS[v.reminder];
    if (target === undefined) continue;
    const away = daysAwayTo(v.startISO, v.recurrence || "Não repete", today);
    if (away !== target) continue;
    const next = new Date(today.y, today.m - 1, today.d + away);
    const occKey = `${next.toISOString().slice(0, 10)}:${target}`;
    if (v.notifiedKey === occKey) continue;
    const uids = allUids.filter((u) => prefOn(members[u], "dates"));
    await sendTo(subsFor(uids), {
      title: `📅 ${v.title}`,
      body: away === 0 ? "É hoje!" : away === 1 ? "É amanhã!" : `Faltam ${away} dias`,
      tag: `date-${doc.id}`, url: "/",
    });
    await doc.ref.update({ notifiedKey: occKey }).catch(() => {});
    sent++;
  }

  // 2) REMÉDIOS (times: ["08:00","20:00"])
  for (const doc of medsSnap.docs) {
    const v = doc.data();
    if (v.notify === false || !Array.isArray(v.times)) continue;
    const slots = Array.isArray(v.notifiedSlots) ? v.notifiedSlots : [];
    let changed = false;
    for (const t of v.times) {
      const [h, mn] = String(t).split(":").map(Number);
      const due = today.minutes >= h * 60 + mn && today.minutes < h * 60 + mn + 30; // janela 30min
      const slot = `${today.dayKey}:${t}`;
      if (!due || slots.includes(slot)) continue;
      const uids = (v.assignee ? [v.assignee] : allUids).filter((u) => prefOn(members[u], "med"));
      await sendTo(subsFor(uids), {
        title: `💊 ${v.name}`, body: `Hora do remédio${v.dose ? ` (${v.dose})` : ""} — ${t}`,
        tag: `med-${doc.id}-${t}`, url: "/",
      });
      slots.push(slot); changed = true; sent++;
    }
    if (changed) await doc.ref.update({ notifiedSlots: slots.slice(-40) }).catch(() => {});
  }

  // 3) ATIVIDADE RECENTE (envia pro parceiro, não pro autor)
  for (const doc of actSnap.docs) {
    const v = doc.data();
    const uids = allUids.filter((u) => u !== v.actorUid && prefOn(members[u], "partner"));
    if (uids.length) {
      await sendTo(subsFor(uids), {
        title: "Pega Aí", body: `${v.actorName || "Seu par"} ${v.text}`,
        tag: `act-${doc.id}`, url: "/",
      });
      sent++;
    }
    await doc.ref.update({ notified: true }).catch(() => {});
  }

  return sent;
}

async function run() {
  const today = nowInTz();
  const spaces = await fs.collection("spaces").get();
  let total = 0;
  for (const sp of spaces.docs) total += await runSpace(sp.ref, today);
  return { spaces: spaces.size, sent: total, at: new Date().toISOString() };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/notify") { res.writeHead(404).end("not found"); return; }
  if (!CRON_SECRET || url.searchParams.get("key") !== CRON_SECRET) { res.writeHead(401).end("unauthorized"); return; }
  try {
    const out = await run();
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(JSON.stringify({ error: e.message }));
  }
}).listen(PORT, () => console.log(`pega-ai-notify ouvindo na porta ${PORT}`));
