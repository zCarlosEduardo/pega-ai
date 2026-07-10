"use client";
import { useState } from "react";
import { ChevronLeft, MoreVertical, Plus, Trash2, Pencil, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/nav";
import { StatusBar } from "@/components/ui/Surface";
import { Checkbox, Avatar } from "@/components/ui/Inputs";
import { Sheet } from "@/components/ui/PegaSheet";
import { Input } from "@/components/ui/PegaInput";
import { Button } from "@/components/ui/PegaButton";
import { cn, PERSON_HEX } from "@/lib/cn";
import type { ListItem } from "@/lib/types";

const DOT: Record<string, string> = { success: "bg-success", accent: "bg-accent", warning: "bg-warning" };

export function ListDetail({ id }: { id: string }) {
  const s = useStore();
  const { close } = useNav();

  const [itemSheet, setItemSheet] = useState(false);
  const [editing, setEditing] = useState<ListItem | null>(null); // item em edição (null = novo)
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState<string | undefined>(undefined);
  const [everyone, setEveryone] = useState(false);

  const [listSheet, setListSheet] = useState(false);
  const [listName, setListName] = useState("");

  const list = s.lists.find((l) => l.id === id);
  if (!list) return null;

  const todo = list.items.filter((i) => !i.done);
  const done = list.items.filter((i) => i.done);
  const total = list.items.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;

  function openNew() {
    setEditing(null);
    setText("");
    setAssignee(undefined);
    setEveryone(false);
    setItemSheet(true);
  }
  function openEdit(it: ListItem) {
    setEditing(it);
    setText(it.text);
    setAssignee(it.assignee);
    setEveryone(!!it.everyone);
    setItemSheet(true);
  }
  async function submitItem() {
    if (!text.trim()) return;
    const opts = { assignee: everyone ? undefined : assignee, everyone };
    if (editing) await s.updateItem(list!.id, editing.id, { text: text.trim(), ...opts });
    else await s.addItem(list!.id, text.trim(), opts);
    setItemSheet(false);
  }
  async function removeItem() {
    if (editing) await s.deleteItem(list!.id, editing.id);
    setItemSheet(false);
  }

  function openListMenu() {
    setListName(list!.name);
    setListSheet(true);
  }
  async function saveListName() {
    if (listName.trim() && listName.trim() !== list!.name) await s.renameList(list!.id, listName.trim());
    setListSheet(false);
  }
  async function removeList() {
    await s.deleteList(list!.id);
    setListSheet(false);
    close();
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg anim-screen">
      <StatusBar />
      <div className="flex items-center justify-between px-4 py-2">
        <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-surface">
          <ChevronLeft size={22} />
        </button>
        <button onClick={openListMenu} className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-surface" aria-label="Opções da lista">
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-32">
        <div className="flex items-center gap-2">
          <span className={cn("h-3 w-3 rounded-full", DOT[list.dotColor])} />
          <h1 className="text-[26px] font-semibold">{list.name}</h1>
        </div>
        <p className="mt-1 text-[13px] text-text-2">
          {list.shared ? "Compartilhada" : "Minha"} · {done.length} de {total} concluídos
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-hi">
          <div className={cn("h-full rounded-full transition-all duration-[240ms]", DOT[list.dotColor])} style={{ width: `${pct}%` }} />
        </div>

        {total === 0 && (
          <div className="mt-10 grid place-items-center rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center">
            <p className="text-[15px] font-semibold">Lista vazia</p>
            <p className="mt-1 text-[13px] text-text-3">Adicione o primeiro item aqui embaixo.</p>
          </div>
        )}

        {todo.length > 0 && (
          <>
            <p className="mb-2 mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-text-3">A fazer · {todo.length}</p>
            <div className="space-y-2">
              {todo.map((it) => (
                <ItemRow key={it.id} listId={list.id} item={it} onEdit={() => openEdit(it)} />
              ))}
            </div>
          </>
        )}

        {done.length > 0 && (
          <>
            <p className="mb-2 mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-text-3">Concluídos · {done.length}</p>
            <div className="space-y-2">
              {done.map((it) => (
                <ItemRow key={it.id} listId={list.id} item={it} onEdit={() => openEdit(it)} />
              ))}
            </div>
          </>
        )}
      </div>

      <button
        onClick={openNew}
        className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3.5 text-[14px] text-text-3"
      >
        <Plus size={18} /> Adicionar item…
      </button>

      {/* sheet de item (novo / editar) */}
      <Sheet open={itemSheet} onClose={() => setItemSheet(false)}>
        <h2 className="text-[20px] font-semibold">{editing ? "Editar item" : "Novo item"}</h2>
        <Input className="mt-4" value={text} onChange={setText} placeholder="Azeite de oliva" autoFocus />
        <p className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-text-3">Quem pega</p>
        <div className="flex flex-wrap gap-2">
          <AssignPill label="Qualquer um" active={!everyone && !assignee} onClick={() => { setEveryone(false); setAssignee(undefined); }} />
          {s.people.map((p) => (
            <AssignPill
              key={p.id}
              label={p.name}
              active={!everyone && assignee === p.id}
              onClick={() => { setEveryone(false); setAssignee(p.id); }}
              avatar={<Avatar name={p.name} color={p.color} size={20} />}
            />
          ))}
          <AssignPill label="Todos (cada um marca)" active={everyone} onClick={() => { setEveryone(true); setAssignee(undefined); }} />
        </div>
        <Button full className="mt-5" onClick={submitItem} disabled={!text.trim()}>
          {editing ? "Salvar" : "Adicionar"}
        </Button>
        {editing && (
          <button onClick={removeItem} className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-[14px] text-error">
            <Trash2 size={16} /> Excluir item
          </button>
        )}
      </Sheet>

      {/* sheet da lista (renomear / excluir) */}
      <Sheet open={listSheet} onClose={() => setListSheet(false)}>
        <h2 className="text-[20px] font-semibold">Lista</h2>
        <p className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-text-3">Renomear</p>
        <div className="flex items-center gap-2">
          <Input value={listName} onChange={setListName} className="flex-1" />
          <button onClick={saveListName} className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-accent text-[#0a0a0e]">
            <Pencil size={18} />
          </button>
        </div>
        <button onClick={removeList} className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-error/30 py-3 text-[14px] font-medium text-error">
          <Trash2 size={16} /> Excluir lista
        </button>
      </Sheet>
    </div>
  );
}

function ItemRow({ listId, item, onEdit }: { listId: string; item: ListItem; onEdit: () => void }) {
  const s = useStore();

  if (item.everyone) {
    const doneBy = item.doneBy ?? [];
    return (
      <div className="rounded-md border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="flex-1 text-left">
            <span className={cn("text-[15px]", item.done ? "text-text-3 line-through" : "text-text")}>{item.text}</span>
          </button>
          <span className="rounded bg-surface-hi px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-3">Todos</span>
          <button onClick={onEdit} className="grid h-7 w-7 place-items-center rounded text-text-3 hover:text-text-2" aria-label="Editar item">
            <Pencil size={15} />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {s.people.map((p) => {
            const checked = doneBy.includes(p.id);
            const toggle = () => s.toggleItemMember(listId, item.id, p.id);
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2.5 text-[13px] transition-all",
                  checked ? "border-success/40 bg-success/10 text-text" : "border-border bg-surface-hi text-text-2",
                )}
              >
                <Checkbox checked={checked} size={20} onChange={toggle} />
                <Avatar name={p.name} color={p.color} size={20} />
                <button onClick={toggle} className="flex-1 text-left">
                  {p.name.split(" ")[0]}
                </button>
                {checked && <Check size={14} strokeWidth={3} className="text-success" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const who = s.personById(item.assignee);
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3.5">
      <Checkbox checked={item.done} onChange={() => s.toggleItem(listId, item.id)} />
      <button onClick={onEdit} className="flex-1 text-left">
        <span className={cn("text-[15px]", item.done ? "text-text-3 line-through" : "text-text")}>{item.text}</span>
      </button>
      {who && <span className="h-2 w-2 rounded-full" style={{ background: PERSON_HEX[who.color] }} title={who.name} />}
      <button onClick={onEdit} className="grid h-7 w-7 place-items-center rounded text-text-3 hover:text-text-2" aria-label="Editar item">
        <Pencil size={15} />
      </button>
    </div>
  );
}

function AssignPill({ label, active, onClick, avatar }: { label: string; active: boolean; onClick: () => void; avatar?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-[13px] font-medium transition-all",
        active ? "border-accent bg-accent/10 text-text" : "border-border bg-surface text-text-2",
      )}
    >
      {avatar ?? <span className="h-2 w-2 rounded-full bg-text-3" />}
      {label}
    </button>
  );
}
