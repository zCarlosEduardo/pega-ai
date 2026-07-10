"use client";
import { useEffect } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { NavProvider, useNav } from "@/lib/nav";
import { PhoneFrame } from "@/components/PhoneFrame";
import { SpaceLogo } from "@/components/ui/Surface";
import { AuthFlow } from "@/components/screens/AuthFlow";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { ListsScreen } from "@/components/screens/ListsScreen";
import { HealthScreen } from "@/components/screens/HealthScreen";
import { AgendaScreen } from "@/components/screens/AgendaScreen";
import { ListDetail } from "@/components/screens/ListDetail";
import { NewList } from "@/components/screens/NewList";
import { MedDetail, NewMed } from "@/components/screens/MedScreens";
import { DateDetail, NewDate } from "@/components/screens/DateScreens";
import { AchievementsScreen, SearchScreen } from "@/components/screens/ExtraScreens";
import { ProfileScreen, SettingsScreen } from "@/components/screens/AccountScreens";
import { ServiceWorker } from "@/components/ServiceWorker";

export default function App() {
  return (
    <StoreProvider>
      <NavProvider>
        <ServiceWorker />
        <Root />
      </NavProvider>
    </StoreProvider>
  );
}

function Root() {
  const s = useStore();

  if (!s.configured) return <ConfigNotice />;
  if (!s.ready) return <Splash />;

  if (s.onboarding || !s.authed || !s.hasSpace) {
    return (
      <PhoneFrame showTabBar={false}>
        <AuthFlow />
      </PhoneFrame>
    );
  }
  return <Shell />;
}

function Splash() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3 anim-fade">
        <SpaceLogo size={72} />
        <span className="font-mono text-[12px] tracking-[0.2em] text-text-3">PEGA AÍ</span>
      </div>
    </div>
  );
}

function ConfigNotice() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg px-6">
      <div className="max-w-[360px] text-center">
        <SpaceLogo size={64} />
        <h1 className="mt-4 text-[20px] font-semibold">Configure o Firebase</h1>
        <p className="mt-2 text-[14px] text-text-2">
          Defina as variáveis <span className="font-mono text-text">VITE_FIREBASE_*</span> em{" "}
          <span className="font-mono text-text">.env.local</span> (e publique as regras de{" "}
          <span className="font-mono text-text">firebase/firestore.rules</span>) para iniciar o app.
        </p>
      </div>
    </div>
  );
}

function Shell() {
  const { tab, open } = useNav();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open({ kind: "search" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const screen =
    tab === "inicio" ? <HomeScreen /> :
    tab === "listas" ? <ListsScreen /> :
    tab === "saude" ? <HealthScreen /> :
    <AgendaScreen />;

  return <PhoneFrame overlay={<Overlay />}>{screen}</PhoneFrame>;
}

function Overlay() {
  const { overlay } = useNav();
  if (!overlay) return null;
  switch (overlay.kind) {
    case "list": return <ListDetail id={overlay.id} />;
    case "new-list": return <NewList shared={overlay.shared} />;
    case "med": return <MedDetail id={overlay.id} />;
    case "date": return <DateDetail id={overlay.id} />;
    case "new-med": return <NewMed editId={overlay.editId} />;
    case "new-date": return <NewDate id={overlay.id} />;
    case "search": return <SearchScreen />;
    case "achievements": return <AchievementsScreen />;
    case "profile": return <ProfileScreen />;
    case "settings": return <SettingsScreen />;
    default: return null;
  }
}
