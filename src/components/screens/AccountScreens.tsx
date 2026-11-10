"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Check, Copy, Pencil, Trash2, LogOut, Bell, BellOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/nav";
import { StatusBar } from "@/components/ui/Surface";
import { Avatar, Toggle } from "@/components/ui/Inputs";
import { Badge } from "@/components/ui/PegaBadge";
import { Input } from "@/components/ui/PegaInput";
import { Button } from "@/components/ui/PegaButton";
import { cn, PERSON_HEX, PersonColor } from "@/lib/cn";
import { enablePush, disablePush, getPushState, showLocalTest, type PushState } from "@/lib/push";
import { dbSetNotifyPrefs } from "@/lib/db";

const COLORS: PersonColor[] = ["p1", "p2", "p3", "p4"];

/* ---------- Perfil (21) ---------- */
export function ProfileScreen() {
  const s = useStore();
  const { close, open } = useNav();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.me.name);

  function saveName() {
    if (name.trim()) s.setMyName(name.trim());
    setEditing(false);
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg anim-screen">
      <StatusBar />
      <div className="px-4 py-2">
        <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-surface" aria-label="Voltar">
          <ChevronLeft size={22} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="flex flex-col items-center pt-2">
          <Avatar name={s.me.name} color={s.me.color} size={84} />
          {editing ? (
            <div className="mt-3 w-full max-w-[260px]">
              <Input value={name} onChange={setName} autoFocus />
              <div className="mt-2 flex gap-2">
                <Button full onClick={saveName}>Salvar</Button>
                <Button full variant="secondary" onClick={() => { setName(s.me.name); setEditing(false); }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="mt-3 flex items-center gap-2">
                <h1 className="text-[22px] font-semibold">{s.me.name}</h1>
                <Pencil size={15} className="text-text-3" />
              </button>
              <p className="text-[13px] text-text-2">{s.me.email}</p>
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat n={s.stats.sequencia} label="Sequência (dias)" />
          <Stat n={s.stats.tarefas} label="Tarefas" />
          <Stat n={s.stats.conquistas} label="Conquistas" onClick={() => open({ kind: "achievements" })} />
        </div>

        <p className="mb-2 mt-6 text-[12px] font-medium text-text-3">Sua cor no espaço</p>
        <div className="flex gap-3">
          {COLORS.map((c) => (
            <button key={c} onClick={() => s.setMyColor(c)} className="h-9 w-9 rounded-md transition-transform active:scale-95"
              style={{ background: PERSON_HEX[c], boxShadow: s.me.color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${PERSON_HEX[c]}` : undefined }} />
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-border bg-surface">
          <NavRow label="Editar nome" onClick={() => setEditing(true)} />
          <NavRow label="Configurações do espaço" onClick={() => open({ kind: "settings" })} />
          <NavRow label="Sair da conta" danger last onClick={() => s.signOutFlow()} />
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label, onClick }: { n: number; label: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn("rounded-md border border-border bg-surface py-4 text-center", onClick && "cursor-pointer")}>
      <p className="font-mono text-[22px] font-semibold">{n}</p>
      <p className="mt-0.5 text-[12px] text-text-3">{label}</p>
    </div>
  );
}

function NavRow({ label, danger, last, onClick }: { label: string; danger?: boolean; last?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-surface-hi/50", !last && "border-b border-border")}>
      <span className={cn("text-[15px]", danger ? "text-error" : "text-text")}>{label}</span>
      <ChevronRight size={17} className={danger ? "text-error" : "text-text-3"} />
    </button>
  );
}

/* ---------- Configurações do espaço (22) ---------- */
export function SettingsScreen() {
  const s = useStore();
  const { close, open } = useNav();
  const [editingSpace, setEditingSpace] = useState(false);
  const [spaceName, setSpaceName] = useState(s.space.name);
  const [copied, setCopied] = useState(false);
  const [notif, setNotif] = useState({
    med: s.me.notifyPrefs?.med ?? true,
    dates: s.me.notifyPrefs?.dates ?? true,
    partner: s.me.notifyPrefs?.partner ?? true,
    daily: s.me.notifyPrefs?.daily ?? false,
  });
  function changeNotif(patch: Partial<typeof notif>) {
    // efeito colateral fora do updater (o React pode chamar o updater duas vezes)
    const next = { ...notif, ...patch };
    setNotif(next);
    dbSetNotifyPrefs(s.space.id, next).catch(() => s.notify("Não foi possível salvar a preferência de notificação."));
  }

  const isAdmin = s.me.role === "admin";

  function saveSpace() {
    if (spaceName.trim()) s.setSpaceName(spaceName.trim());
    setEditingSpace(false);
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(s.space.inviteCode); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg anim-screen">
      <StatusBar />
      <div className="flex items-center gap-1 px-4 py-2">
        <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-surface" aria-label="Voltar">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-[20px] font-semibold">Configurações</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {/* espaço */}
        <div className="mt-2 rounded-md border border-border bg-surface px-4 py-3.5">
          {editingSpace ? (
            <div className="flex items-center gap-2">
              <Input value={spaceName} onChange={setSpaceName} autoFocus />
              <button onClick={saveSpace} className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-[#0a0a0e]"><Check size={18} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex -space-x-2">
                {s.people.map((p) => (
                  <span key={p.id} className="ring-2 ring-surface rounded-full"><Avatar name={p.name} color={p.color} size={32} /></span>
                ))}
              </span>
              <div className="flex-1">
                <p className="text-[15px] font-semibold">{s.space.name}</p>
                <p className="text-[12px] text-text-3">Espaço criado em {s.space.createdYear}</p>
              </div>
              {isAdmin && <button onClick={() => { setSpaceName(s.space.name); setEditingSpace(true); }} className="text-[13px] text-accent">editar</button>}
            </div>
          )}
        </div>

        {/* convite */}
        <p className="mb-2 mt-6 text-[12px] font-medium text-text-3">Convite</p>
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3.5">
          <div className="flex-1">
            <p className="text-[12px] font-medium text-text-3">Código do espaço</p>
            <p className="mt-1 font-mono text-[18px] font-semibold tracking-[0.1em]">{s.space.inviteCode || "—"}</p>
          </div>
          <button onClick={copyCode} className="grid h-10 w-10 place-items-center rounded-md border border-border text-text-2">
            {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
          </button>
        </div>

        {/* diagnóstico de sincronização (para comparar dois aparelhos no mesmo espaço) */}
        <details className="mt-3 rounded-md border border-border bg-surface px-4 py-3 text-[13px]">
          <summary className="cursor-pointer font-medium text-text-2">Diagnóstico de sincronização</summary>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-text-2">
            <dt>Espaço</dt><dd className="break-all font-mono text-[12px] text-text">{s.diag.spaceId ?? "—"}</dd>
            <dt>Projeto</dt><dd className="break-all font-mono text-[12px] text-text">{s.diag.projectId || "—"}</dd>
            <dt>Sua conta</dt><dd className="break-all font-mono text-[12px] text-text">{s.diag.uid ?? "—"}</dd>
            <dt>Listas</dt><dd className="text-text">{s.diag.listas} no servidor{s.diag.listasOcultas > 0 ? `, ${s.diag.listasOcultas} privada(s) de outra pessoa` : ""}</dd>
            <dt>Itens</dt><dd className="text-text">{s.diag.itens}{s.diag.itensSemLista > 0 ? ` (${s.diag.itensSemLista} sem lista)` : ""}</dd>
            <dt>Envio</dt><dd className={s.diag.pendente ? "text-warning" : "text-success"}>{s.diag.pendente ? "há alterações não enviadas" : "tudo enviado"}</dd>
            <dt>Dados</dt><dd className="text-text">{s.diag.doCache ? "do cache local (sem confirmar com o servidor)" : "confirmados pelo servidor"}</dd>
          </dl>
        </details>

        <button
          onClick={() => open({ kind: "profile" })}
          className="mt-3 flex w-full items-center gap-3 rounded-md border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-hi/50"
        >
          <Avatar name={s.me.name} color={s.me.color} size={36} />
          <div className="flex-1">
            <p className="text-[14px] font-semibold">Meu perfil</p>
            <p className="text-[12px] text-text-3">Nome, cor e conta</p>
          </div>
          <ChevronRight size={17} className="text-text-3" />
        </button>

        {/* pessoas */}
        <p className="mb-2 mt-6 text-[12px] font-medium text-text-3">Pessoas com acesso</p>
        <div className="space-y-2">
          {s.people.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
              <Avatar name={p.name} color={p.color} size={36} />
              <div className="flex-1">
                <p className="text-[14px] font-semibold">{p.name} {p.isMe && <span className="font-normal text-text-3">· você</span>}</p>
                <p className="text-[12px] text-text-3">{p.email}</p>
              </div>
              <Badge tone={p.role === "admin" ? "accent" : "neutral"}>{p.role === "admin" ? "Admin" : "Membro"}</Badge>
              {isAdmin && !p.isMe && (
                <button
                  onClick={async () => {
                    if (!confirm(`Remover ${p.name} do espaço?`)) return;
                    const { error } = await s.removeMember(p.id);
                    if (error) alert(error);
                  }}
                  className="ml-1 grid h-8 w-8 place-items-center rounded-md text-error hover:bg-surface-hi"
                  aria-label="Remover pessoa"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {s.people.length < 2 && (
            <button onClick={copyCode} className="flex w-full items-center gap-2 rounded-md border border-dashed border-border bg-surface px-4 py-3 text-[14px] text-text-2">
              <Plus size={16} /> Convidar par — copiar código
            </button>
          )}
        </div>

        {/* meus espaços */}
        <SpaceManager />


        {/* notificações */}
        <p className="mb-2 mt-6 text-[12px] font-medium text-text-3">Notificações</p>
        <PushControl spaceId={s.space.id} />
        <div className="mt-2 space-y-2">
          <NotifRow label="Lembretes de remédio" checked={notif.med} onChange={(v) => changeNotif({ med: v })} />
          <NotifRow label="Datas importantes" checked={notif.dates} onChange={(v) => changeNotif({ dates: v })} />
          <NotifRow label="Atividade do parceiro" checked={notif.partner} onChange={(v) => changeNotif({ partner: v })} />
          <NotifRow label="Resumo diário" checked={notif.daily} onChange={(v) => changeNotif({ daily: v })} />
        </div>

        <p className="mb-2 mt-6 text-[12px] font-medium text-text-3">Preferências</p>
        <button className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-4 py-3.5">
          <span className="text-[15px]">Tema</span>
          <span className="flex items-center gap-1 text-[13px] text-text-2">Escuro <ChevronRight size={15} /></span>
        </button>
      </div>
    </div>
  );
}

function PushControl({ spaceId }: { spaceId: string }) {
  const [st, setSt] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { getPushState().then(setSt); }, []);

  async function toggle() {
    if (!st || busy) return;
    setBusy(true); setMsg(null);
    if (st.subscribed) { await disablePush(spaceId); }
    else {
      const r = await enablePush(spaceId);
      setMsg(r.ok ? { text: "Notificações ativadas neste aparelho.", ok: true } : { text: r.error ?? "Não foi possível ativar.", ok: false });
    }
    setSt(await getPushState());
    setBusy(false);
  }

  async function test() {
    setMsg(null);
    const r = await showLocalTest();
    setMsg(r.ok ? { text: "Se a notificação apareceu, este aparelho está pronto.", ok: true } : { text: r.error ?? "Falhou.", ok: false });
  }

  if (!st) return null;
  const on = st.subscribed && st.permission === "granted";

  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[15px]">
          {on ? <Bell size={16} className="text-accent" /> : <BellOff size={16} className="text-text-3" />}
          Notificações neste aparelho
        </span>
        <button
          onClick={toggle}
          disabled={busy || (!on && !!st.reason)}
          className={cn(
            "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
            on ? "border border-border bg-surface-hi text-text-2" : "bg-accent text-[#0a0a0e]",
            busy || (!on && !!st.reason) ? "opacity-50" : "",
          )}
        >
          {busy ? "…" : on ? "Ativado" : "Ativar"}
        </button>
      </div>
      {!on && st.reason && <p className="mt-2 text-[12px] text-text-3">{st.reason}</p>}
      {on && <p className="mt-2 text-[12px] text-text-3">Você receberá lembretes mesmo com o app fechado.</p>}
      {on && (
        <button onClick={test} className="mt-2 text-[13px] font-medium text-accent-soft underline underline-offset-2">
          Enviar notificação de teste
        </button>
      )}
      {msg && <p role="status" className={cn("mt-2 text-[12px]", msg.ok ? "text-success" : "text-error")}>{msg.text}</p>}
    </div>
  );
}

function NotifRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3.5">
      <span className="text-[15px]">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* ---------- Gerenciar espaços ---------- */
function SpaceManager() {
  const s = useStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<PersonColor>(s.me.color);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createSpace() {
    if (!name.trim()) { setErr("Dê um nome ao novo espaço."); return; }
    setBusy(true); setErr(null);
    const { error } = await s.createAnotherSpace({ spaceName: name.trim(), memberName: s.me.name || "Eu", color });
    setBusy(false);
    if (error) { setErr(error); return; }
    setAdding(false); setName("");
  }

  async function leave() {
    if (!confirm(`Sair do espaço "${s.space.name}"?`)) return;
    const { error } = await s.leaveCurrentSpace();
    if (error) alert(error);
  }

  return (
    <>
      <p className="mb-2 mt-6 text-[12px] font-medium text-text-3">Meus espaços</p>
      <div className="space-y-2">
        {s.spaceIds.map((sid) => {
          const active = sid === s.space.id;
          const label = active ? s.space.name || "Espaço atual" : `Espaço ${sid.slice(0, 6)}`;
          return (
            <button
              key={sid}
              onClick={() => !active && s.switchSpace(sid)}
              className={cn(
                "flex w-full items-center justify-between rounded-md border px-4 py-3 text-left",
                active ? "border-accent bg-accent/10" : "border-border bg-surface hover:bg-surface-hi"
              )}
            >
              <span className="text-[14px] font-medium">{label}</span>
              <span className={cn("text-[12px]", active ? "text-accent" : "text-text-3")}>
                {active ? "Ativo" : "Trocar"}
              </span>
            </button>
          );
        })}
        {!adding ? (
          <button
            onClick={() => { setAdding(true); setName(""); setErr(null); }}
            className="flex w-full items-center gap-2 rounded-md border border-dashed border-border bg-surface px-4 py-3 text-[14px] text-text-2"
          >
            <Plus size={16} /> Criar novo espaço
          </button>
        ) : (
          <div className="rounded-md border border-border bg-surface p-3">
            <Input value={name} onChange={setName} placeholder="Nome do novo espaço" autoFocus />
            <div className="mt-3 flex gap-2">
              {(["p1","p2","p3","p4"] as PersonColor[]).map((c) => (
                <button key={c} onClick={() => setColor(c)} className="h-8 w-8 rounded-md transition-transform active:scale-95"
                  style={{ background: PERSON_HEX[c], boxShadow: color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${PERSON_HEX[c]}` : undefined }} />
              ))}
            </div>
            {err && <p className="mt-2 text-[12px] text-error">{err}</p>}
            <div className="mt-3 flex gap-2">
              <Button full onClick={createSpace} disabled={busy}>{busy ? "Criando…" : "Criar"}</Button>
              <Button full variant="secondary" onClick={() => setAdding(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={leave}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-[14px] text-error hover:bg-surface-hi"
      >
        <LogOut size={15} /> Sair deste espaço
      </button>
    </>
  );
}
