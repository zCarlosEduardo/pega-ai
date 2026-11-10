import { dbDeletePushSub, dbSavePushSub } from "@/lib/db";

const VAPID_PUBLIC = (import.meta.env as Record<string, string | undefined>).VITE_VAPID_PUBLIC_KEY;

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// no iOS, push SÓ funciona se o app foi instalado na tela inicial (standalone)
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || (navigator as any).standalone === true;
}

// motivo pelo qual não dá pra ativar (pra UI orientar o usuário)
export function pushBlockedReason(): string | null {
  if (!pushSupported()) return "Este aparelho/navegador não suporta notificações web.";
  if (isIOS() && !isStandalone()) return "No iPhone, adicione o app à Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá para ativar.";
  if (!VAPID_PUBLIC) return "Falta configurar a chave VAPID (VITE_VAPID_PUBLIC_KEY).";
  return null;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Registra o service worker se ainda não houver (em dev ele não é registrado) e espera ficar ativo. */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error("O serviço de notificações não iniciou. Feche e abra o app e tente de novo.")), 8000));
  await Promise.race([ready, timeout]);
  return reg;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

export type PushState = { supported: boolean; permission: NotificationPermission | "unsupported"; subscribed: boolean; reason: string | null };

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return { supported: false, permission: "unsupported", subscribed: false, reason: pushBlockedReason() };
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    subscribed = !!(await reg?.pushManager.getSubscription());
  } catch { /* ignore */ }
  return { supported: true, permission: Notification.permission, subscribed, reason: pushBlockedReason() };
}

export async function enablePush(spaceId: string): Promise<{ ok: boolean; error?: string }> {
  const reason = pushBlockedReason();
  if (reason) return { ok: false, error: reason };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, error: "Permissão de notificações negada." };
    const reg = await getRegistration();
    const key = urlBase64ToUint8Array(VAPID_PUBLIC!);
    let sub = await reg.pushManager.getSubscription();
    // inscrição feita com OUTRA chave VAPID nunca recebe push do servidor atual: refaz
    if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
    await dbSavePushSub(spaceId, sub.toJSON());
    try { localStorage.setItem(`pega_push_ep_${spaceId}`, sub.endpoint); } catch { /* ignore */ }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Falha ao ativar notificações." };
  }
}

/**
 * Chamado ao abrir o app: se o aparelho já tem permissão e inscrição, garante que o servidor
 * conhece a inscrição ATUAL deste espaço (o navegador pode trocá-la, e quem mudou de espaço
 * ficaria sem receber). Só grava quando o endereço mudou.
 */
export async function syncPushSub(spaceId: string): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== "granted" || !VAPID_PUBLIC) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const k = `pega_push_ep_${spaceId}`;
    if (localStorage.getItem(k) === sub.endpoint) return;
    await dbSavePushSub(spaceId, sub.toJSON());
    localStorage.setItem(k, sub.endpoint);
  } catch { /* melhor esforço */ }
}

/** Mostra uma notificação local: prova que a permissão e o service worker funcionam neste aparelho. */
export async function showLocalTest(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return { ok: false, error: "Ative as notificações primeiro." };
    const reg = await getRegistration();
    await reg.showNotification("Pega Aí", {
      body: "Teste: as notificações estão funcionando neste aparelho.",
      icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "local-test",
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Não foi possível mostrar a notificação." };
  }
}

export async function disablePush(spaceId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch { /* ignore */ }
  await dbDeletePushSub(spaceId);
  try { localStorage.removeItem(`pega_push_ep_${spaceId}`); } catch { /* ignore */ }
}
