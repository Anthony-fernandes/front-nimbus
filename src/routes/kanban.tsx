import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MessageSquare, MoreHorizontal, Paperclip } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import type { Ticket } from "@/lib/types";
import { listTickets, updateTicket } from "@/services/ticketService";
import { listUsers } from "@/services/userService";

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

const statusCols = [
  { name: "Triagem", label: "Backlog", accent: "bg-muted-foreground" },
  { name: "Em atendimento", label: "Em progresso", accent: "bg-primary" },
  { name: "Aguardando cliente", label: "Aguardando", accent: "bg-warning" },
  { name: "Valida\u00e7\u00e3o", label: "Homologacao", accent: "bg-accent" },
  { name: "Pausado", label: "Pausado", accent: "bg-info" },
  { name: "Finalizado", label: "Finalizado", accent: "bg-success" },
] as const;

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

  const { data: users = [] } = useQuery({ queryKey: ["form-users"], queryFn: listUsers });

  useEffect(() => {
    setLocalTickets(tickets);
  }, [tickets]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: string }) =>
      updateTicket(ticketId, { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      ]);
    },
  });

  const groupedTickets = useMemo(
    () => statusCols.map(column => ({
      ...column,
      cards: localTickets
        .filter(t => (t.status || "Triagem") === column.name)
        .filter(t => !filterTech || (t.technicians || []).map(String).includes(filterTech))
        .filter(t => !filterPriority || t.priority === filterPriority),
    })),
    [localTickets, filterTech, filterPriority],
  );

  const moveTicketToStatus = (ticketId: string, nextStatus: string) => {
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
      { ticketId, status: nextStatus },
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

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-6.5rem)] flex-col gap-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
            <p className="text-sm text-muted-foreground">
              Fluxo de trabalho · {localTickets.length} cards
            </p>
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
                      <Link
                        to="/tickets/$id"
                        params={{ id: card.id }}
                        className="text-[10px] font-mono text-muted-foreground hover:text-primary"
                      >
                        {card.code || card.id.slice(0, 8)}
                      </Link>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityClr[card.priority || "M\u00e9dia"]}`}
                      >
                        {card.priority || "M\u00e9dia"}
                      </span>
                    </div>
                    <Link
                      to="/tickets/$id"
                      params={{ id: card.id }}
                      className="mt-1.5 block text-sm leading-snug hover:text-primary"
                    >
                      {card.title}
                    </Link>
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
    </AppShell>
  );
}
