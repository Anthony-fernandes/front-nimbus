import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Pencil } from "lucide-react";

import { WORK_ITEM_TYPE_LABELS, type WorkItem } from "@/lib/workItem";
import { formatPriorityLabel } from "@/lib/labels";
import { listUsers } from "@/services/userService";
import { formatDateTime } from "@/services/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-xs font-medium">{children}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 px-3 py-2.5">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  // Aceita ISO ou 'YYYY-MM-DD'; usa só a parte da data para o <input type="date">.
  return String(value).slice(0, 10);
}

export function WorkItemContextPanel({
  item,
  onChangeResponsible,
  onChangeDueAt,
}: {
  item: WorkItem;
  onChangeResponsible: (userId: string) => void;
  onChangeDueAt?: (dueAt: string | null) => void;
}) {
  const [editingResponsible, setEditingResponsible] = useState(false);
  const [editingDueAt, setEditingDueAt] = useState(false);
  // Vencimento é editável para itens de sprint (fonte do prazo para terminar).
  const canEditDueAt = Boolean(onChangeDueAt);
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
    enabled: editingResponsible,
  });
  const technicians = users.filter((u) => (u.role || "").toUpperCase() !== "CLIENT");

  const progress = item.subtasks.length
    ? Math.round((item.subtasks.filter((s) => s.done).length / item.subtasks.length) * 100)
    : null;

  return (
    <div className="space-y-2.5">
      <Block title="Dados gerais">
        {item.requesterName ? <Row label="Solicitante">{item.requesterName}</Row> : null}
        {item.clientName ? <Row label="Cliente">{item.clientName}</Row> : null}
        {item.projectName ? <Row label="Projeto">{item.projectName}</Row> : null}
        {item.sprintName ? <Row label="Sprint">{item.sprintName}</Row> : null}
        <Row label="Tipo">{WORK_ITEM_TYPE_LABELS[item.ref.type]}</Row>
      </Block>

      <Block title="Classificação">
        {item.category ? <Row label="Categoria">{item.category}</Row> : null}
        <Row label="Prioridade">{formatPriorityLabel(item.priority)}</Row>
        {item.slaDueAt ? <Row label="SLA">{formatDateTime(item.slaDueAt)}</Row> : null}
        {item.createdAt ? <Row label="Abertura">{formatDateTime(item.createdAt)}</Row> : null}
        {canEditDueAt ? (
          editingDueAt ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">Vencimento</span>
              <input
                type="date"
                defaultValue={toDateInputValue(item.dueAt)}
                autoFocus
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                onBlur={(e) => {
                  const next = e.target.value || null;
                  if (next !== toDateInputValue(item.dueAt)) onChangeDueAt?.(next);
                  setEditingDueAt(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setEditingDueAt(false);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">Vencimento</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">{item.dueAt ? formatDateTime(item.dueAt) : "Sem vencimento"}</span>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                  onClick={() => setEditingDueAt(true)}
                  title="Editar vencimento"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        ) : item.dueAt ? (
          <Row label="Vencimento">{formatDateTime(item.dueAt)}</Row>
        ) : null}
        {item.estHours ? <Row label="Estimativa">{item.estHours}h</Row> : null}
      </Block>

      <Block title="Responsável">
        {editingResponsible ? (
          <div className="flex items-center gap-1.5">
            <select
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              defaultValue={item.responsibleId || ""}
              onChange={(e) => {
                if (e.target.value) {
                  onChangeResponsible(e.target.value);
                  setEditingResponsible(false);
                }
              }}
            >
              <option value="" disabled>Selecionar...</option>
              {technicians.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.username}</option>
              ))}
            </select>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setEditingResponsible(false)}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium">{item.responsibleName || "Sem responsável"}</span>
            <button
              type="button"
              className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
              onClick={() => setEditingResponsible(true)}
              title="Transferir responsável"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </Block>

      <Block title="Status e fluxo">
        <Row label="Status">{item.status}</Row>
        {typeof item.reopenCount === "number" && item.reopenCount > 0 ? (
          <Row label="Reaberturas">{item.reopenCount}</Row>
        ) : null}
        {progress !== null ? (
          <div className="mt-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Subtarefas</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
      </Block>

      {item.tags && item.tags.length > 0 ? (
        <Block title="Tags">
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                {tag}
              </span>
            ))}
          </div>
        </Block>
      ) : null}
    </div>
  );
}
