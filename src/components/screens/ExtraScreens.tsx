"use client";
import { useState } from "react";
import { Star, Check, Heart, Lock, Search as SearchIcon, Plus, ListTodo, CalendarHeart, CornerDownLeft } from "lucide-react";
import { useStore, Achievement } from "@/lib/store";
import { useNav } from "@/lib/nav";
import { StatusBar } from "@/components/ui/Surface";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { cn } from "@/lib/cn";

const ICON = { star: Star, check: Check, heart: Heart, lock: Lock };
const ICON_TONE: Record<string, string> = {
  star: "text-accent bg-accent/12",
  check: "text-success bg-success/12",
  heart: "text-p4 bg-p4/12",
};

export function AchievementsScreen() {
  const s = useStore();
  const { close } = useNav();
  const unlocked = s.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg anim-screen">
      <StatusBar />
      <div className="px-4 py-2">
        <button onClick={close} className="text-[14px] text-text-2 hover:text-text">‹ Voltar</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <h1 className="text-[28px] font-semibold">Conquistas</h1>
        <p className="mt-1 text-[13px] text-text-2">{unlocked} de {s.achievements.length} desbloqueadas juntos</p>

        <div className="mt-5 flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
          <ProgressRing value={s.achievements.length ? (unlocked / s.achievements.length) * 100 : 0} size={64} stroke={5}>
            <div className="text-center leading-none">
              <span className="font-mono text-[18px] font-semibold">{unlocked}</span>
              <span className="block font-mono text-[9px] text-text-3">de {s.achievements.length}</span>
            </div>
          </ProgressRing>
          <div>
            <p className="text-[15px] font-semibold">Progresso de conquistas</p>
            <p className="mt-0.5 text-[13px] text-text-2">
              Vocês desbloqueiam novas conquistas usando o app juntos.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {s.achievements.map((a) => (
            <Medal key={a.id} a={a} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Medal({ a }: { a: Achievement }) {
  const Icon = ICON[a.icon];
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border bg-surface px-2 py-5 text-center",
        a.unlocked ? "border-border" : "border-border/60 opacity-50",
      )}
    >
      <span className={cn("grid h-12 w-12 place-items-center rounded-full", a.unlocked ? ICON_TONE[a.icon] : "bg-surface-hi text-text-3")}>
        <Icon size={20} />
      </span>
      <span className="text-[12px] font-medium leading-tight">{a.title}</span>
    </div>
  );
}

/* ---------- Busca (20) ---------- */

export function SearchScreen() {
  const s = useStore();
  const { close, open } = useNav();
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const dates = query ? s.dates.filter((d) => d.title.toLowerCase().includes(query)) : [];
  const lists = query ? s.lists.filter((l) => l.name.toLowerCase().includes(query)) : [];

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-bg anim-fade">
      <StatusBar />
      <div className="px-5 pt-2">
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 h-12">
          <SearchIcon size={18} className="text-text-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-3"
            placeholder="Buscar datas, listas, remédios…"
          />
          <button onClick={close} className="rounded border border-border px-2 py-0.5 font-mono text-[11px] text-text-3">
            esc
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {dates.length > 0 && (
          <>
            <SectionLabel>Datas</SectionLabel>
            {dates.map((d, i) => (
              <Result
                key={d.id}
                active={i === 0}
                icon={<Heart size={16} className="text-p4" />}
                title={highlight(d.title, q)}
                sub={d.dateLabel}
                onClick={() => open({ kind: "date", id: d.id })}
              />
            ))}
          </>
        )}
        {lists.length > 0 && (
          <>
            <SectionLabel>Listas</SectionLabel>
            {lists.map((l) => (
              <Result
                key={l.id}
                icon={<ListTodo size={16} className="text-accent" />}
                title={highlight(l.name, q)}
                sub={`${l.items.filter((i) => i.done).length}/${l.items.length} · ${l.shared ? "compartilhada" : "minha"}`}
                onClick={() => open({ kind: "list", id: l.id })}
              />
            ))}
          </>
        )}
        {query && dates.length === 0 && lists.length === 0 && (
          <p className="px-3 py-6 text-center text-[13px] text-text-3">Nada encontrado para “{q}”.</p>
        )}
        <SectionLabel>Ações</SectionLabel>
        <Result icon={<Plus size={16} className="text-text-2" />} title="Criar nova data" hint onClick={() => open({ kind: "new-date" })} />
        <Result icon={<ListTodo size={16} className="text-text-2" />} title="Nova lista" onClick={() => open({ kind: "new-list", shared: true })} />
      </div>
    </div>
  );
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      <span className="text-accent">{text.slice(0, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-text-3">
      {children}
    </p>
  );
}

function Result({
  icon,
  title,
  sub,
  active,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  sub?: string;
  active?: boolean;
  hint?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
        active ? "bg-surface" : "hover:bg-surface",
      )}
    >
      <span className="grid h-8 w-8 place-items-center rounded-md bg-surface-hi">{icon}</span>
      <div className="flex-1">
        <p className="text-[14px] font-medium">{title}</p>
        {sub && <p className="text-[12px] text-text-3">{sub}</p>}
      </div>
      {hint && (
        <span className="grid h-6 w-6 place-items-center rounded border border-border text-text-3">
          <CornerDownLeft size={13} />
        </span>
      )}
    </button>
  );
}
