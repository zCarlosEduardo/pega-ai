// Pega Aí — service worker
// Regras de ouro:
//  - NUNCA intercepta/coloca em cache requisições cross-origin (Firebase/Firestore/Auth e qualquer API externa).
//  - App (HTML/rotas) = network-first (deploy novo aparece sem hard refresh).
//  - Estáticos com hash (/assets, ícones) = cache-first (são imutáveis).
const CACHE = "pega-ai-v5";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("message", (e) => {
  if (e.data === "skip" || e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ---- Push (Web Push / iOS 16.4+ instalado na tela inicial) ----
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data && e.data.text ? e.data.text() : "" }; }
  const title = data.title || "Pega Aí";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,        // agrupa/atualiza notificações do mesmo tipo
    data: { url: data.url || "/" },
    vibrate: [60, 30, 60],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { return c.focus().then((w) => (w && "navigate" in w ? w.navigate(url).catch(() => w) : w)); }
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isImmutableStatic(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  // 1) Cross-origin (Firebase e qualquer outra API): não intercepta. Sempre rede.
  if (url.origin !== self.location.origin) return;

  // 2) Estáticos imutáveis: cache-first.
  if (isImmutableStatic(url)) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // 3) Resto do app (navegação, HTML): network-first com fallback offline.
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match("/"))),
  );
});
