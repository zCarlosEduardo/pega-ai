import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
  type DocumentData, type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,
  signOut as fbSignOut, type User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { PersonColor } from "@/lib/cn";
import { Activity, ImportantDate, List, ListItem, Person, Space } from "@/lib/types";
import { Recurrence, nextOccurrence, occurrenceLabel } from "@/lib/dates";

function fdb() { if (!db) throw new Error("Firebase não configurado"); return db; }
function fauth() { if (!auth) throw new Error("Firebase não configurado"); return auth; }

export type RawItem = ListItem & { listId: string; position: number };
type Slice = Partial<{ space: Space | undefined; people: Person[]; lists: List[]; items: RawItem[]; dates: ImportantDate[]; meds: any[]; achievements: any[]; activity: Activity[]; meta: Partial<Record<"lists" | "items", { pending: boolean; cache: boolean }>> }>;

/* ---------------- auth ---------------- */
export function onAuth(cb: (uid: string | null) => void) {
  return onAuthStateChanged(fauth(), (u: User | null) => cb(u?.uid ?? null));
}
export function currentUserId(): string | null {
  return auth?.currentUser?.uid ?? null;
}
export async function signIn(email: string, password: string) {
  try { await signInWithEmailAndPassword(fauth(), email, password); return {}; }
  catch (e: any) { return { error: mapAuthError(e) }; }
}
export async function signUp(email: string, password: string) {
  try {
    const cred = await createUserWithEmailAndPassword(fauth(), email, password);
    return { session: !!cred.user };
  } catch (e: any) {
    return { error: mapAuthError(e), status: e?.code as string | undefined };
  }
}
export async function signOut() { await fbSignOut(fauth()); }

function mapAuthError(e: any): string {
  const c = e?.code ?? "";
  if (c.includes("email-already-in-use")) return "Esse e-mail já tem conta.";
  if (c.includes("invalid-credential") || c.includes("wrong-password")) return "E-mail ou senha incorretos.";
  if (c.includes("weak-password")) return "Senha muito fraca (mínimo 6 caracteres).";
  if (c.includes("invalid-email")) return "E-mail inválido.";
  if (c.includes("network")) return "Falha de rede. Tente de novo.";
  return e?.message ?? "Erro de autenticação.";
}

