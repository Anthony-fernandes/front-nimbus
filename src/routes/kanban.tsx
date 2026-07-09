import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MessageSquare, MoreHorizontal, Paperclip } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { WorkItemModal } from "@/components/workitem/WorkItemModal";
import { WorkItemBlockDialog } from "@/components/workitem/WorkItemDialogs";
import type { Ticket } from "@/lib/types";
import { listTickets, updateTicket } from "@/services/ticketService";
import { listUsers } from "@/services/userService";
import { getMyActiveSprint, getSprintItems } from "@/services/sprintService";

const EMPTY_TICKETS: Ticket[] = [];

export const Route = createFileRoute("/kanban")({
  head: () => ({ meta: [{ title: "Kanban · NimbusDesk" }] }),
  component: KanbanPage,
});

const priorityClr: Record<string, string> = {
  "Cr\u00edtica": "bg-destructive/15 text-destructive",
  Alta: "bg-warning/15 text-warning",
  "M\u00e9dia": "bg-info/15 text-info",
  Baixa: "bg-muted text-muted-foreground",
};

// Cobre todos os status operacionais oficiais de chamado (common/status_rules.py).
const statusCols = [
  { name: "Aberto", label: "Aberto", accent: "bg-muted-foreground" },
  { name: "Triagem", label: "Triagem", accent: "bg-muted-foreground" },
  { name: "Aguardando Aprovacao", label: "Aguardando aprova\u00e7\u00e3o", accent: "bg-warning" },
  { name: "Aguardando atendimento", label: "Aguardando atendimento", accent: "bg-info" },
  { name: "Em atendimento", label: "Em atendimento", accent: "bg-primary" },
  { name: "Aguardando cliente", label: "Aguardando cliente", accent: "bg-warning" },
  { name: "Valida\u00e7\u00e3o", label: "Valida\u00e7\u00e3o", accent: "bg-accent" },
  { name: "Pausado", label: "Pausado", accent: "bg-info" },
  { name: "Finalizado", label: "Finalizado", accent: "bg-success" },
] as const;

// Status finais/encerrados que n\u00e3o ganham coluna pr\u00f3pria mas n\u00e3o devem sumir.
const CLOSED_STATUSES = ["Cancelado", "Reprovado", "Aprovado"];

