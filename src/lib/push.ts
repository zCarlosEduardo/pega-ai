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

export type PushState = { supported: boolean; permission: NotificationPermission | "unsupported"; subscribed: boolean; reason: string | null };

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return { supported: false, permission: "unsupported", subscribed: false, reason: pushBlockedReason() };
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    subscribed = !!(await reg.pushManager.getSubscription());
  } catch { /* ignore */ }
  return { supported: true, permission: Notification.permission, subscribed, reason: pushBlockedReason() };
}

export async function enablePush(spaceId: string): Promise<{ ok: boolean; error?: string }> {
  const reason = pushBlockedReason();
  if (reason) return { ok: false, error: reason };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, error: "Permissão de notificações negada." };
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!),
      });
    }
    await dbSavePushSub(spaceId, sub.toJSON());
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Falha ao ativar notificações." };
  }
}

export async function disablePush(spaceId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch { /* ignore */ }
  await dbDeletePushSub(spaceId);
}