/* ---------------- helpers ---------------- */
function inviteCode() {
  const s = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PEGA-${s}`;
}
const DOT_PALETTE: List["dotColor"][] = ["success", "accent", "warning"];

function mapMember(d: QueryDocumentSnapshot<DocumentData>): Person {
  const m = d.data();
  return {
    id: d.id, userId: d.id, name: m.name, email: m.email,
    color: m.color as PersonColor, role: m.role, isMe: d.id === currentUserId(), notifyPrefs: m.notifyPrefs ?? undefined,
  };
}
function mapList(d: QueryDocumentSnapshot<DocumentData>): List {
  const l = d.data();
  return {
    id: d.id, name: l.name, shared: !!l.shared, dotColor: (l.dotColor ?? "accent") as List["dotColor"],
    ownerId: (l.ownerId as string | null) ?? undefined,
    position: typeof l.position === "number" ? l.position : undefined,
    items: [],
  };
}
function mapItem(d: QueryDocumentSnapshot<DocumentData>): RawItem {
  const it = d.data();
  return {
    id: d.id, listId: it.listId, text: it.text, done: !!it.done,
    assignee: it.assignee ?? undefined, everyone: !!it.everyone,
    doneBy: (it.doneBy ?? []) as string[], position: it.position ?? 0,
  };
}
export function mapDate(d: any): ImportantDate {
  const recurrence = (d.recurrence ?? "Não repete") as Recurrence;
  const next = nextOccurrence(d.startISO, recurrence);
  return {
    id: d.id, title: d.title, color: d.color as PersonColor, type: d.type, recurrence, reminder: d.reminder,
    startISO: d.startISO, endISO: d.endISO ?? undefined,
    dateLabel: occurrenceLabel(d.startISO, d.endISO ?? undefined, recurrence), daysAway: next.daysAway,
  };
}
function mapDateDoc(d: QueryDocumentSnapshot<DocumentData>): ImportantDate {
  return mapDate({ id: d.id, ...d.data() });
}

/* ---------------- onboarding ---------------- */
export async function findMySpaceId(): Promise<string | null> {
  const uid = currentUserId();
  if (!uid) return null;
  const snap = await getDoc(doc(fdb(), "users", uid));
  return snap.exists() ? (snap.data().spaceId as string) : null;
}

/** Ponteiro do usuário já incluindo o novo espaço (preserva os espaços anteriores). */
async function pointerWith(newId: string) {
  const { ids } = await getUserSpaces();
  return { spaceId: newId, activeSpaceId: newId, spaceIds: ids.includes(newId) ? ids : [...ids, newId] };
}

/** true se o usuário já é membro. permission-denied = não é membro (as regras negam a leitura). */
async function isAlreadyMember(spaceId: string, uid: string): Promise<boolean> {
  try {
    return (await getDoc(doc(fdb(), "spaces", spaceId, "members", uid))).exists();
  } catch (e: any) {
    if (e?.code === "permission-denied") return false;
    throw e;
  }
}

export async function createSpace(args: { spaceName: string; memberName: string; email: string; color: PersonColor }): Promise<string> {
  const uid = currentUserId();
  if (!uid) throw new Error("Não autenticado");
  const d = fdb();
  const spaceRef = doc(collection(d, "spaces"));
  let code = inviteCode();
  for (let i = 0; i < 8; i++) {
    const taken = await getDoc(doc(d, "invites", code));
    if (!taken.exists()) break;
    code = inviteCode();
  }
  const pointer = await pointerWith(spaceRef.id);

  // 1) núcleo: espaço + membro + ponteiro do usuário + convite.
  //    (nenhuma dessas escritas depende de isMember, então o batch passa)
  const core = writeBatch(d);
  core.set(spaceRef, { name: args.spaceName, inviteCode: code, createdAt: serverTimestamp() });
  core.set(doc(d, "spaces", spaceRef.id, "members", uid), {
    userId: uid, name: args.memberName, email: args.email, color: args.color, role: "admin", createdAt: serverTimestamp(),
  });
  core.set(doc(d, "users", uid), pointer, { merge: true });
  core.set(doc(d, "invites", code), { spaceId: spaceRef.id, spaceName: args.spaceName, adminName: args.memberName });
  await core.commit();

  // 2) conquistas: agora o membro já existe, então isMember(...) passa nas rules.
  //    (best-effort: se falhar, o app segue — a tela de conquistas só fica vazia)
  try {
    const ach: [string, string, string][] = [
      ["primeira_semana", "Primeira semana", "star"],
      ["cem_tarefas", "100 tarefas", "check"],
      ["um_mes", "1 mês juntos", "heart"],
      ["30_dias", "30 dias seguidos", "lock"],
      ["primeira_viagem", "Primeira viagem", "lock"],
      ["um_ano", "1 ano de app", "lock"],
    ];
    const b2 = writeBatch(d);
    for (const [key, title, icon] of ach) {
      b2.set(doc(d, "spaces", spaceRef.id, "achievements", key), { key, title, icon, unlocked: false, createdAt: serverTimestamp() });
    }
    await b2.commit();
  } catch (e) {
    console.warn("[createSpace] conquistas não semeadas:", e);
  }

  return spaceRef.id;
}

export async function previewSpaceByCode(code: string) {
  const snap = await getDoc(doc(fdb(), "invites", code.trim().toUpperCase()));
  if (!snap.exists()) return null;
  const v = snap.data();
  return { spaceName: v.spaceName as string, adminName: v.adminName as string };
}

export async function joinSpaceByCode(args: { code: string; memberName: string; email: string; color: PersonColor }): Promise<string> {
  const uid = currentUserId();
  if (!uid) throw new Error("Não autenticado");
  const d = fdb();
  const inv = await getDoc(doc(d, "invites", args.code.trim().toUpperCase()));
  if (!inv.exists()) throw new Error("Código inválido");
  const spaceId = inv.data().spaceId as string;
  const batch = writeBatch(d);
  // se já é membro (ex.: admin usando o próprio código), não sobrescreve o papel.
  if (!(await isAlreadyMember(spaceId, uid))) {
    batch.set(doc(d, "spaces", spaceId, "members", uid), {
      userId: uid, name: args.memberName, email: args.email, color: args.color, role: "member", createdAt: serverTimestamp(),
    });
  }
  batch.set(doc(d, "users", uid), await pointerWith(spaceId), { merge: true });
  await batch.commit();
  return spaceId;
}

/* ---------------- realtime (onSnapshot) ---------------- */
export type SyncError = { label: string; code: string; message: string; core: boolean };

export function subscribeSpace(
  spaceId: string,
  onSlice: (s: Slice) => void,
  onError?: (e: SyncError) => void,
): () => void {
  const d = fdb();
  const unsubs: Array<() => void> = [];
  const CORE = new Set(["space", "members", "lists", "items"]);
  const onErr = (label: string) => (e: any) => {
    console.error(`[realtime ${label}]`, e?.code ?? "", e?.message ?? e);
    onError?.({ label, code: e?.code ?? "", message: e?.message ?? String(e), core: CORE.has(label) });
  };

  unsubs.push(onSnapshot(doc(d, "spaces", spaceId), (snap) => {
    if (!snap.exists()) { onSlice({ space: undefined }); return; }
    const v = snap.data();
    const year = v.createdAt?.toDate ? v.createdAt.toDate().getFullYear() : new Date().getFullYear();
    onSlice({
      space: {
        id: snap.id, name: v.name, inviteCode: v.inviteCode, createdYear: year,
        streak: typeof v.streak === "number" ? v.streak : 0,
        streakDay: typeof v.streakDay === "string" ? v.streakDay : undefined,
      },
    });
  }, onErr("space")));

  // sem orderBy no servidor: o Firestore EXCLUI docs sem o campo ordenado (ex.: listas sem `position`).
  // Ordenamos no cliente. Também evita sumir docs com serverTimestamp pendente.
  unsubs.push(onSnapshot(collection(d, "spaces", spaceId, "members"),
    (snap) => onSlice({ people: snap.docs.map(mapMember) }), onErr("members")));

  unsubs.push(onSnapshot(collection(d, "spaces", spaceId, "lists"),
    (snap) => onSlice({
      lists: snap.docs.map(mapList).sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)),
      meta: { lists: { pending: snap.metadata.hasPendingWrites, cache: snap.metadata.fromCache } },
    }), onErr("lists")));

  unsubs.push(onSnapshot(collection(d, "spaces", spaceId, "listItems"),
    (snap) => onSlice({
      items: snap.docs.map(mapItem),
      meta: { items: { pending: snap.metadata.hasPendingWrites, cache: snap.metadata.fromCache } },
    }), onErr("items")));

  unsubs.push(onSnapshot(collection(d, "spaces", spaceId, "dates"),
    (snap) => onSlice({ dates: snap.docs.map(mapDateDoc).sort((a, b) => a.daysAway - b.daysAway) }), onErr("dates")));

  unsubs.push(onSnapshot(collection(d, "spaces", spaceId, "meds"),
    (snap) => onSlice({ meds: snap.docs.map((x) => ({ id: x.id, ...x.data() })) }), onErr("meds")));

  unsubs.push(onSnapshot(collection(d, "spaces", spaceId, "achievements"),
    (snap) => onSlice({ achievements: snap.docs.map((x) => ({ id: x.id, ...x.data() })) }), onErr("achievements")));

  unsubs.push(onSnapshot(query(collection(d, "spaces", spaceId, "activity"), orderBy("when", "desc"), limit(20)),
    (snap) => onSlice({ activity: snap.docs.map(mapActivity) }), onErr("activity")));

  return () => unsubs.forEach((u) => u());
}

/* ---------------- listas ---------------- */
/**
 * Escritas "add*": o id nasce no cliente e é devolvido na hora; `done` resolve quando o servidor
 * confirma (offline, fica pendente na fila local). Quem chama decide se espera (ver `settle` no store).
 */
export function dbAddList(spaceId: string, name: string, shared: boolean, ownerId: string | undefined, position: number) {
  const ref = doc(collection(fdb(), "spaces", spaceId, "lists"));
  const dotColor = DOT_PALETTE[position % DOT_PALETTE.length];
  const done = setDoc(ref, {
    name, shared, dotColor, ownerId: ownerId ?? null, position, createdAt: serverTimestamp(),
  });
  return { id: ref.id, dotColor, done };
}
export async function dbRenameList(spaceId: string, listId: string, name: string) {
  await updateDoc(doc(fdb(), "spaces", spaceId, "lists", listId), { name });
}
export async function dbDeleteList(spaceId: string, listId: string) {
  const d = fdb();
  const items = await getDocs(query(collection(d, "spaces", spaceId, "listItems"), where("listId", "==", listId)));
  // writeBatch aceita no máximo 500 operações: apaga os itens em lotes e a lista por último.
  // Os commits entram na fila de escrita em ordem (itens primeiro, lista por último).
  const refs = items.docs.map((it) => it.ref);
  const writes: Promise<void>[] = [];
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(d);
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    writes.push(b.commit());
  }
  writes.push(deleteDoc(doc(d, "spaces", spaceId, "lists", listId)));
  await Promise.all(writes);
}

/* ---------------- itens ---------------- */
export function dbAddItem(spaceId: string, listId: string, text: string, assignee: string | undefined, position: number, everyone = false) {
  const ref = doc(collection(fdb(), "spaces", spaceId, "listItems"));
  const done = setDoc(ref, {
    listId, text, done: false, assignee: everyone ? null : assignee ?? null, everyone, doneBy: [], position, createdAt: serverTimestamp(),
  });
  return { id: ref.id, done };
}
export async function dbToggleItem(spaceId: string, itemId: string, done: boolean) {
  await updateDoc(doc(fdb(), "spaces", spaceId, "listItems", itemId), { done });
}
export async function dbSetItemDoneBy(spaceId: string, itemId: string, doneBy: string[], done: boolean) {
  await updateDoc(doc(fdb(), "spaces", spaceId, "listItems", itemId), { doneBy, done });
}
export async function dbUpdateItem(spaceId: string, itemId: string, patch: { text?: string; assignee?: string | null; everyone?: boolean }) {
  const upd: any = {};
  if (patch.text !== undefined) upd.text = patch.text;
  if (patch.everyone !== undefined) {
    upd.everyone = patch.everyone;
    upd.assignee = patch.everyone ? null : patch.assignee ?? null;
    if (patch.everyone) upd.doneBy = [];
  } else if (patch.assignee !== undefined) {
    upd.assignee = patch.assignee;
  }
  await updateDoc(doc(fdb(), "spaces", spaceId, "listItems", itemId), upd);
}
export async function dbDeleteItem(spaceId: string, itemId: string) {
  await deleteDoc(doc(fdb(), "spaces", spaceId, "listItems", itemId));
}

/* ---------------- datas ---------------- */
type DatePayload = { title: string; startISO: string; endISO?: string; type: string; color: PersonColor; recurrence: string; reminder: string };
export function dbAddDate(spaceId: string, d0: DatePayload) {
  const ref = doc(collection(fdb(), "spaces", spaceId, "dates"));
  const done = setDoc(ref, {
    title: d0.title, startISO: d0.startISO, endISO: d0.endISO ?? null, type: d0.type,
    color: d0.color, recurrence: d0.recurrence, reminder: d0.reminder, createdAt: serverTimestamp(),
  });
  return { id: ref.id, done };
}
export async function dbUpdateDate(spaceId: string, id: string, d0: DatePayload) {
  await updateDoc(doc(fdb(), "spaces", spaceId, "dates", id), {
    title: d0.title, startISO: d0.startISO, endISO: d0.endISO ?? null, type: d0.type,
    color: d0.color, recurrence: d0.recurrence, reminder: d0.reminder,
  });
}
export async function dbDeleteDate(spaceId: string, id: string) {
  await deleteDoc(doc(fdb(), "spaces", spaceId, "dates", id));
}

/* ---------------- membros / espaço ---------------- */
export async function dbUpdateMember(spaceId: string, uid: string, patch: { name?: string; color?: PersonColor }) {
  await updateDoc(doc(fdb(), "spaces", spaceId, "members", uid), patch);
}
export async function dbSetStreak(spaceId: string, streak: number, streakDay: string) {
  await updateDoc(doc(fdb(), "spaces", spaceId), { streak, streakDay });
}
export async function dbUpdateSpaceName(spaceId: string, name: string) {
  await updateDoc(doc(fdb(), "spaces", spaceId), { name });
}

/* ---------------- meds ---------------- */
type MedDoc = {
  name: string; dose: string; assignee: string;
  freq: "interval" | "daily" | "weekly" | "custom";
  everyXHours?: number; startHour: string; durationHours?: number;
  times: string[]; notify: boolean; stock?: number;
  taken?: Record<string, string>;
  createdAt?: any;
};
export function dbAddMed(spaceId: string, m: Omit<MedDoc, "createdAt">) {
  const clean: Record<string, unknown> = { ...m };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]); // setDoc recusa `undefined`
  const ref = doc(collection(fdb(), "spaces", spaceId, "meds"));
  const done = setDoc(ref, { ...clean, taken: m.taken ?? {}, createdAt: serverTimestamp() });
  return { id: ref.id, done };
}
export async function dbUpdateMed(spaceId: string, id: string, patch: Partial<MedDoc>) {
  const clean: any = { ...patch };
  Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
  await updateDoc(doc(fdb(), "spaces", spaceId, "meds", id), clean);
}
export async function dbDeleteMed(spaceId: string, id: string) {
  await deleteDoc(doc(fdb(), "spaces", spaceId, "meds", id));
}
export async function dbMarkIntake(spaceId: string, id: string, key: string, taken: boolean) {
  const field = `taken.${key}`;
  await updateDoc(doc(fdb(), "spaces", spaceId, "meds", id),
    taken ? { [field]: new Date().toISOString() } : { [field]: null }
  );
}

/* ---------------- membros (admin) ---------------- */
export async function dbRemoveMember(spaceId: string, memberUid: string) {
  await deleteDoc(doc(fdb(), "spaces", spaceId, "members", memberUid));
}

/* ---------------- multi-espaço ---------------- */
/** Lê o ponteiro do usuário e devolve { active, ids[] } compatível com o schema antigo. */
export async function getUserSpaces(): Promise<{ active: string | null; ids: string[] }> {
  const uid = currentUserId(); if (!uid) return { active: null, ids: [] };
  const snap = await getDoc(doc(fdb(), "users", uid));
  if (!snap.exists()) return { active: null, ids: [] };
  const v = snap.data() as any;
  const ids: string[] = Array.isArray(v.spaceIds) ? v.spaceIds.slice() : [];
  if (v.spaceId && !ids.includes(v.spaceId)) ids.unshift(v.spaceId);
  const active: string | null = v.activeSpaceId ?? v.spaceId ?? ids[0] ?? null;
  return { active, ids };
}

/** Salva ponteiro multi-espaço (mantém spaceId legado em sincronia com o ativo). */
async function writeUserSpaces(active: string | null, ids: string[]) {
  const uid = currentUserId(); if (!uid) return;
  await setDoc(doc(fdb(), "users", uid), {
    spaceId: active ?? null,
    activeSpaceId: active ?? null,
    spaceIds: ids,
  }, { merge: true });
}

export async function dbSwitchSpace(spaceId: string) {
  const { ids } = await getUserSpaces();
  const nextIds = ids.includes(spaceId) ? ids : [...ids, spaceId];
  await writeUserSpaces(spaceId, nextIds);
}

/** Verifica se ainda sou membro de um espaço; se não, remove do meu ponteiro. */
export async function syncMembership(): Promise<{ active: string | null; ids: string[] }> {
  const uid = currentUserId(); if (!uid) return { active: null, ids: [] };
  const { active, ids } = await getUserSpaces();
  const checks = await Promise.all(ids.map(async (sid) => {
    // Só remove o espaço quando temos certeza de que NÃO somos membros (doc inexistente ou
    // permission-denied). Erro de rede propaga: o app mostra "tentar de novo" em vez de apagar o vínculo.
    try {
      const s = await getDoc(doc(fdb(), "spaces", sid, "members", uid));
      return s.exists() ? sid : null;
    } catch (e: any) {
      if (e?.code === "permission-denied") return null;
      throw e;
    }
  }));
  const valid = checks.filter((x): x is string => !!x);
  const nextActive = active && valid.includes(active) ? active : valid[0] ?? null;
  if (valid.length !== ids.length || nextActive !== active) {
    await writeUserSpaces(nextActive, valid);
  }
  return { active: nextActive, ids: valid };
}

/** Cria mais um espaço (já estando autenticado) e adiciona ao ponteiro. */
export async function createAdditionalSpace(args: { spaceName: string; memberName: string; email: string; color: PersonColor }): Promise<string> {
  const newId = await createSpace(args); // já chama writeBatch e seta users/{uid} { spaceId: newId }
  const { ids } = await getUserSpaces();
  const nextIds = ids.includes(newId) ? ids : [...ids, newId];
  await writeUserSpaces(newId, nextIds);
  return newId;
}

/** Sair do espaço atual (apaga seu doc de membro). */
export async function leaveSpace(spaceId: string): Promise<{ active: string | null; ids: string[] }> {
  const uid = currentUserId(); if (!uid) throw new Error("Não autenticado");
  await deleteDoc(doc(fdb(), "spaces", spaceId, "members", uid));
  const { active, ids } = await getUserSpaces();
  const nextIds = ids.filter((x) => x !== spaceId);
  const nextActive = active === spaceId ? (nextIds[0] ?? null) : active;
  await writeUserSpaces(nextActive, nextIds);
  return { active: nextActive, ids: nextIds };
}

/* ---------------- atividade + push ---------------- */
function mapActivity(d: QueryDocumentSnapshot<DocumentData>) {
  const a = d.data();
  const when = a.when?.toDate ? a.when.toDate().toISOString() : new Date().toISOString();
  return { id: d.id, who: (a.actorUid as string | undefined) ?? undefined, text: a.text as string, when, done: a.done ?? undefined };
}

// grava uma atividade (fonte das notificações de "atividade recente")
export async function dbLogActivity(spaceId: string, a: { text: string; type: string; done?: boolean }) {
  const uid = currentUserId();
  if (!uid || !db) return;
  try {
    const me = await getDoc(doc(db, "spaces", spaceId, "members", uid));
    const actorName = me.exists() ? (me.data().name as string) : "Alguém";
    await addDoc(collection(db, "spaces", spaceId, "activity"), {
      actorUid: uid, actorName, text: a.text, type: a.type, done: a.done ?? null,
      when: serverTimestamp(), notified: false,
    });
  } catch (e) {
    console.warn("[activity]", e);
  }
}

// salva/remove a inscrição de push deste usuário (1 por usuário)
export async function dbSavePushSub(spaceId: string, sub: PushSubscriptionJSON) {
  const uid = currentUserId();
  if (!uid) throw new Error("Não autenticado");
  await setDoc(doc(fdb(), "spaces", spaceId, "pushSubs", uid), {
    uid, subscription: sub, ua: typeof navigator !== "undefined" ? navigator.userAgent : "", updatedAt: serverTimestamp(),
  });
}
export async function dbDeletePushSub(spaceId: string) {
  const uid = currentUserId();
  if (!uid) return;
  await deleteDoc(doc(fdb(), "spaces", spaceId, "pushSubs", uid)).catch(() => {});
}

export async function dbSetNotifyPrefs(spaceId: string, prefs: { med?: boolean; dates?: boolean; partner?: boolean; daily?: boolean }) {
  const uid = currentUserId();
  if (!uid) return;
  await updateDoc(doc(fdb(), "spaces", spaceId, "members", uid), { notifyPrefs: prefs });
}