function initials(names?: string[]) {
  const value = names?.[0] || "NA";
  return value
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function KanbanPage() {
  const queryClient = useQueryClient();
  const { data: tickets = EMPTY_TICKETS } = useQuery({
    queryKey: ["kanban-tickets"],
    queryFn: () => listTickets(),
  });

  const [localTickets, setLocalTickets] = useState<Ticket[]>([]);
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [filterTech, setFilterTech] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [drawerTicketId, setDrawerTicketId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"conversa" | "resolucao">("conversa");
  const [pausePendingId, setPausePendingId] = useState<string | null>(null);
  // Filtro padrão: escopo na sprint ativa do técnico logado.
  const [scopeToSprint, setScopeToSprint] = useState(true);

  const { data: users = [] } = useQuery({ queryKey: ["form-users"], queryFn: () => listUsers() });

  // Sprint ativa do usuário (fonte única: backend). Define o escopo padrão do Kanban.
  const { data: activeSprint, isLoading: activeSprintLoading } = useQuery({
    queryKey: ["my-active-sprint"],
    queryFn: () => getMyActiveSprint(),
  });
  const { data: activeSprintItems } = useQuery({
    queryKey: ["sprint-items", activeSprint?.id],
    queryFn: () => getSprintItems(activeSprint!.id),
    enabled: Boolean(activeSprint?.id),
  });
  // IDs de chamados que pertencem à sprint ativa (para escopar o Kanban geral).
  const sprintTicketIds = useMemo(() => {
    const set = new Set<string>();
    for (const it of activeSprintItems?.items ?? []) {
      if (it.type === "ticket") set.add(String(it.id));
    }
    return set;
  }, [activeSprintItems]);

  useEffect(() => {
    setLocalTickets(tickets);
  }, [tickets]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status, reason }: { ticketId: string; status: string; reason?: string }) =>
      updateTicket(ticketId, { status, ...(reason ? { status_change_reason: reason } : {}) } as Partial<Ticket>),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      ]);
    },
  });

  // Escopo ativo: só quando o técnico TEM sprint ativa e o toggle está ligado.
  const sprintScopeActive = scopeToSprint && Boolean(activeSprint?.id);

  const groupedTickets = useMemo(() => {
    const byTech = (t: (typeof localTickets)[number]) =>
      !filterTech || (t.technicians || []).map(String).includes(filterTech);
    const byPrio = (t: (typeof localTickets)[number]) => !filterPriority || t.priority === filterPriority;
    const bySprint = (t: (typeof localTickets)[number]) =>
      !sprintScopeActive || sprintTicketIds.has(String(t.id));
    const known = new Set<string>(statusCols.map((c) => c.name));

    const cols: Array<{ name: string; label: string; accent: string; cards: typeof localTickets }> =
      statusCols.map((column) => ({
        name: column.name,
        label: column.label,
        accent: column.accent,
        cards: localTickets
          .filter((t) => (t.status || "Triagem") === column.name)
          .filter(bySprint)
          .filter(byTech)
          .filter(byPrio),
      }));

    // Balde para status encerrados/desconhecidos — garante que nenhum card suma.
    const leftovers = localTickets
      .filter((t) => !known.has(t.status || "Triagem"))
      .filter(bySprint)
      .filter(byTech)
      .filter(byPrio);
    if (leftovers.length) {
      cols.push({ name: "__closed__", label: "Encerrados", accent: "bg-muted-foreground", cards: leftovers });
    }
    return cols;
  }, [localTickets, filterTech, filterPriority, sprintScopeActive, sprintTicketIds]);

  const applyMove = (ticketId: string, nextStatus: string, reason?: string) => {
    const currentTicket = localTickets.find((ticket) => ticket.id === ticketId);
    if (!currentTicket) return;
    const previousStatus = currentTicket.status || "Triagem";
    if (previousStatus === nextStatus) return;

    setLocalTickets((current) =>
      current.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status: nextStatus } : ticket,
      ),
    );
    updateStatusMutation.mutate(
      { ticketId, status: nextStatus, reason },
      {
        onError: () => {
          setLocalTickets((current) =>
            current.map((ticket) =>
              ticket.id === ticketId ? { ...ticket, status: previousStatus } : ticket,
            ),
          );
          toast.error("Não foi possível mover o card");
        },
      },
    );
  };

  const moveTicketToStatus = (ticketId: string, nextStatus: string) => {
    const currentTicket = localTickets.find((ticket) => ticket.id === ticketId);
    if (!currentTicket) return;
    if ((currentTicket.status || "Triagem") === nextStatus) return;

    // Concluir exige resolução documentada — abre o fluxo em vez de mover direto.
    if (nextStatus === "Finalizado") {
      setDrawerTab("resolucao");
      setDrawerTicketId(ticketId);
      toast.info("Preencha a resolução para finalizar este card.");
      return;
    }
    // Pausar exige motivo.
    if (nextStatus === "Pausado") {
      setPausePendingId(ticketId);
      return;
    }
    applyMove(ticketId, nextStatus);
  };

  const openTicket = (ticket: Ticket) => {
    setDrawerTab("conversa");
    setDrawerTicketId(ticket.id);
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-6.5rem)] flex-col gap-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
            <p className="text-sm text-muted-foreground">
              Fluxo de trabalho · {localTickets.length} cards
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {activeSprint?.id ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    Sprint ativa: {activeSprint.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setScopeToSprint((v) => !v)}
                    className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {scopeToSprint ? "Mostrando só a sprint ativa · ver todos" : "Ver só a sprint ativa"}
                  </button>
                </>
              ) : (
                !activeSprintLoading && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-medium text-warning">
                    Você não está vinculado a nenhuma Sprint ativa
                  </span>
                )
              )}
            </div>
          </div>
          <div className="flex gap-2 text-xs items-center">
  <button
    type="button"
    onClick={() => setShowFilters(f => !f)}
    className="glass rounded-lg px-3 py-1.5 transition-colors hover:border-primary/40"
  >
    Filtrar {showFilters ? "▲" : "▼"}
  </button>
  {showFilters && (
    <>
      <select
        value={filterTech}
        onChange={e => setFilterTech(e.target.value)}
        className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs outline-none focus:border-primary"
      >
        <option value="">Todos os técnicos</option>
        {users.map(u => (
          <option key={u.id} value={String(u.id)}>
            {u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || u.email}
          </option>
        ))}
      </select>
      <select
        value={filterPriority}
        onChange={e => setFilterPriority(e.target.value)}
        className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs outline-none focus:border-primary"
      >
        <option value="">Todas as prioridades</option>
        {["Crítica", "Alta", "Média", "Baixa"].map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      {(filterTech || filterPriority) && (
        <button type="button" onClick={() => { setFilterTech(""); setFilterPriority(""); }} className="text-xs text-muted-foreground hover:text-foreground">
          Limpar
        </button>
      )}
    </>
  )}
  <a href="/tickets/new" className="ml-auto rounded-lg bg-gradient-primary px-3 py-1.5 text-primary-foreground shadow-glow">
    + Novo card
  </a>
</div>
        </div>
        <div className="-mx-2 flex min-h-0 flex-1 gap-4 overflow-x-auto px-2 pb-4">
          {groupedTickets.map((column) => (
            <div
              key={column.name}
              className={`glass flex h-full min-h-0 w-72 shrink-0 flex-col rounded-2xl p-3 ${activeColumn === column.name ? "border-primary/50 ring-1 ring-primary/30" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedTicketId) {
                  event.dataTransfer.dropEffect = "move";
                  setActiveColumn(column.name);
                }
              }}
              onDragLeave={() => {
                if (activeColumn === column.name) {
                  setActiveColumn(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const ticketId = event.dataTransfer.getData("text/plain") || draggedTicketId;
                setActiveColumn(null);
                setDraggedTicketId(null);
                if (ticketId) {
                  moveTicketToStatus(ticketId, column.name);
                }
              }}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${column.accent}`} />
                  <span className="text-sm font-medium">{column.label}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {column.cards.length}
                  </span>
                </div>
                <button className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {column.cards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(event) => {
                      setDraggedTicketId(card.id);
                      setActiveColumn(column.name);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", card.id);
                    }}
                    onDragEnd={() => {
                      setDraggedTicketId(null);
                      setActiveColumn(null);
                    }}
                    className={`group rounded-xl border border-border bg-card/80 p-3 transition-all hover:border-primary/40 hover:shadow-glow ${draggedTicketId === card.id ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => openTicket(card)}
                        className="text-[10px] font-mono text-muted-foreground hover:text-primary"
                      >
                        {card.code || card.id.slice(0, 8)}
                      </button>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityClr[card.priority || "M\u00e9dia"]}`}
                      >
                        {card.priority || "M\u00e9dia"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openTicket(card)}
                      className="mt-1.5 block w-full text-left text-sm leading-snug hover:text-primary"
                    >
                      {card.title}
                    </button>
                    {card.client_name && (
                      <p className="mt-1 text-[11px] text-muted-foreground">{card.client_name}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(card.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {card.sla || "8h"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> 0
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> 0
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                          {card.est_hours || 0}h
                        </span>
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-primary text-[9px] font-semibold text-primary-foreground">
                          {initials(card.technician_names)}
                        </span>
                      </div>
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="shrink-0">Mover para</span>
                      <select
                        value={card.status || "Triagem"}
                        onChange={(event) => moveTicketToStatus(card.id, event.target.value)}
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none transition-colors hover:border-primary/40 focus:border-primary/40"
                      >
                        {statusCols.map((status) => (
                          <option key={status.name} value={status.name}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
                {column.cards.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    Solte um card aqui
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <WorkItemModal
        workRef={drawerTicketId ? { type: "ticket", id: drawerTicketId } : null}
        open={Boolean(drawerTicketId)}
        initialTab={drawerTab}
        onOpenChange={(open) => {
          if (!open) { setDrawerTicketId(null); setDrawerTab("conversa"); }
        }}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] })}
      />
      <WorkItemBlockDialog
        open={Boolean(pausePendingId)}
        onOpenChange={(open) => { if (!open) setPausePendingId(null); }}
        title="Pausar card"
        description="Informe o motivo da pausa — ele fica registrado no histórico do chamado."
        actionLabel="Pausar"
        saving={updateStatusMutation.isPending}
        onConfirm={(reason) => {
          if (pausePendingId) applyMove(pausePendingId, "Pausado", reason);
          setPausePendingId(null);
        }}
      />
    </AppShell>
  );
}
