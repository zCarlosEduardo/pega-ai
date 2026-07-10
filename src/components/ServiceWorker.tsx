"use client";
import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

    let refreshing = false;
    // Quando um SW novo assume o controle, recarrega 1x pra pegar o código novo.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // procura updates ao abrir e quando volta o foco
        reg.update().catch(() => {});
        const onFocus = () => reg.update().catch(() => {});
        window.addEventListener("focus", onFocus);
        // se já tiver um SW esperando, ativa
        if (reg.waiting) reg.waiting.postMessage("skip");
      })
      .catch(() => {});
  }, []);
  return null;
}
