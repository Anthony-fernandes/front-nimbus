import { useState } from "react";
import { Clock, GitBranch, ListChecks, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkItem, WorkItemSubTicket, WorkItemSubtask, WorkItemTimeLog } from "@/lib/workItem";
import { isSubTicketFinished, isWorkItemFinished } from "@/lib/workItem";
import { cn } from "@/lib/utils";
import { parseApiError } from "@/services/utils";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function WorkItemExecution({
  item,
  timeLogs,
  timeLogsLoading,
  subTickets,
  onSaveSubtasks,
  onLogTime,
  onCreateSubTicket,
  onOpenSubTicket,
}: {
  item: WorkItem;
  timeLogs: WorkItemTimeLog[];
  timeLogsLoading?: boolean;
  /** Subchamados vinculados (apenas para chamados). */
  subTickets?: WorkItemSubTicket[];
  onSaveSubtasks: (subtasks: WorkItemSubtask[]) => Promise<void>;
  onLogTime: (payload: { date: string; hours: number; description: string }) => Promise<void>;
  onCreateSubTicket?: (payload: { title: string; category: string }) => Promise<void>;
  onOpenSubTicket?: (ticketId: string) => void;
}) {
  const finished = isWorkItemFinished(item);
  const inProgress = ["Em atendimento", "Em progresso", "Em andamento"].includes(item.status);
  const [newSubTicketTitle, setNewSubTicketTitle] = useState("");
  const [newSubTicketCategory, setNewSubTicketCategory] = useState("");
  const [creatingSubTicket, setCreatingSubTicket] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [savingSubtasks, setSavingSubtasks] = useState(false);

  const [logDate, setLogDate] = useState(todayIso());
  const [logHours, setLogHours] = useState("");
  const [logDescription, setLogDescription] = useState("");
  const [loggingTime, setLoggingTime] = useState(false);

  const saveSubtasks = async (next: WorkItemSubtask[]) => {
    setSavingSubtasks(true);
    try {
      await onSaveSubtasks(next);
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível salvar as subtarefas."));
    } finally {
      setSavingSubtasks(false);
    }
  };

  const addSubtask = () => {
    const text = newSubtask.trim();
    if (!text) return;
    void saveSubtasks([...item.subtasks, { text, done: false, required: newRequired }]);
    setNewSubtask("");
    setNewRequired(false);
  };

  const toggleSubtask = (index: number) => {
    const next = item.subtasks.map((s, i) => (i === index ? { ...s, done: !s.done } : s));
    void saveSubtasks(next);
  };

  const removeSubtask = (index: number) => {
    void saveSubtasks(item.subtasks.filter((_, i) => i !== index));
  };

  const submitTime = async () => {
    const hours = Number(logHours);
    if (!hours || hours <= 0) {
      toast.error("Informe as horas gastas.");
      return;
    }
    setLoggingTime(true);
    try {
      await onLogTime({ date: logDate, hours, description: logDescription.trim() });
      setLogHours("");
      setLogDescription("");
      setLogDate(todayIso());
      toast.success("Tempo registrado.");
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível registrar o tempo."));
    } finally {
      setLoggingTime(false);
    }
  };

  const totalHours = timeLogs.reduce((sum, log) => sum + log.hours, 0);
  const byCollaborator = new Map<string, number>();
  for (const log of timeLogs) {
    byCollaborator.set(log.collaboratorName, (byCollaborator.get(log.collaboratorName) || 0) + log.hours);
  }

  return (
    <div className="space-y-4">
      {/* ── Subtarefas ── */}
      <section className="rounded-xl border border-border bg-muted/10 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" /> Subtarefas
          </div>
          <span className="text-xs text-muted-foreground">
            {item.subtasks.filter((s) => s.done).length}/{item.subtasks.length} concluídas
          </span>
        </div>

        {item.subtasks.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nenhuma subtarefa. Adicione o passo a passo do trabalho.</p>
        ) : (
          <ul className="space-y-1">
            {item.subtasks.map((subtask, i) => (
              <li
                key={`${subtask.text}-${i}`}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/30"
              >
                <input
                  type="checkbox"
                  checked={subtask.done}
                  disabled={finished || savingSubtasks}
                  onChange={() => toggleSubtask(i)}
                  className="h-4 w-4 accent-primary"
                />
                <span className={cn("flex-1 text-sm", subtask.done && "text-muted-foreground line-through")}>
                  {subtask.text}
                </span>
                {subtask.required ? (
                  <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    obrigatória
                  </span>
                ) : null}
                {!finished && (
                  <button
                    type="button"
                    onClick={() => removeSubtask(i)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!finished && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
              placeholder="Nova subtarefa..."
              className="h-9 flex-1 min-w-[200px]"
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              Obrigatória p/ finalizar
            </label>
            <Button size="sm" variant="outline" className="gap-1" disabled={savingSubtasks || !newSubtask.trim()} onClick={addSubtask}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
        )}
      </section>

      {/* ── Subchamados (somente chamados) ── */}
      {subTickets !== undefined && (
        <section className="rounded-xl border border-border bg-muted/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" /> Subchamados
            </div>
            <span className="text-xs text-muted-foreground">
              {subTickets.filter(isSubTicketFinished).length}/{subTickets.length} encerrados
            </span>
          </div>

          {subTickets.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Nenhum subchamado. Crie um para acionar outra equipe (infra, banco, desenvolvimento...).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-1.5 pr-3 font-medium">Código</th>
                    <th className="pb-1.5 pr-3 font-medium">Título</th>
                    <th className="pb-1.5 pr-3 font-medium">Categoria</th>
                    <th className="pb-1.5 pr-3 font-medium">Responsável</th>
                    <th className="pb-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subTickets.map((sub) => (
                    <tr
                      key={sub.id}
                      className="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/30"
                      onClick={() => onOpenSubTicket?.(sub.ticketId)}
                    >
                      <td className="py-1.5 pr-3 font-mono text-xs text-primary">{sub.code}</td>
                      <td className="max-w-[220px] truncate py-1.5 pr-3 font-medium">{sub.title}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{sub.category || "—"}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{sub.responsibleName || "—"}</td>
                      <td className="py-1.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            isSubTicketFinished(sub) ? "bg-success/15 text-success" : "bg-info/15 text-info",
                          )}
                        >
                          {sub.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!finished && onCreateSubTicket && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-[11px] text-muted-foreground">Título do subchamado</label>
                <Input
                  value={newSubTicketTitle}
                  onChange={(e) => setNewSubTicketTitle(e.target.value)}
                  placeholder="Ex.: Verificar fila de impressão"
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">Categoria / equipe</label>
                <Input
                  value={newSubTicketCategory}
                  onChange={(e) => setNewSubTicketCategory(e.target.value)}
                  placeholder="Ex.: Infraestrutura"
                  className="h-9 w-44"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1"
                disabled={creatingSubTicket || !newSubTicketTitle.trim()}
                onClick={() => {
                  void (async () => {
                    setCreatingSubTicket(true);
                    try {
                      await onCreateSubTicket({
                        title: newSubTicketTitle.trim(),
                        category: newSubTicketCategory.trim(),
                      });
                      setNewSubTicketTitle("");
                      setNewSubTicketCategory("");
                      toast.success("Subchamado criado e vinculado.");
                    } catch (error) {
                      toast.error(parseApiError(error, "Não foi possível criar o subchamado."));
                    } finally {
                      setCreatingSubTicket(false);
                    }
                  })();
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Criar subchamado
              </Button>
            </div>
          )}
        </section>
      )}

      {/* ── Apontamento de tempo ── */}
      <section className="rounded-xl border border-border bg-muted/10 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Tempo gasto
          </div>
          <span className="text-xs font-semibold text-primary">{totalHours.toFixed(2).replace(/\.00$/, "")}h total</span>
        </div>

        {byCollaborator.size > 1 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {Array.from(byCollaborator.entries()).map(([name, hours]) => (
              <span key={name} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                {name}: {hours.toFixed(2).replace(/\.00$/, "")}h
              </span>
            ))}
          </div>
        )}

        {timeLogsLoading ? (
          <p className="py-2 text-sm text-muted-foreground">Carregando apontamentos...</p>
        ) : timeLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-1.5 pr-3 font-medium">Técnico</th>
                  <th className="pb-1.5 pr-3 font-medium">Data</th>
                  <th className="pb-1.5 pr-3 text-right font-medium">Horas</th>
                  <th className="pb-1.5 font-medium">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {timeLogs.map((log) => (
                  <tr key={log.id} className="border-t border-border/50">
                    <td className="py-1.5 pr-3 font-medium">{log.collaboratorName}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {new Date(`${log.date}T12:00:00`).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono text-xs">{log.hours}h</td>
                    <td className="max-w-[240px] truncate py-1.5 text-muted-foreground" title={log.description}>
                      {log.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">Nenhum apontamento registrado.</p>
        )}

        {!finished && !inProgress && (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            ⚠ Inicie o atendimento para apontar horas neste item.
          </div>
        )}
        {!finished && inProgress && (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Data</label>
              <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="h-9 w-36" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">Horas</label>
              <Input
                type="number"
                min={0.25}
                step={0.25}
                value={logHours}
                onChange={(e) => setLogHours(e.target.value)}
                placeholder="1.5"
                className="h-9 w-24"
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] text-muted-foreground">O que foi feito</label>
              <Input
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                placeholder="Descrição do trabalho realizado"
                className="h-9"
              />
            </div>
            <Button size="sm" className="h-9 gap-1" disabled={loggingTime} onClick={() => void submitTime()}>
              <Clock className="h-3.5 w-3.5" /> {loggingTime ? "Salvando..." : "Apontar"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
