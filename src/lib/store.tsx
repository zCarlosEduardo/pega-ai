"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PersonColor } from "@/lib/cn";
import { AppData, DateType, List, Med, MedFreq, Person } from "@/lib/types";
import { hasFirebase } from "@/lib/firebase";
import { EMPTY_DATA } from "@/lib/seed";
import { Recurrence } from "@/lib/dates";
import { computeTimes, deriveMed, intakeKey, todayKey } from "@/lib/meds";
import * as db from "@/lib/db";

export type MedInput = {
  name: string; dose: string; assignee: string;
  freq: MedFreq; everyXHours?: number; startHour: string; durationHours?: number;
  notify: boolean; stock?: number;
};

type Week = { pct: number; done: number; total: number; perPerson: { name: string; color: PersonColor; n: number }[] };
type DateInput = { title: string; startISO: string; endISO?: string; type: DateType; color: PersonColor };
type DateFull = DateInput & { recurrence: Recurrence; reminder: string };

type Store = AppData & {
  ready: boolean; authed: boolean; hasSpace: boolean; onboarding: boolean; configured: boolean;
  me: Person; partner: Person; personById: (id?: string) => Person | undefined;
  streak: number; week: Week; stats: { sequencia: number; tarefas: number; conquistas: number };
  signIn: (email: string, pass: string) => Promise<{ error?: string; hasSpace: boolean }>;
  register: (email: string, pass: string) => Promise<{ error?: string }>;
  beginOnboarding: () => void; finishOnboarding: () => void;
  createSpaceFlow: (a: { spaceName?: string; memberName: string; color: PersonColor }) => Promise<{ error?: string }>;
  joinSpaceFlow: (a: { code: string; memberName: string; color: PersonColor }) => Promise<{ error?: string }>;
  previewCode: (code: string) => Promise<{ spaceName: string; adminName: string } | null>;
  persistDates: (entries: DateInput[]) => Promise<void>;
  signOutFlow: () => Promise<void>;
  addList: (name: string, shared: boolean) => Promise<string | null>;
  renameList: (listId: string, name: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  toggleItem: (listId: string, itemId: string) => void;
  toggleItemMember: (listId: string, itemId: string, memberId: string) => void;
  addItem: (listId: string, text: string, opts?: { assignee?: string; everyone?: boolean }) => Promise<void>;
  updateItem: (listId: string, itemId: string, patch: { text?: string; assignee?: string; everyone?: boolean }) => Promise<void>;
  deleteItem: (listId: string, itemId: string) => Promise<void>;
  addDate: (d: DateFull) => Promise<void>;
  updateDate: (id: string, d: DateFull) => Promise<void>;
  deleteDate: (id: string) => Promise<void>;
  addMed: (m: MedInput) => Promise<string | null>;
  updateMed: (id: string, m: MedInput) => Promise<void>;
  deleteMed: (id: string) => Promise<void>;
  toggleMedIntake: (id: string, hhmm: string, taken: boolean) => Promise<void>;
  setMyColor: (c: PersonColor) => void; setMyName: (n: string) => void; setSpaceName: (n: string) => void;
  // espaço / membros
  removeMember: (memberId: string) => Promise<{ error?: string }>;
  spaceIds: string[];
  switchSpace: (spaceId: string) => Promise<void>;
  createAnotherSpace: (a: { spaceName: string; memberName: string; color: PersonColor }) => Promise<{ error?: string; id?: string }>;
  leaveCurrentSpace: () => Promise<{ error?: string }>;
};

const PLACEHOLDER_PARTNER: Person = { id: "", name: "seu par", email: "", color: "p2", role: "member" };
const PLACEHOLDER_ME: Person = { id: "", name: "você", email: "", color: "p1", role: "admin", isMe: true };

function deriveWeek(data: AppData, people: Person[]): Week {
  const items = data.lists.filter((l) => l.shared).flatMap((l) => l.items);
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const perPerson = people.slice(0, 2).map((p) => ({ name: p.name, color: p.color, n: items.filter((i) => i.done && i.assignee === p.id).length }));
  return { pct, done, total, perPerson };
}
function recurrenceFor(type: DateType): Recurrence {
  if (type === "Aniversário") return "Todo ano";
  if (type === "Mensário") return "Todo mês";
  return "Não repete";
}

function friendlyDbError(e: any, fallback: string): string {
  const m = `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase();
  if (m.includes("permission-denied") || m.includes("insufficient permissions"))
    return "Sem permissão no Firestore. Publique as regras (firebase/firestore.rules) e confirme que o Firestore Database foi criado.";
  if (m.includes("unavailable") || m.includes("network"))
    return "Falha de rede com o Firestore. Tente de novo.";
  return e?.message ?? fallback;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const configured = hasFirebase;
  const [space, setSpace] = useState(EMPTY_DATA.space);
  const [people, setPeople] = useState<Person[]>([]);
  const [rawLists, setRawLists] = useState<List[]>([]);
  const [items, setItems] = useState<db.RawItem[]>([]);
  const [dates, setDates] = useState(EMPTY_DATA.dates);
  const [rawMeds, setRawMeds] = useState<any[]>([]);
  const [achievements, setAchievements] = useState(EMPTY_DATA.achievements);
  const [sess, setSess] = useState({ ready: false, authed: false, hasSpace: false, onboarding: false });
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [spaceIds, setSpaceIds] = useState<string[]>([]);
  const emailRef = useRef("");

  // monta a AppData mesclando listas + itens; deriva meds (próximo horário, adesão, etc.)
  const data: AppData = useMemo(() => {
    const lists: List[] = rawLists.map((l) => ({
      ...l,
      items: items.filter((it) => it.listId === l.id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    }));
    const meds: Med[] = rawMeds.map((m) => {
      const times = (Array.isArray(m.times) && m.times.length)
        ? m.times
        : computeTimes({ freq: m.freq ?? "daily", startHour: m.startHour ?? "08:00", everyXHours: m.everyXHours, durationHours: m.durationHours });
      return deriveMed({
        id: m.id, name: m.name ?? "", dose: m.dose ?? "", assignee: m.assignee ?? "",
        freq: (m.freq ?? "daily") as MedFreq, everyXHours: m.everyXHours, startHour: m.startHour ?? "08:00",
        durationHours: m.durationHours, times, notify: !!m.notify, stock: m.stock,
        taken: m.taken ?? {}, createdAtISO: m.createdAt?.toDate?.()?.toISOString?.(),
      });
    }).sort((a, b) => a.time.localeCompare(b.time));
    return { space, people, lists, meds, dates, achievements, activity: [] };
  }, [space, people, rawLists, items, dates, rawMeds, achievements]);

  const resetData = useCallback(() => {
    setSpace(EMPTY_DATA.space); setPeople([]); setRawLists([]); setItems([]); setDates([]); setRawMeds([]); setAchievements([]);
  }, []);

  /* ---------- bootstrap (auth) ---------- */
  useEffect(() => {
    if (!configured) { setSess({ ready: true, authed: false, hasSpace: false, onboarding: false }); return; }
    const unsub = db.onAuth(async (uid) => {
      if (!uid) { resetData(); setSpaceId(null); setSpaceIds([]); setSess({ ready: true, authed: false, hasSpace: false, onboarding: false }); return; }
      setSess((s) => ({ ...s, ready: true, authed: true }));
      try {
        const { active, ids } = await db.syncMembership();
        setSpaceIds(ids);
        if (active) {
          setSpaceId((prev) => prev ?? active);
          setSess((s) => ({ ...s, hasSpace: true }));
        } else {
          setSpaceId(null);
          setSess((s) => ({ ...s, hasSpace: false }));
        }
      } catch { /* mantém o estado atual */ }
    });
    return unsub;
  }, [configured, resetData]);

  /* ---------- realtime (onSnapshot) ---------- */
  useEffect(() => {
    if (!configured || !spaceId || !sess.authed) return;
    const unsub = db.subscribeSpace(spaceId, (slice) => {
      if (slice.space) setSpace(slice.space);
      if (slice.people) setPeople(slice.people);
      if (slice.lists) setRawLists(slice.lists);
      if (slice.items) setItems(slice.items);
      if (slice.dates) setDates(slice.dates);
      if (slice.meds) setRawMeds(slice.meds);
      if (slice.achievements) setAchievements(slice.achievements);
    });
    return unsub;
  }, [configured, spaceId, sess.authed]);


  const api = useMemo<Store>(() => {
    const me = people.find((p) => p.isMe) ?? people[0] ?? PLACEHOLDER_ME;
    const partner = people.find((p) => !p.isMe) ?? PLACEHOLDER_PARTNER;
    const personById = (id?: string) => people.find((p) => p.id === id);
    const week = deriveWeek(data, people);
    const tarefas = data.lists.flatMap((l) => l.items).filter((i) => i.done).length;
    const conquistas = achievements.filter((a) => a.unlocked).length;
    const streak = 0;
    const sid = spaceId;

    return {
      ...data,
      ready: sess.ready, authed: sess.authed, hasSpace: sess.hasSpace, onboarding: sess.onboarding, configured,
      me, partner, personById, streak, week, stats: { sequencia: streak, tarefas, conquistas },

      signIn: async (email, pass) => {
        emailRef.current = email;
        const { error } = await db.signIn(email, pass);
        if (error) return { error, hasSpace: false };
        const { active, ids } = await db.syncMembership();
        setSpaceIds(ids);
        setSpaceId(active);
        setSess({ ready: true, authed: true, hasSpace: !!active, onboarding: false });
        return { hasSpace: !!active };
      },
      register: async (email, pass) => {
        emailRef.current = email;
        const { error } = await db.signUp(email, pass);
        if (error) return { error };
        setSess((s) => ({ ...s, ready: true, authed: true, hasSpace: false }));
        return {};
      },
      beginOnboarding: () => setSess((s) => ({ ...s, onboarding: true })),
      finishOnboarding: () => setSess((s) => ({ ...s, onboarding: false })),

      createSpaceFlow: async ({ spaceName, memberName, color }) => {
        try {
          const id = await db.createAdditionalSpace({ spaceName: spaceName || "Nosso espaço", memberName, email: emailRef.current, color });
          setSpaceId(id);
          setSpaceIds((prev) => prev.includes(id) ? prev : [...prev, id]);
          setSess((s) => ({ ...s, hasSpace: true }));
          return {};
        } catch (e: any) { return { error: friendlyDbError(e, "Erro ao criar espaço") }; }
      },
      joinSpaceFlow: async ({ code, memberName, color }) => {
        try {
          const id = await db.joinSpaceByCode({ code, memberName, email: emailRef.current, color });
          await db.dbSwitchSpace(id);
          setSpaceId(id);
          setSpaceIds((prev) => prev.includes(id) ? prev : [...prev, id]);
          setSess((s) => ({ ...s, hasSpace: true }));
          return {};
        } catch (e: any) { return { error: friendlyDbError(e, "Erro ao entrar no espaço") }; }
      },
      previewCode: (code) => db.previewSpaceByCode(code),


      persistDates: async (entries) => {
        const valid = entries.filter((e) => e.title.trim() && e.startISO);
        const sid2 = spaceId ?? (await db.findMySpaceId());
        if (!sid2) return;
        for (const e of valid) {
          const recurrence = recurrenceFor(e.type);
          await db.dbAddDate(sid2, {
            title: e.title.trim(), startISO: e.startISO, endISO: e.endISO, type: e.type, color: e.color,
            recurrence, reminder: recurrence === "Todo ano" ? "7 dias antes" : "3 dias antes",
          });
        }
      },
      signOutFlow: async () => { await db.signOut(); /* onAuth limpa o resto */ },

      addList: async (name, shared) => {
        if (!sid) return null;
        try {
          const { id } = await db.dbAddList(sid, name, shared, shared ? undefined : me.id, rawLists.length);
          return id;
        } catch { return null; }
      },
      renameList: async (listId, name) => { if (sid) await db.dbRenameList(sid, listId, name).catch(() => {}); },
      deleteList: async (listId) => { if (sid) await db.dbDeleteList(sid, listId).catch(() => {}); },

      toggleItem: (listId, itemId) => {
        if (!sid) return;
        const it = items.find((x) => x.id === itemId);
        if (!it) return;
        const newDone = !it.done;
        db.dbToggleItem(sid, itemId, newDone).catch((e) => console.error("[toggleItem]", e.message));
        if (newDone) db.dbLogActivity(sid, { text: `concluiu "${it.text}"`, type: "item_done", done: true });
      },
      toggleItemMember: (listId, itemId, memberId) => {
        if (!sid) return;
        const it = items.find((x) => x.id === itemId);
        if (!it) return;
        const cur = it.doneBy ?? [];
        const checking = !cur.includes(memberId);
        const next = checking ? [...cur, memberId] : cur.filter((x) => x !== memberId);
        const done = next.length >= (people.length || 1);
        db.dbSetItemDoneBy(sid, itemId, next, done).catch((e) => console.error("[toggleItemMember]", e.message));
        if (checking) db.dbLogActivity(sid, { text: `pegou "${it.text}"`, type: "item_done", done });
      },
      addItem: async (listId, text, opts) => {
        if (!sid) return;
        const everyone = !!opts?.everyone;
        const pos = items.filter((i) => i.listId === listId).length || 0;
        await db.dbAddItem(sid, listId, text, everyone ? undefined : opts?.assignee, pos, everyone).catch((e) => console.error("[addItem]", e.message));
        db.dbLogActivity(sid, { text: `adicionou "${text}"`, type: "item_add" });
      },
      updateItem: async (listId, itemId, patch) => {
        if (!sid) return;
        await db.dbUpdateItem(sid, itemId, { text: patch.text, assignee: patch.assignee === undefined ? undefined : patch.assignee ?? null, everyone: patch.everyone }).catch((e) => console.error("[updateItem]", e.message));
      },
      deleteItem: async (listId, itemId) => { if (sid) await db.dbDeleteItem(sid, itemId).catch(() => {}); },

      addDate: async (d0) => { if (sid) { await db.dbAddDate(sid, { ...d0 }).catch((e) => console.error("[addDate]", e.message)); db.dbLogActivity(sid, { text: `adicionou a data "${d0.title}"`, type: "date_add" }); } },
      updateDate: async (id, d0) => { if (sid) await db.dbUpdateDate(sid, id, { ...d0 }).catch((e) => console.error("[updateDate]", e.message)); },
      deleteDate: async (id) => { if (sid) await db.dbDeleteDate(sid, id).catch(() => {}); },

      addMed: async (m) => {
        if (!sid) return null;
        try {
          const times = computeTimes(m);
          const id = await db.dbAddMed(sid, {
            name: m.name.trim(), dose: m.dose.trim(), assignee: m.assignee,
            freq: m.freq, everyXHours: m.everyXHours, startHour: m.startHour,
            durationHours: m.durationHours, times, notify: m.notify, stock: m.stock,
          });
          db.dbLogActivity(sid, { text: `adicionou o remédio "${m.name.trim()}"`, type: "med_add" });
          return id;
        } catch (e: any) { console.error("[addMed]", e?.message); return null; }
      },
      updateMed: async (id, m) => {
        if (!sid) return;
        const times = computeTimes(m);
        await db.dbUpdateMed(sid, id, {
          name: m.name.trim(), dose: m.dose.trim(), assignee: m.assignee,
          freq: m.freq, everyXHours: m.everyXHours, startHour: m.startHour,
          durationHours: m.durationHours, times, notify: m.notify, stock: m.stock,
        }).catch((e) => console.error("[updateMed]", e?.message));
      },
      deleteMed: async (id) => { if (sid) await db.dbDeleteMed(sid, id).catch(() => {}); },
      toggleMedIntake: async (id, hhmm, taken) => {
        if (!sid) return;
        const key = intakeKey(todayKey(), hhmm);
        await db.dbMarkIntake(sid, id, key, taken).catch((e) => console.error("[intake]", e?.message));
      },

      setMyColor: (c) => { if (sid && me.id) db.dbUpdateMember(sid, me.id, { color: c }).catch((e) => console.error("[setMyColor]", e.message)); },
      setMyName: (n) => { if (sid && me.id) db.dbUpdateMember(sid, me.id, { name: n }).catch((e) => console.error("[setMyName]", e.message)); },
      setSpaceName: (n) => { if (sid) db.dbUpdateSpaceName(sid, n).catch((e) => console.error("[setSpaceName]", e.message)); },

      removeMember: async (memberId) => {
        if (!sid) return { error: "Sem espaço ativo" };
        if (me.role !== "admin") return { error: "Apenas admin pode remover pessoas." };
        if (memberId === me.id) return { error: "Use 'Sair do espaço' para sair." };
        try { await db.dbRemoveMember(sid, memberId); return {}; }
        catch (e: any) { return { error: friendlyDbError(e, "Erro ao remover pessoa") }; }
      },
      spaceIds,
      switchSpace: async (newId) => {
        await db.dbSwitchSpace(newId).catch(() => {});
        setSpaceId(newId);
        setSpaceIds((prev) => prev.includes(newId) ? prev : [...prev, newId]);
        setSess((s) => ({ ...s, hasSpace: true }));
      },
      createAnotherSpace: async ({ spaceName, memberName, color }) => {
        try {
          const id = await db.createAdditionalSpace({ spaceName, memberName, email: emailRef.current || me.email || "", color });
          setSpaceId(id);
          setSpaceIds((prev) => prev.includes(id) ? prev : [...prev, id]);
          setSess((s) => ({ ...s, hasSpace: true }));
          return { id };
        } catch (e: any) { return { error: friendlyDbError(e, "Erro ao criar espaço") }; }
      },
      leaveCurrentSpace: async () => {
        if (!sid) return { error: "Sem espaço ativo" };
        try {
          const { active, ids } = await db.leaveSpace(sid);
          setSpaceIds(ids);
          setSpaceId(active);
          setSess((s) => ({ ...s, hasSpace: !!active }));
          return {};
        } catch (e: any) { return { error: friendlyDbError(e, "Erro ao sair do espaço") }; }
      },
    };
  }, [data, people, achievements, sess, configured, spaceId, spaceIds, items, rawLists]);


  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore deve ser usado dentro de <StoreProvider>");
  return v;
}

export type { Person, List, Med, ImportantDate, Achievement, Activity } from "@/lib/types";
