"use client";
import { useState } from "react";
import { Plus, LogIn, ChevronRight, ChevronLeft, Check, Copy, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { SpaceLogo } from "@/components/ui/Surface";
import { Input, Label } from "@/components/ui/PegaInput";
import { Button } from "@/components/ui/PegaButton";
import { Avatar } from "@/components/ui/Inputs";
import { cn, PERSON_HEX, PersonColor } from "@/lib/cn";
import { DateType } from "@/lib/types";

type Step = "login" | "choose" | "join" | "invite" | "dates" | "color" | "done";
const FLOW: Step[] = ["choose", "invite", "dates", "color", "done"];

function nameFromEmail(email: string) {
  const p = (email.split("@")[0] || "Você").replace(/[._-]/g, " ").trim();
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : "Você";
}

export function AuthFlow() {
  const s = useStore();
  const [step, setStep] = useState<Step>(() => (s.authed && !s.hasSpace ? "choose" : "login"));

  if (step === "login")
    return (
      <Login
        onSignedInWithSpace={() => {}}
        onNeedSpace={() => setStep("choose")}
        onCreate={() => setStep("invite")}
        onJoin={() => setStep("join")}
      />
    );

  const idx = FLOW.indexOf(step === "join" ? "choose" : step);
  const PREV: Partial<Record<Step, Step>> = { dates: "invite", color: "dates" };
  const onBack =
    step === "join" || step === "choose"
      ? () => setStep("login")
      : PREV[step]
      ? () => setStep(PREV[step]!)
      : undefined;
  return (
    <div className="flex h-full flex-col">
      <Progress current={idx} total={FLOW.length} onBack={onBack} />
      {step === "choose" && <Choose onCreate={() => setStep("invite")} onJoin={() => setStep("join")} />}
      {step === "join" && <Join />}
      {step === "invite" && <Invite onContinue={() => setStep("dates")} />}
      {step === "dates" && <Dates onContinue={() => setStep("color")} />}
      {step === "color" && <ColorStep onContinue={() => setStep("done")} />}
      {step === "done" && <Done />}
    </div>
  );
}

function Progress({ current, total, onBack }: { current: number; total: number; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-5 pt-1">
      {onBack && (
        <button onClick={onBack} className="grid h-8 w-8 place-items-center rounded-full text-text-2" aria-label="Voltar">
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= current ? "bg-accent" : "bg-surface-hi")} />
        ))}
      </div>
    </div>
  );
}

function ErrorMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-3 rounded-md bg-error/10 px-3 py-2 text-[13px] text-error">{msg}</p>;
}

