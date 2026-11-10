"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PersonColor } from "@/lib/cn";
import { Activity, AppData, DateType, List, Med, MedFreq, Person } from "@/lib/types";
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

export type Toast = { id: number; msg: string; tone: "error" | "info" };

type Store = AppData & {
  /** false enquanto auth, vínculo com o espaço e a 1ª carga dos dados não terminaram (ou deram erro). */
  ready: boolean; authed: boolean; hasSpace: boolean; onboarding: boolean; configured: boolean;
  /** erro que impede o app de abrir (rede, permissão, timeout). Use retryBoot() para tentar de novo. */
  bootError: string | null;
  /** problema depois que o app já abriu (ex.: uma coleção sem permissão). */
  syncWarning: string | null;
  retryBoot: () => void;
  /** true quando há escritas (ex.: listas/itens criados) que não chegaram ao servidor há mais de alguns segundos */
  unsynced: boolean;
  diag: {
    spaceId: string | null; uid: string | null; projectId: string;
    listas: number; listasOcultas: number; itens: number; itensSemLista: number;
    pendente: boolean; doCache: boolean;
  };
  toast: Toast | null; notify: (msg: string, tone?: Toast["tone"]) => void; dismissToast: () => void;
  me: Person; partner: Person; personById: (id?: string) => Person | undefined;
  week: Week; stats: { sequencia: number; pendentes: number; tarefas: number; conquistas: number };
  signIn: (email: string, pass: string) => Promise<{ error?: string; hasSpace: boolean }>;
  register: (email: string, pass: string) => Promise<{ error?: string }>;
  beginOnboarding: () => void; finishOnboarding: () => void;
  createSpaceFlow: (a: { spaceName?: string; memberName: string; color: PersonColor }) => Promise<{ error?: string }>;
  joinSpaceFlow: (a: { code: string; memberName: string; color: PersonColor }) => Promise<{ error?: string }>;
  previewCode: (code: string) => Promise<{ spaceName: string; adminName: string } | null>;
  persistDates: (entries: DateInput[]) => Promise<void>;
  signOutFlow: () => Promise<void>;
  addList: (name: string, shared: boolean) => Promise<string | null>;
  renameList: (listId: string, name: string) => Promise<boolean>;
  deleteList: (listId: string) => Promise<boolean>;
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
  const [activity, setActivity] = useState<Activity[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [bootNonce, setBootNonce] = useState(0);
  const [meta, setMeta] = useState({ listsPending: false, itemsPending: false, fromCache: false });
  const [unsynced, setUnsynced] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastSeq = useRef(0);
  const notify = useCallback((msg: string, tone: Toast["tone"] = "error") => {
    setToast({ id: ++toastSeq.current, msg, tone });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);
  const retryBoot = useCallback(() => setBootNonce((n) => n + 1), []);

  // monta a AppData mesclando listas + itens; deriva meds (próximo horário, adesão, etc.)
  const data: AppData = useMemo(() => {
    // agrupa os itens por lista uma única vez (antes era um filter por lista a cada snapshot)
    const byList = new Map<string, db.RawItem[]>();
    for (const it of items) {
      const arr = byList.get(it.listId);
      if (arr) arr.push(it); else byList.set(it.listId, [it]);
    }
    const uid = db.currentUserId();
    // listas "Minhas" de outra pessoa não aparecem (listas antigas, sem dono, continuam visíveis).
    // Obs.: é filtro de interface; as regras do Firestore ainda permitem leitura a qualquer membro.
    const lists: List[] = rawLists
      .filter((l) => l.shared || !l.ownerId || l.ownerId === uid)
      .map((l) => ({
        ...l,
        items: (byList.get(l.id) ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
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
    return { space, people, lists, meds, dates, achievements, activity };
  }, [space, people, rawLists, items, dates, rawMeds, achievements, activity]);

  const resetData = useCallback(() => {
    setSpace(EMPTY_DATA.space); setPeople([]); setRawLists([]); setItems([]); setDates([]); setRawMeds([]); setAchievements([]); setActivity([]);
    setDataLoaded(false); setLoadError(null); setSyncWarning(null);
  }, []);

  /* ---------- bootstrap (auth + vínculo com o espaço) ---------- */
  useEffect(() => {
    if (!configured) { setSess({ ready: true, authed: false, hasSpace: false, onboarding: false }); return; }
    let first = true; // só a 1ª resposta do Auth segura o Splash; as seguintes (login) não desmontam a tela
    setBootError(null);
    if (bootNonce > 0) setSess((s) => ({ ...s, ready: false })); // "tentar de novo": volta ao Splash, não ao fluxo de criar espaço
    const unsub = db.onAuth(async (uid) => {
      const isFirst = first; first = false;
      if (!uid) { resetData(); setSpaceId(null); setSpaceIds([]); setSess({ ready: true, authed: false, hasSpace: false, onboarding: false }); return; }
      setSess((s) => ({ ...s, authed: true, ready: isFirst ? false : s.ready }));
      try {
        const { active, ids } = await db.syncMembership();
        setSpaceIds(ids);
        if (active) {
          setSpaceId((prev) => prev ?? active);
          setSess((s) => ({ ...s, ready: true, hasSpace: true }));
        } else {
          setSpaceId(null);
          setSess((s) => ({ ...s, ready: true, hasSpace: false }));
        }
      } catch (e) {
        // NÃO assume "sem espaço": isso jogaria a pessoa para a criação de um espaço novo.
        console.error("[bootstrap]", e);
        setBootError(friendlyDbError(e, "Não foi possível carregar seu espaço."));
        setSess((s) => ({ ...s, ready: true }));
      }
    });
    return unsub;
  }, [configured, resetData, bootNonce]);

  /* ---------- realtime (onSnapshot) ---------- */
  useEffect(() => {
    if (!configured || !spaceId || !sess.authed) { setDataLoaded(false); return; }
    setDataLoaded(false); setLoadError(null); setSyncWarning(null);
    const need = ["space", "people", "lists", "items"];
    const seen = new Set<string>();
    let loaded = false;
    const timer = setTimeout(() => {
      if (!loaded) setLoadError("Está demorando para carregar. Verifique a conexão e tente de novo.");
    }, 15000);

    const unsub = db.subscribeSpace(
      spaceId,
      (slice) => {
        if ("space" in slice) { if (slice.space) setSpace(slice.space); seen.add("space"); }
        if (slice.people) { setPeople(slice.people); seen.add("people"); }
        if (slice.lists) { setRawLists(slice.lists); seen.add("lists"); }
        if (slice.items) { setItems(slice.items); seen.add("items"); }
        if (slice.dates) setDates(slice.dates);
        if (slice.meds) setRawMeds(slice.meds);
        if (slice.achievements) setAchievements(slice.achievements);
        if (slice.activity) setActivity(slice.activity);
        if (slice.meta) {
          setMeta((m) => ({
            listsPending: slice.meta?.lists ? slice.meta.lists.pending : m.listsPending,
            itemsPending: slice.meta?.items ? slice.meta.items.pending : m.itemsPending,
            fromCache: slice.meta?.lists ? slice.meta.lists.cache : m.fromCache,
          }));
        }
        if (!loaded && need.every((k) => seen.has(k))) {
          loaded = true; clearTimeout(timer);
          setLoadError(null); setDataLoaded(true);
        }
      },
      (e) => {
        const msg = friendlyDbError({ code: e.code, message: e.message }, "Falha ao sincronizar.");
        if (e.core && !loaded) setLoadError(msg);
        else setSyncWarning(msg);
      },
    );
    return () => { clearTimeout(timer); unsub(); };
  }, [configured, spaceId, sess.authed, bootNonce]);


  // escritas pendentes por mais de 8 s = não estão chegando ao servidor (offline, bloqueio ou regra negando)
  const hasPending = meta.listsPending || meta.itemsPending;
  useEffect(() => {
    if (!hasPending) { setUnsynced(false); return; }
    const t = setTimeout(() => setUnsynced(true), 8000);
    return () => clearTimeout(t);
  }, [hasPending]);

  const api = useMemo<Store>(() => {
    const me = people.find((p) => p.isMe) ?? people[0] ?? PLACEHOLDER_ME;
    const partner = people.find((p) => !p.isMe) ?? PLACEHOLDER_PARTNER;
    const personById = (id?: string) => people.find((p) => p.id === id);
    const week = deriveWeek(data, people);
    const tarefas = data.lists.flatMap((l) => l.items).filter((i) => i.done).length;
    const conquistas = achievements.filter((a) => a.unlocked).length;
    // sequência: vale se o último dia contado foi hoje ou ontem; senão zerou
    const hoje = todayKey();
    const ontem = todayKey(new Date(Date.now() - 86400000));
    const streak = space.streakDay === hoje || space.streakDay === ontem ? (space.streak ?? 0) : 0;
    const bumpStreak = () => {
      if (!spaceId || space.streakDay === hoje) return;
      const next = space.streakDay === ontem ? (space.streak ?? 0) + 1 : 1;
      db.dbSetStreak(spaceId, next, hoje).catch((e) => console.error("[streak]", e?.message ?? e));
    };
    const pendentes = data.lists.flatMap((l) => l.items).filter((i) => !i.done).length;
    const sid = spaceId;
    const fail = (msg: string) => (e: any) => { console.error(`[${msg}]`, e?.message ?? e); notify(msg); };
    /**
     * Espera o servidor confirmar, mas no máximo 2,5 s. Offline a escrita fica na fila local
     * (o cache persistente a envia depois), então seguimos como "salvo". Se o servidor RECUSAR
     * (regra, permissão), avisa com um toast mesmo depois de a tela já ter seguido.
     * Resolve false só quando a recusa chega antes do prazo.
     */
    const settle = (p: Promise<unknown>, msg: string) =>
      new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => { if (!settled) { settled = true; resolve(ok); } };
        const timer = setTimeout(() => finish(true), 2500);
        p.then(() => { clearTimeout(timer); finish(true); })
          .catch((e) => { clearTimeout(timer); fail(msg)(e); finish(false); });
      });

    return {
      ...data,
      // pronto = Auth resolvido + vínculo com o espaço resolvido + 1ª carga das listas/pessoas feita (ou erro a exibir)
      ready: sess.ready && (sess.onboarding || !sess.authed || !sess.hasSpace || dataLoaded || !!loadError || !!bootError),
      authed: sess.authed, hasSpace: sess.hasSpace, onboarding: sess.onboarding, configured,
      bootError: bootError ?? (!dataLoaded && sess.hasSpace && !sess.onboarding ? loadError : null),
      syncWarning, retryBoot, toast, notify, dismissToast, unsynced,
      diag: {
        spaceId: sid, uid: db.currentUserId(), projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? ""),
        listas: rawLists.length, listasOcultas: rawLists.length - data.lists.length,
        itens: items.length, itensSemLista: items.filter((i) => !rawLists.some((l) => l.id === i.listId)).length,
        pendente: hasPending, doCache: meta.fromCache,
      },
      me, partner, personById, week, stats: { sequencia: streak, pendentes, tarefas, conquistas },

      signIn: async (email, pass) => {
        emailRef.current = email;
        const { error } = await db.signIn(email, pass);
        if (error) return { error, hasSpace: false };
        try {
          const { active, ids } = await db.syncMembership();
          setSpaceIds(ids);
          setSpaceId(active);
          setSess({ ready: true, authed: true, hasSpace: !!active, onboarding: false });
          return { hasSpace: !!active };
        } catch (e) {
          return { error: friendlyDbError(e, "Não foi possível carregar seu espaço. Tente de novo."), hasSpace: false };
        }
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
          await settle(db.dbAddDate(sid2, {
            title: e.title.trim(), startISO: e.startISO, endISO: e.endISO, type: e.type, color: e.color,
            recurrence, reminder: recurrence === "Todo ano" ? "7 dias antes" : "3 dias antes",
          }).done, "Não foi possível salvar a data.");
        }
      },
      signOutFlow: async () => { await db.signOut(); /* onAuth limpa o resto */ },

      addList: async (name, shared) => {
        if (!sid) return null;
        const position = rawLists.reduce((m, l) => Math.max(m, (l.position ?? -1) + 1), 0);
        const { id, done } = db.dbAddList(sid, name, shared, shared ? undefined : me.id, position);
        return (await settle(done, "Não foi possível criar a lista. Tente de novo.")) ? id : null;
      },
      renameList: async (listId, name) => {
        if (!sid) return false;
        return settle(db.dbRenameList(sid, listId, name), "Não foi possível renomear a lista.");
      },
      deleteList: async (listId) => {
        if (!sid) return false;
        return settle(db.dbDeleteList(sid, listId), "Não foi possível excluir a lista. Tente de novo.");
      },

      toggleItem: (listId, itemId) => {
        if (!sid) return;
        const it = items.find((x) => x.id === itemId);
        if (!it) return;
        const newDone = !it.done;
        db.dbToggleItem(sid, itemId, newDone).catch(fail("Não foi possível atualizar o item."));
        if (newDone) {
          db.dbLogActivity(sid, { text: `concluiu "${it.text}"`, type: "item_done", done: true });
          bumpStreak();
        }
      },
      toggleItemMember: (listId, itemId, memberId) => {
        if (!sid) return;
        const it = items.find((x) => x.id === itemId);
        if (!it) return;
        const cur = it.doneBy ?? [];
        const checking = !cur.includes(memberId);
        const next = checking ? [...cur, memberId] : cur.filter((x) => x !== memberId);
        const done = next.length >= (people.length || 1);
        db.dbSetItemDoneBy(sid, itemId, next, done).catch(fail("Não foi possível atualizar o item."));
        if (checking) {
          db.dbLogActivity(sid, { text: `pegou "${it.text}"`, type: "item_done", done });
          bumpStreak();
        }
      },
      addItem: async (listId, text, opts) => {
        if (!sid) return;
        const everyone = !!opts?.everyone;
        let pos = 0;
        for (const i of items) if (i.listId === listId && i.position >= pos) pos = i.position + 1;
        const added = db.dbAddItem(sid, listId, text, everyone ? undefined : opts?.assignee, pos, everyone);
        if (!(await settle(added.done, "Não foi possível adicionar o item."))) return;
        db.dbLogActivity(sid, { text: `adicionou "${text}"`, type: "item_add" });
      },
      updateItem: async (listId, itemId, patch) => {
        if (!sid) return;
        await settle(db.dbUpdateItem(sid, itemId, { text: patch.text, assignee: patch.assignee === undefined ? undefined : patch.assignee ?? null, everyone: patch.everyone }), "Não foi possível salvar o item.");
      },
      deleteItem: async (listId, itemId) => { if (sid) await settle(db.dbDeleteItem(sid, itemId), "Não foi possível excluir o item."); },

      addDate: async (d0) => {
        if (!sid) return;
        if (!(await settle(db.dbAddDate(sid, { ...d0 }).done, "Não foi possível salvar a data."))) return;
        db.dbLogActivity(sid, { text: `adicionou a data "${d0.title}"`, type: "date_add" });
      },
      updateDate: async (id, d0) => { if (sid) await settle(db.dbUpdateDate(sid, id, { ...d0 }), "Não foi possível salvar a data."); },
      deleteDate: async (id) => { if (sid) await settle(db.dbDeleteDate(sid, id), "Não foi possível excluir a data."); },

      addMed: async (m) => {
        if (!sid) return null;
        const times = computeTimes(m);
        const added = db.dbAddMed(sid, {
          name: m.name.trim(), dose: m.dose.trim(), assignee: m.assignee,
          freq: m.freq, everyXHours: m.everyXHours, startHour: m.startHour,
          durationHours: m.durationHours, times, notify: m.notify, stock: m.stock,
        });
        if (!(await settle(added.done, "Não foi possível salvar o remédio."))) return null;
        db.dbLogActivity(sid, { text: `adicionou o remédio "${m.name.trim()}"`, type: "med_add" });
        return added.id;
      },
      updateMed: async (id, m) => {
        if (!sid) return;
        const times = computeTimes(m);
        await settle(db.dbUpdateMed(sid, id, {
          name: m.name.trim(), dose: m.dose.trim(), assignee: m.assignee,
          freq: m.freq, everyXHours: m.everyXHours, startHour: m.startHour,
          durationHours: m.durationHours, times, notify: m.notify, stock: m.stock,
        }), "Não foi possível salvar o remédio.");
      },
      deleteMed: async (id) => { if (sid) await settle(db.dbDeleteMed(sid, id), "Não foi possível excluir o remédio."); },
      toggleMedIntake: async (id, hhmm, taken) => {
        if (!sid) return;
        const key = intakeKey(todayKey(), hhmm);
        await settle(db.dbMarkIntake(sid, id, key, taken), "Não foi possível registrar a dose.");
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
  }, [data, space, people, achievements, sess, configured, spaceId, spaceIds, items, rawLists, dataLoaded, loadError, bootError, syncWarning, toast, retryBoot, notify, dismissToast, unsynced, meta, hasPending]);


  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore deve ser usado dentro de <StoreProvider>");
  return v;
}

export type { Person, List, Med, ImportantDate, Achievement, Activity } from "@/lib/types";
