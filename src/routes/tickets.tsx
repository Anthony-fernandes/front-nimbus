import { useMemo, useState } from "react";
import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Ban,
  Check,
  CheckCheck,
  Clock,
  Eye,
  Filter,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Tags,
  UserRoundCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { TicketWorkflowDialog, type TicketWorkflowDialogSubmitData } from "@/components/tickets/TicketWorkflowDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isClientUser } from "@/lib/auth";
import { formatPriorityLabel, formatTicketStatusLabel } from "@/lib/labels";
import {
  applyTicketListView,
  countActiveTicketFilters,
  DEFAULT_TICKET_ADVANCED_FILTERS,
  getPrimaryTicketTechnician,
  getTicketSortLabel,
  getTicketTechnicianNames,
  isTicketOverdue,
  matchesTicketQuickFilter,
  TICKET_SORT_OPTIONS,
  type TicketAdvancedFilters,
  type TicketQuickFilter,
  type TicketSortBy,
} from "@/lib/ticketList";
import {
  canApproveTickets,
  canCategorizeTickets,
  canFinalizeTickets,
  hasAnyPermission,
  hasPermission,
} from "@/lib/permissions";
import {
  canTransitionTicket,
  getAvailableTicketActions,
  isTicketSlaPaused,
  prepareTicketWorkflowAction,
  type TicketWorkflowActionId,
  type TicketWorkflowActionDefinition,
} from "@/lib/ticketWorkflow";
import {
  getTicketPriorityClass,
  getTicketStatusClass,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
} from "@/lib/tickets";
import type { Ticket, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getStoredUser } from "@/services/authService";
import { listTicketCategories } from "@/services/ticketCategoryService";
import { listTickets, transitionTicket } from "@/services/ticketService";
import { listTicketWorkflowStatuses } from "@/services/ticketWorkflowService";
import { listUsers } from "@/services/userService";

export const Route = createFileRoute("/tickets")({
  head: () => ({ meta: [{ title: "Chamados · Nimbus" }] }),
  component: TicketsPage,
});

const ALL_FILTER_VALUE = "__all__";

const QUICK_FILTER_CARDS: Array<{
  value: TicketQuickFilter;
  label: string;
  color: string;
}> = [
  { value: "open", label: "Abertos", color: "bg-info" },
  { value: "approval", label: "Aprovacao", color: "bg-warning" },
  { value: "in_progress", label: "Em atendimento", color: "bg-primary" },
  { value: "waiting", label: "Aguardando", color: "bg-warning" },
  { value: "late", label: "Atrasados", color: "bg-destructive" },
  { value: "finished", label: "Finalizados", color: "bg-success" },
];

const MODAL_ACTIONS = new Set<TicketWorkflowActionId>([
  "categorize",
  "pause",
  "wait_customer",
  "finish",
  "cancel",
]);

type TicketWorkflowDialogState = {
  ticket: Ticket;
  actionId: TicketWorkflowActionId;
} | null;

function TicketsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentUser = getStoredUser<User>();
  const [activeQuickFilter, setActiveQuickFilter] = useState<TicketQuickFilter | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<TicketAdvancedFilters>(DEFAULT_TICKET_ADVANCED_FILTERS);
  const [sortBy, setSortBy] = useState<TicketSortBy>("recent_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [dialogState, setDialogState] = useState<TicketWorkflowDialogState>(null);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const canViewTickets = hasAnyPermission(currentUser, [
    "tickets.viewAll",
    "tickets.viewAssigned",
    "tickets.viewTeam",
    "tickets.viewOwn",
    "tickets.create",
  ]);
  const { data: tickets = [], isLoading, isError } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => listTickets(),
    enabled: canViewTickets,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: () => listTicketCategories(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["workflow-users"],
    queryFn: () => listUsers(),
  });
  const { data: statusConfigs = [] } = useQuery({
    queryKey: ["ticket-workflow-status-configs"],
    queryFn: () => listTicketWorkflowStatuses(),
  });

  if (pathname !== "/tickets") {
    return <Outlet />;
  }

  const canApprove = canApproveTickets(currentUser);
  const canCategorize = canCategorizeTickets(currentUser);
  const canFinalize = canFinalizeTickets(currentUser);
  const canCreateTickets = hasPermission(currentUser, "tickets.create");
  const canEditTickets = hasPermission(currentUser, "tickets.edit");
  const workflowPermissions = {
    canApprove,
    canCategorize,
    canFinalize,
    canEdit: canEditTickets,
  };
  const technicianUsers = useMemo(
    () => users.filter((user) => !isClientUser(user)),
    [users],
  );

  const stats = QUICK_FILTER_CARDS.map((card) => ({
    ...card,
    count: tickets.filter((ticket) => matchesTicketQuickFilter(ticket, card.value)).length,
  }));

  const statusOptions = useMemo(
    () => buildOrderedOptions(tickets.map((ticket) => ticket.status || "Aberto"), TICKET_STATUS_OPTIONS),
    [tickets],
  );
  const priorityOptions = useMemo(
    () => buildOrderedOptions(tickets.map((ticket) => ticket.priority || "Pendente"), TICKET_PRIORITY_OPTIONS),
    [tickets],
  );
  const clientOptions = useMemo(
    () =>
      buildSortedOptions(
        tickets.map((ticket) => ticket.organization_name || ticket.client_name || ticket.client || ""),
      ),
    [tickets],
  );
  const technicianOptions = useMemo(
    () => buildSortedOptions(tickets.flatMap((ticket) => getTicketTechnicianNames(ticket))),
    [tickets],
  );
  const categoryOptions = useMemo(
    () => buildSortedOptions(tickets.map((ticket) => ticket.category_name || ticket.category || "")),
    [tickets],
  );

  const filteredTickets = useMemo(
    () =>
      applyTicketListView(tickets, {
        activeQuickFilter,
        filters,
        searchTerm,
        sortBy,
      }),
    [activeQuickFilter, filters, searchTerm, sortBy, tickets],
  );

  const activeAdvancedFilterCount = countActiveTicketFilters(filters);
  const hasActiveListControls = Boolean(
    activeQuickFilter || searchTerm.trim() || activeAdvancedFilterCount,
  );

  const resetAdvancedFilters = () => {
    setFilters(DEFAULT_TICKET_ADVANCED_FILTERS);
  };

  const resetAllListControls = () => {
    setActiveQuickFilter(null);
    setSearchTerm("");
    setFilters(DEFAULT_TICKET_ADVANCED_FILTERS);
  };

  const updateFilter = <K extends keyof TicketAdvancedFilters>(
    key: K,
    value: TicketAdvancedFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const runWorkflowAction = async (
    ticket: Ticket,
    actionId: TicketWorkflowActionId,
    formData?: TicketWorkflowDialogSubmitData,
  ) => {
    const targetStatus = getAvailableTicketActions(
      ticket,
      statusConfigs,
      workflowPermissions,
    ).find((action) => action.id === actionId)?.targetStatus;
    if (!targetStatus) {
      return;
    }

    if (!canTransitionTicket(ticket, targetStatus, statusConfigs)) {
      toast.error("Essa transicao nao e permitida para o status atual do chamado.");
      return;
    }

    const preparedAction = prepareTicketWorkflowAction({
      ticket,
      actionId,
      input: formData,
      statusConfigs,
      categories,
      users: technicianUsers,
      currentUser,
    });

    try {
      setWorkflowSaving(true);
      await transitionTicket(ticket.id, preparedAction.transitionPayload);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["ticket", ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ["ticket-timeline", ticket.id] }),
      ]);

      toast.success(preparedAction.successMessage);
      setDialogState(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar o chamado.");
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleActionRequest = (ticket: Ticket, actionId: TicketWorkflowActionId) => {
    const actionDefinition = getAvailableTicketActions(
      ticket,
      statusConfigs,
      workflowPermissions,
    ).find((action) => action.id === actionId);

    if (!actionDefinition) {
      toast.error("Essa acao nao esta disponivel para o status atual.");
      return;
    }

    if (MODAL_ACTIONS.has(actionId)) {
      setDialogState({ ticket, actionId });
      return;
    }

    void runWorkflowAction(ticket, actionId);
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Chamados</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Carregando central..." : `${tickets.length} chamados na central`}
            </p>
          </div>
          {canCreateTickets ? (
            <Button
              asChild
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <a href="/tickets/new">
                <Plus className="h-4 w-4" /> Novo chamado
              </a>
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((item) => {
            const isActive = activeQuickFilter === item.value;

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setActiveQuickFilter((current) => (current === item.value ? null : item.value));
                }}
                className={cn(
                  "glass animate-fade-in-up rounded-xl p-4 text-left transition-all",
                  isActive
                    ? "border-primary/70 bg-primary/10 shadow-glow ring-1 ring-primary/30"
                    : "hover:border-primary/40 hover:-translate-y-0.5",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${item.color}`} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  {isActive ? (
                    <span className="rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Ativo
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-2xl font-semibold">{item.count}</div>
              </button>
            );
          })}
        </div>

        {isError ? (
          <div className="glass rounded-2xl p-4 text-sm text-destructive">
            Nao foi possivel carregar os chamados.
          </div>
        ) : null}

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <div className="border-b border-border p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por ID, titulo, organizacao, categoria, tecnico ou status..."
                  className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="text-muted-foreground transition hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 gap-1.5 border-border bg-muted/40 px-3 text-xs",
                        activeAdvancedFilterCount > 0 && "border-primary/50 bg-primary/10 text-primary",
                      )}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      {activeAdvancedFilterCount > 0
                        ? `Filtros (${activeAdvancedFilterCount})`
                        : "Filtros"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-[min(92vw,34rem)] rounded-2xl border-border bg-background/95 p-0 shadow-card backdrop-blur"
                  >
                    <div className="space-y-4 p-4">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">Filtros avancados</div>
                        <div className="text-xs text-muted-foreground">
                          Ajuste os filtros e a tabela sera atualizada em tempo real.
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <FilterSelectField
                          label="Status"
                          value={filters.status}
                          onChange={(value) => updateFilter("status", value)}
                          options={statusOptions}
                          renderOption={(value) => formatTicketStatusLabel(value)}
                        />
                        <FilterSelectField
                          label="Prioridade"
                          value={filters.priority}
                          onChange={(value) => updateFilter("priority", value)}
                          options={priorityOptions}
                          renderOption={(value) => formatPriorityLabel(value)}
                        />
                        <FilterSelectField
                          label="Organizacao atendida"
                          value={filters.client}
                          onChange={(value) => updateFilter("client", value)}
                          options={clientOptions}
                        />
                        <FilterSelectField
                          label="Tecnico"
                          value={filters.technician}
                          onChange={(value) => updateFilter("technician", value)}
                          options={technicianOptions}
                        />
                        <FilterSelectField
                          label="Categoria"
                          value={filters.category}
                          onChange={(value) => updateFilter("category", value)}
                          options={categoryOptions}
                        />
                        <FilterSelectField
                          label="SLA"
                          value={filters.sla}
                          onChange={(value) =>
                            updateFilter("sla", value as TicketAdvancedFilters["sla"])
                          }
                          options={[
                            { value: "late", label: "Atrasados" },
                            { value: "on_time", label: "Dentro do prazo" },
                          ]}
                        />

                        <div className="space-y-1.5 sm:col-span-2">
                          <div className="text-xs font-medium text-muted-foreground">
                            Periodo de abertura
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Input
                              type="date"
                              value={filters.dateFrom}
                              onChange={(event) => updateFilter("dateFrom", event.target.value)}
                              className="border-border bg-muted/20"
                            />
                            <Input
                              type="date"
                              value={filters.dateTo}
                              onChange={(event) => updateFilter("dateTo", event.target.value)}
                              className="border-border bg-muted/20"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-border/70 px-4 py-3">
                      <div className="text-xs text-muted-foreground">
                        {activeAdvancedFilterCount > 0
                          ? `${activeAdvancedFilterCount} filtro(s) avancado(s) ativo(s)`
                          : "Nenhum filtro avancado ativo"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={resetAdvancedFilters}
                          disabled={activeAdvancedFilterCount === 0}
                        >
                          Limpar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFiltersOpen(false)}
                        >
                          Fechar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover open={sortOpen} onOpenChange={setSortOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 max-w-full gap-1.5 border-border bg-muted/40 px-3 text-xs"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      <span>Ordenar</span>
                      <span className="hidden max-w-[12rem] truncate text-muted-foreground sm:inline">
                        {getTicketSortLabel(sortBy)}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-[min(92vw,20rem)] rounded-2xl border-border bg-background/95 p-2 shadow-card backdrop-blur"
                  >
                    <div className="space-y-1">
                      {TICKET_SORT_OPTIONS.map((option) => {
                        const isActive = sortBy === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setSortBy(option.value);
                              setSortOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-muted/40",
                            )}
                          >
                            <span>{option.label}</span>
                            {isActive ? <Check className="h-4 w-4" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Mostrando {filteredTickets.length} de {tickets.length} chamados
              </span>
              {hasActiveListControls ? (
                <button
                  type="button"
                  onClick={resetAllListControls}
                  className="font-medium text-primary transition hover:opacity-80"
                >
                  Limpar filtros
                </button>
              ) : (
                <span>Ordenado por {getTicketSortLabel(sortBy)}</span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">ID</th>
                  <th className="px-2 py-2.5 text-left font-medium">Titulo</th>
                  <th className="px-2 py-2.5 text-left font-medium">Organizacao atendida</th>
                  <th className="px-2 py-2.5 text-left font-medium">Categoria</th>
                  <th className="px-2 py-2.5 text-left font-medium">Prioridade</th>
                  <th className="px-2 py-2.5 text-left font-medium">Status</th>
                  <th className="px-2 py-2.5 text-left font-medium">Tecnico</th>
                  <th className="px-2 py-2.5 text-left font-medium">SLA</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Carregando chamados...
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <EmptyStateRow
                    title="Nenhum chamado cadastrado ainda."
                    description="Assim que novos chamados forem criados, eles aparecerao aqui."
                  />
                ) : filteredTickets.length === 0 ? (
                  <EmptyStateRow
                    title="Nenhum chamado encontrado com os filtros atuais."
                    description="Tente ajustar a busca, os filtros avancados ou o filtro rapido ativo."
                    actionLabel="Limpar filtros"
                    onAction={resetAllListControls}
                  />
                ) : (
                  filteredTickets.map((ticket) => {
                    const actions = getAvailableTicketActions(ticket, statusConfigs, workflowPermissions);
                    const flowActions = actions.filter(
                      (action) => !["open_details", "edit"].includes(action.id),
                    );

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => navigate({ to: "/tickets/$id", params: { id: ticket.id } })}
                        className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          <Link to="/tickets/$id" params={{ id: ticket.id }} className="hover:text-primary">
                            {ticket.code || ticket.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-2 py-3 font-medium">
                          <Link to="/tickets/$id" params={{ id: ticket.id }} className="hover:text-primary">
                            {ticket.title}
                          </Link>
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {ticket.organization_name || ticket.client_name || ticket.client || "—"}
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {ticket.category_name || ticket.category || "Sem categoria"}
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getTicketPriorityClass(ticket.priority)}`}
                          >
                            {formatPriorityLabel(ticket.priority || "Pendente")}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <span className={`rounded-md px-2 py-1 text-[11px] ${getTicketStatusClass(ticket.status)}`}>
                            {formatTicketStatusLabel(ticket.status || "Aberto")}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {getPrimaryTicketTechnician(ticket) || "—"}
                        </td>
                        <td className="px-2 py-3">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1 text-xs ${
                                isTicketOverdue(ticket) ? "font-medium text-destructive" : "text-muted-foreground"
                              }`}
                            >
                              <Clock className="h-3 w-3" /> {ticket.sla || "8h"}
                            </span>
                            {isTicketSlaPaused(ticket, statusConfigs) ? (
                              <div className="text-[10px] font-medium uppercase tracking-wider text-warning">
                                SLA pausado
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <TicketRowActions
                            ticket={ticket}
                            actions={actions}
                            hasWorkflowActions={flowActions.length > 0}
                            onOpenDetails={() =>
                              navigate({ to: "/tickets/$id", params: { id: ticket.id } })
                            }
                            onEdit={() =>
                              navigate({ to: "/tickets/$id/edit", params: { id: ticket.id } })
                            }
                            onAction={(actionId) => handleActionRequest(ticket, actionId)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TicketWorkflowDialog
        open={Boolean(dialogState)}
        actionId={dialogState?.actionId || null}
        ticket={dialogState?.ticket || null}
        categories={categories}
        users={technicianUsers}
        saving={workflowSaving}
        onOpenChange={(open) => {
          if (!open) {
            setDialogState(null);
          }
        }}
        onSubmit={async (formData) => {
          if (!dialogState) {
            return;
          }

          await runWorkflowAction(dialogState.ticket, dialogState.actionId, formData);
        }}
      />
    </AppShell>
  );
}

function TicketRowActions({
  ticket,
  actions,
  hasWorkflowActions,
  onOpenDetails,
  onEdit,
  onAction,
}: {
  ticket: Ticket;
  actions: TicketWorkflowActionDefinition[];
  hasWorkflowActions: boolean;
  onOpenDetails: () => void;
  onEdit: () => void;
  onAction: (actionId: TicketWorkflowActionId) => void;
}) {
  const [open, setOpen] = useState(false);
  const primaryActions = actions.filter((action) => ["open_details", "edit"].includes(action.id));
  const workflowActions = actions.filter((action) => !["open_details", "edit"].includes(action.id));

  const runMenuAction = (event: Event, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    action();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
          aria-label={`Acoes do chamado ${ticket.code || ticket.id}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 rounded-xl border-border bg-background/95 shadow-card backdrop-blur"
        onClick={(event) => {
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <DropdownMenuLabel>Chamado</DropdownMenuLabel>
        {primaryActions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            onSelect={(event) => {
              runMenuAction(event, () => {
                if (action.id === "open_details") {
                  onOpenDetails();
                  return;
                }

                if (action.id === "edit") {
                  onEdit();
                }
              });
            }}
          >
            {getActionIcon(action.id)}
            {action.label}
          </DropdownMenuItem>
        ))}

        {hasWorkflowActions ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Fluxo</DropdownMenuLabel>
            {workflowActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                className={action.destructive ? "text-destructive focus:text-destructive" : undefined}
                onSelect={(event) => {
                  runMenuAction(event, () => {
                    onAction(action.id);
                  });
                }}
              >
                {getActionIcon(action.id)}
                {action.label}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getActionIcon(actionId: TicketWorkflowActionId) {
  switch (actionId) {
    case "open_details":
      return <Eye />;
    case "edit":
      return <Pencil />;
    case "approve":
      return <ShieldCheck />;
    case "reject":
    case "cancel":
      return <Ban />;
    case "categorize":
      return <Tags />;
    case "start_service":
    case "resume_service":
      return <Play />;
    case "wait_customer":
      return <UserRoundCheck />;
    case "send_validation":
      return <CheckCheck />;
    case "pause":
      return <Pause />;
    case "finish":
      return <Check />;
    default:
      return <MoreHorizontal />;
  }
}

function buildOrderedOptions(values: string[], preferredValues: readonly string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const addValue = (value: string) => {
    const nextValue = value.trim();
    if (!nextValue) {
      return;
    }

    const key = nextValue
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    ordered.push(nextValue);
  };

  preferredValues.forEach(addValue);
  buildSortedOptions(values).forEach(addValue);

  return ordered;
}

function buildSortedOptions(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "pt-BR", { sensitivity: "base" }),
  );
}

function FilterSelectField({
  label,
  value,
  onChange,
  options,
  renderOption,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { value: string; label: string }>;
  renderOption?: (value: string) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <Select
        value={value || ALL_FILTER_VALUE}
        onValueChange={(nextValue) => {
          onChange(nextValue === ALL_FILTER_VALUE ? "" : nextValue);
        }}
      >
        <SelectTrigger className="border-border bg-muted/20">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
          {options.map((option) => {
            const optionValue = typeof option === "string" ? option : option.value;
            const optionLabel = typeof option === "string" ? option : option.label;

            return (
              <SelectItem key={optionValue} value={optionValue}>
                {renderOption ? renderOption(optionValue) : optionLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyStateRow({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <tr>
      <td colSpan={9} className="px-4 py-10">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div className="text-sm font-medium">{title}</div>
          <div className="max-w-md text-sm text-muted-foreground">{description}</div>
          {actionLabel && onAction ? (
            <Button type="button" variant="outline" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