/* 01 — Login */
function Login({
  onNeedSpace,
  onCreate,
  onJoin,
}: {
  onSignedInWithSpace: () => void;
  onNeedSpace: () => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const s = useStore();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState<"" | "in" | "create" | "join">("");
  const [err, setErr] = useState<string>();
  const disabled = !email.trim() || pass.length < 6 || busy !== "";

  async function entrar() {
    setErr(undefined); setBusy("in");
    const { error, hasSpace } = await s.signIn(email.trim(), pass);
    if (error) { setErr(error); setBusy(""); return; }
    if (!hasSpace) onNeedSpace(); // App mantém AuthFlow montado
  }

  async function criar() {
    setErr(undefined); setBusy("create");
    const { error } = await s.register(email.trim(), pass);
    if (error) { setErr(error); setBusy(""); return; }
    s.beginOnboarding();
    const { error: e2 } = await s.createSpaceFlow({ memberName: nameFromEmail(email), color: "p1" });
    if (e2) { setErr(e2); setBusy(""); s.finishOnboarding(); return; }
    onCreate();
  }

  async function comCodigo() {
    setErr(undefined); setBusy("join");
    const { error } = await s.register(email.trim(), pass);
    if (error) { setErr(error); setBusy(""); return; }
    s.beginOnboarding();
    onJoin();
  }

  return (
    <div className="flex flex-1 flex-col px-6 anim-screen">
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex flex-col items-center">
          <SpaceLogo size={64} />
          <h1 className="mt-4 text-[30px] font-semibold">Pega Aí</h1>
          <p className="mt-1 text-center text-[14px] text-text-2">A vida a dois, organizada<br />num só lugar.</p>
        </div>

        <div className="mt-8 space-y-4">
          <div><Label>E-mail</Label><Input value={email} onChange={setEmail} placeholder="voce@email.com" type="email" /></div>
          <div><Label>Senha</Label><Input value={pass} onChange={setPass} type="password" placeholder="mínimo 6 caracteres" /></div>
          <Button full onClick={entrar} disabled={disabled}>{busy === "in" ? "Entrando…" : "Entrar"}</Button>
          <ErrorMsg msg={err} />
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[12px] font-medium text-text-3">ou</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-2.5">
          <Button full variant="secondary" onClick={criar} disabled={disabled}>{busy === "create" ? "Criando…" : "Criar um novo espaço"}</Button>
          <Button full variant="secondary" onClick={comCodigo} disabled={disabled}><LogIn size={17} /> Entrar com um código</Button>
        </div>
      </div>
      <p className="pb-6 pt-4 text-center text-[13px] text-text-3">Esqueci minha senha</p>
    </div>
  );
}

/* 02 — Choose (conta sem espaço) */
function Choose({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const s = useStore();
  const [busy, setBusy] = useState(false);

  async function criar() {
    setBusy(true);
    s.beginOnboarding();
    const { error } = await s.createSpaceFlow({ memberName: nameFromEmail(s.me.email || "Você"), color: "p1" });
    setBusy(false);
    if (!error) onCreate();
  }

  return (
    <div className="flex flex-1 flex-col px-6 anim-screen">
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex flex-col items-center">
          <SpaceLogo size={88} />
          <h1 className="mt-5 text-center text-[28px] font-semibold leading-tight">Vamos montar o<br />espaço de vocês</h1>
          <p className="mt-2 text-center text-[14px] text-text-2">Um espaço guarda as listas, datas e lembretes do casal.</p>
        </div>
        <div className="mt-8 space-y-3">
          <BigChoice icon={<Plus size={18} />} title={busy ? "Criando…" : "Criar um novo espaço"} sub="Começar do zero — você vira admin" onClick={criar} />
          <BigChoice icon={<LogIn size={18} />} title="Entrar com um código" sub="Alguém já te convidou? Use o código" onClick={() => { s.beginOnboarding(); onJoin(); }} />
        </div>
      </div>
      <p className="pb-6 text-center text-[13px] text-text-3">Você pode trocar de espaço depois</p>
    </div>
  );
}

function BigChoice({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-4 text-left transition-colors hover:border-[#2a2c38]">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-accent/15 text-accent">{icon}</span>
      <div className="flex-1"><p className="text-[15px] font-semibold">{title}</p><p className="text-[12px] text-text-3">{sub}</p></div>
      <ChevronRight size={18} className="text-text-3" />
    </button>
  );
}

/* 03 — Join */
function Join() {
  const s = useStore();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ spaceName: string; adminName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  async function onCode(v: string) {
    setCode(v); setErr(undefined);
    if (v.replace(/\s/g, "").length >= 7) {
      const p = await s.previewCode(v);
      setPreview(p);
    } else setPreview(null);
  }

  async function entrar() {
    setErr(undefined); setBusy(true);
    const { error } = await s.joinSpaceFlow({ code, memberName: nameFromEmail(s.me.email || "Você"), color: "p2" });
    setBusy(false);
    if (error) { setErr(error); return; }
    s.finishOnboarding();
  }

  return (
    <div className="flex flex-1 flex-col px-6 anim-screen">
      <div className="flex-1">
        <h1 className="mt-6 text-[26px] font-semibold leading-tight">Entrar num<br />espaço existente</h1>
        <p className="mt-2 text-[14px] text-text-2">Digite o código que seu par compartilhou com você.</p>
        <div className="mt-6"><Label>Código do convite</Label><Input value={code} onChange={onCode} mono autoFocus placeholder="PEGA-XXXX" /></div>
        {preview && (
          <div className="mt-4 flex items-center gap-3 rounded-md border border-accent/40 bg-surface px-4 py-3.5 anim-fade">
            <Avatar name={preview.adminName} color="p1" size={36} />
            <div className="flex-1">
              <p className="text-[14px] font-semibold">{preview.spaceName}</p>
              <p className="text-[12px] text-text-3">convidou você</p>
            </div>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[#0a0a0e]"><Check size={14} strokeWidth={3} /></span>
          </div>
        )}
        <ErrorMsg msg={err} />
      </div>
      <div className="pb-6">
        <Button full onClick={entrar} disabled={busy || code.replace(/\s/g, "").length < 7}>{busy ? "Entrando…" : "Entrar nesse espaço"}</Button>
        <p className="mt-4 text-center text-[13px] text-text-3">Não tenho um código — criar espaço</p>
      </div>
    </div>
  );
}

/* 04 — Invite */
function Invite({ onContinue }: { onContinue: () => void }) {
  const s = useStore();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(s.space.inviteCode); } catch {}
    setCopied(true);
  }
  async function share() {
    const code = s.space.inviteCode;
    const text = `Entra no nosso espaço no Pega Aí! Código do convite: ${code}`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Pega Aí", text });
        return; // compartilhou pelo menu do sistema
      } catch {
        return; // usuário cancelou
      }
    }
    // sem Web Share (desktop): copia e segue
    await copy();
  }
  return (
    <div className="flex flex-1 flex-col px-6 anim-screen">
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex flex-col items-center">
          <SpaceLogo size={88} />
          <h1 className="mt-5 text-center text-[24px] font-semibold leading-tight">Esse espaço é<br />de vocês dois</h1>
          <p className="mt-2 text-center text-[14px] text-text-2">Convide quem você ama. Assim que entrar, tudo fica sincronizado entre vocês.</p>
        </div>
        <div className="mt-7 flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-4">
          <div className="flex-1">
            <p className="text-[12px] font-medium text-text-3">Código do convite</p>
            <p className="mt-1 font-mono text-[20px] font-semibold tracking-[0.1em]">{s.space.inviteCode || "—"}</p>
          </div>
          <button onClick={copy} className="grid h-10 w-10 place-items-center rounded-md border border-border text-text-2">
            {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
          </button>
        </div>
      </div>
      <div className="pb-6">
        <Button full onClick={share}>Compartilhar convite</Button>
        <button onClick={onContinue} className="mt-3 w-full text-center text-[13px] text-text-3">Continuar</button>
      </div>
    </div>
  );
}

/* 05 — Dates */
type DraftDate = { id: string; title: string; startISO: string; type: DateType; color: PersonColor };
const DATE_TYPES: DateType[] = ["Aniversário", "Mensário", "Viagem", "Outro"];

function newRow(i = 0): DraftDate {
  return { id: `r_${Date.now()}_${i}`, title: "", startISO: "", type: "Aniversário", color: i % 2 ? "p2" : "p1" };
}

function Dates({ onContinue }: { onContinue: () => void }) {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<DraftDate[]>([newRow(0)]);

  function patch(id: string, p: Partial<DraftDate>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }
  function removeRow(id: string) {
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.id !== id)));
  }

  async function cont() {
    setBusy(true);
    await s.persistDates(rows.filter((r) => r.title.trim() && r.startISO));
    setBusy(false);
    onContinue();
  }

  return (
    <div className="flex flex-1 flex-col px-6 anim-screen">
      <div className="flex-1 overflow-y-auto">
        <h1 className="mt-6 text-[24px] font-semibold leading-tight">Quais datas importam<br />pra vocês?</h1>
        <p className="mt-2 text-[14px] text-text-2">A gente cuida das contagens regressivas. Pode deixar em branco e adicionar depois.</p>
        <div className="mt-6 space-y-2.5">
          {rows.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-surface px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  value={r.title}
                  onChange={(e) => patch(r.id, { title: e.target.value })}
                  placeholder="Nome da data (ex.: Início do namoro)"
                  className="flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-text-3"
                />
                {rows.length > 1 && (
                  <button onClick={() => removeRow(r.id)} className="grid h-7 w-7 place-items-center rounded text-text-3 hover:text-error">
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="date"
                  value={r.startISO}
                  onChange={(e) => patch(r.id, { startISO: e.target.value })}
                  className="rounded bg-surface-hi px-2 py-1.5 font-mono text-[12px] text-text-2 outline-none [color-scheme:dark]"
                />
                <select
                  value={r.type}
                  onChange={(e) => patch(r.id, { type: e.target.value as DateType })}
                  className="rounded bg-surface-hi px-2 py-1.5 text-[12px] text-text-2 outline-none"
                >
                  {DATE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <button
            onClick={() => setRows((rs) => [...rs, newRow(rs.length)])}
            className="flex w-full items-center gap-2 rounded-md border border-dashed border-border bg-surface px-4 py-3.5 text-[14px] text-text-2"
          >
            <Plus size={16} /> Adicionar outra data
          </button>
        </div>
      </div>
      <div className="py-6"><Button full onClick={cont} disabled={busy}>{busy ? "Salvando…" : "Continuar"}</Button></div>
    </div>
  );
}

/* 06 — Color */
function ColorStep({ onContinue }: { onContinue: () => void }) {
  const s = useStore();
  const [name, setName] = useState(s.me.name && s.me.name !== "você" ? s.me.name : nameFromEmail(s.me.email || ""));
  const [color, setColor] = useState<PersonColor>(s.me.color);
  const colors: PersonColor[] = ["p1", "p2", "p3", "p4"];

  function cont() {
    if (name.trim()) s.setMyName(name.trim());
    s.setMyColor(color);
    onContinue();
  }

  return (
    <div className="flex flex-1 flex-col px-6 anim-screen">
      <div className="flex-1">
        <h1 className="mt-6 text-[24px] font-semibold leading-tight">Como você aparece<br />pro seu par</h1>
        <p className="mt-2 text-[14px] text-text-2">Escolha um apelido e a cor que representa você nas listas e na agenda.</p>
        <div className="mt-6"><Label>Seu nome</Label><Input value={name} onChange={setName} /></div>
        <p className="mb-2 mt-5 text-[12px] font-medium text-text-3">Sua cor no espaço</p>
        <div className="flex gap-3">
          {colors.map((c) => (
            <button key={c} onClick={() => setColor(c)} className="h-10 w-10 rounded-md active:scale-95 transition-transform"
              style={{ background: PERSON_HEX[c], boxShadow: color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${PERSON_HEX[c]}` : undefined }} />
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3.5">
          <Avatar name={name || "?"} color={color} size={40} />
          <div>
            <p className="text-[15px] font-semibold">{name || "Seu nome"}</p>
            <p className="text-[12px] text-text-3">é assim que você aparece no espaço</p>
          </div>
        </div>
      </div>
      <div className="pb-6"><Button full onClick={cont}>Continuar</Button></div>
    </div>
  );
}

/* 07 — Done */
function Done() {
  const s = useStore();
  const items = ["Espaço criado", `${s.dates.length} ${s.dates.length === 1 ? "data adicionada" : "datas adicionadas"}`, "Sua cor escolhida"];
  return (
    <div className="flex flex-1 flex-col px-6 anim-screen">
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex flex-col items-center">
          <div className="relative">
            <SpaceLogo size={96} />
            <span className="absolute -bottom-1 right-0 grid h-8 w-8 place-items-center rounded-full bg-accent text-[#0a0a0e] ring-4 ring-bg"><Check size={16} strokeWidth={3} /></span>
          </div>
          <h1 className="mt-5 text-center text-[24px] font-semibold leading-tight">Tudo pronto,<br />{s.me.name}</h1>
          <p className="mt-2 text-center text-[14px] text-text-2">O espaço está no ar. A partir de agora, tudo fica sincronizado entre vocês.</p>
        </div>
        <div className="mt-7 space-y-2">
          {items.map((t) => (
            <div key={t} className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[#0a0a0e]"><Check size={14} strokeWidth={3} /></span>
              <span className="text-[14px] font-medium">{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="pb-6"><Button full onClick={() => s.finishOnboarding()}>Ir para o início</Button></div>
    </div>
  );
}
