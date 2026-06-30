import { useMemo, useState, useEffect, useRef } from "react";
import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Ban,
  Bookmark,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/services/api";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { TableSkeleton } from "@/components/app/TableSkeleton";
import { EmptyState } from "@/components/app/EmptyState";
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
import { parseApiError } from "@/services/utils";

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
  { value: "approval", label: "Aprovação", color: "bg-warning" },
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

type BulkActionType = "technician" | "status" | "priority" | null;

const TICKET_PRIORITY_BULK_OPTIONS = ["Critica", "Alta", "Media", "Baixa", "Pendente"];

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkActionType>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Saved filters (localStorage)
  type SavedFilter = { name: string; filters: TicketAdvancedFilters };
  const SAVED_FILTERS_KEY = "ticket_saved_filters";
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || "[]") as SavedFilter[];
    } catch {
      return [];
    }
  });
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");
  const saveFilterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (saveFilterOpen && saveFilterInputRef.current) {
      saveFilterInputRef.current.focus();
    }
  }, [saveFilterOpen]);

  const persistSavedFilters = (next: SavedFilter[]) => {
    setSavedFilters(next);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(next));
  };

  const handleSaveFilter = () => {
    const name = saveFilterName.trim();
    if (!name) return;
    const next: SavedFilter[] = [...savedFilters.filter((f) => f.name !== name), { name, filters }];
    persistSavedFilters(next);
    setSaveFilterName("");
    setSaveFilterOpen(false);
  };

  const handleLoadSavedFilter = (saved: SavedFilter) => {
    setFilters(saved.filters);
  };

  const handleDeleteSavedFilter = (name: string) => {
    persistSavedFilters(savedFilters.filter((f) => f.name !== name));
  };

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

  if (pathname !== "/tickets") {
    return <Outlet />;
  }

  const resetAdvancedFilters = () => {
    setFilters(DEFAULT_TICKET_ADVANCED_FILTERS);
  };

  const resetAllListControls = () => {
    setActiveQuickFilter(null);
    setSearchTerm("");
    setFilters(DEFAULT_TICKET_ADVANCED_FILTERS);
  };

  const toggleTicketSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTickets.length && filteredTickets.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTickets.map((t) => t.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkAction(null);
    setBulkValue("");
  };

  const applyBulkAction = async () => {
    if (!bulkValue || selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      const fieldMap: Record<string, string> = {
        technician: "responsible_technician",
        status: "status",
        priority: "priority",
      };
      const field = fieldMap[bulkAction!];
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.patch(`/tickets/${id}/`, { [field]: bulkValue }),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(`${selectedIds.size} chamado(s) atualizado(s).`);
      clearSelection();
    } catch {
      toast.error("Não foi possível aplicar a ação em massa.");
    } finally {
      setBulkSaving(false);
    }
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
      toast.error("Essa transição não é permitida para o status atual do chamado.");
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
      toast.error(parseApiError(error, "Não foi possível atualizar o chamado."));
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
      toast.error("Essa ação não está disponível para o status atual.");
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
            Não foi possível carregar os chamados.
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
                  placeholder="Buscar por ID, título, organização, categoria, técnico ou status..."
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
                        <div className="text-sm font-semibold">Filtros avançados</div>
                        <div className="text-xs text-muted-foreground">
                          Ajuste os filtros e a tabela será atualizada em tempo real.
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
                          label="Organização atendida"
                          value={filters.client}
                          onChange={(value) => updateFilter("client", value)}
                          options={clientOptions}
                        />
                        <FilterSelectField
                          label="Técnico"
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
                            Período de abertura
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
                          ? `${activeAdvancedFilterCount} filtro(s) avançado(s) ativo(s)`
                          : "Nenhum filtro avançado ativo"}
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

            {/* Saved filter chips */}
            {savedFilters.length > 0 || activeAdvancedFilterCount > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {savedFilters.map((saved) => (
                  <span
                    key={saved.name}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadSavedFilter(saved)}
                      className="font-medium"
                    >
                      {saved.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedFilter(saved.name)}
                      aria-label={`Remover filtro ${saved.name}`}
                      className="ml-0.5 opacity-70 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {activeAdvancedFilterCount > 0 ? (
                  <div className="relative">
                    {saveFilterOpen ? (
                      <div className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1">
                        <input
                          ref={saveFilterInputRef}
                          value={saveFilterName}
                          onChange={(e) => setSaveFilterName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveFilter();
                            if (e.key === "Escape") setSaveFilterOpen(false);
                          }}
                          placeholder="Nome do filtro..."
                          className="w-32 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                        />
                        <button
                          type="button"
                          onClick={handleSaveFilter}
                          className="text-primary text-xs font-medium"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setSaveFilterOpen(false)}
                          className="text-muted-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSaveFilterOpen(true)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                      >
                        <Bookmark className="h-3 w-3" /> Salvar filtro
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

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

          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={9} />
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nenhum chamado cadastrado ainda."
                description="Assim que novos chamados forem criados, eles aparecerão aqui."
              />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nenhum chamado encontrado"
                description="Tente ajustar os filtros ou crie um novo chamado."
                action={
                  <button
                    type="button"
                    onClick={resetAllListControls}
                    className="text-xs text-primary underline"
                  >
                    Limpar filtros
                  </button>
                }
              />
            </div>
          ) : (
            <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => navigate({ to: "/tickets/$id", params: { id: ticket.id } })}
                  className="cursor-pointer p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs text-muted-foreground">{(ticket as { code?: string }).code || ticket.id.slice(0, 8)}</div>
                      <div className="mt-0.5 font-medium text-sm truncate">{ticket.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{(ticket as { department_name?: string; organization_name?: string; client_name?: string }).department_name || (ticket as { organization_name?: string; client_name?: string }).organization_name || (ticket as { organization_name?: string; client_name?: string }).client_name || "—"}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getTicketPriorityClass(ticket.priority)}`}>
                        {formatPriorityLabel(ticket.priority || "Pendente")}
                      </span>
                      <span className={`rounded-md px-2 py-1 text-[11px] ${getTicketStatusClass(ticket.status)}`}>
                        {formatTicketStatusLabel(ticket.status || "Aberto")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">
                      <Checkbox
                        checked={selectedIds.size === filteredTickets.length && filteredTickets.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todos"
                      />
                    </th>
                    <th className="px-2 py-2.5 text-left font-medium">ID</th>
                    <th className="px-2 py-2.5 text-left font-medium">Título</th>
                    <th className="hidden lg:table-cell px-2 py-2.5 text-left font-medium">Organização atendida</th>
                    <th className="hidden lg:table-cell px-2 py-2.5 text-left font-medium">Categoria</th>
                    <th className="px-2 py-2.5 text-left font-medium">Prioridade</th>
                    <th className="px-2 py-2.5 text-left font-medium">Status</th>
                    <th className="hidden lg:table-cell px-2 py-2.5 text-left font-medium">Técnico</th>
                    <th className="hidden lg:table-cell px-2 py-2.5 text-left font-medium">SLA</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => {
                    const actions = getAvailableTicketActions(ticket, statusConfigs, workflowPermissions);
                    const flowActions = actions.filter(
                      (action) => !["open_details", "edit"].includes(action.id),
                    );
                    const isSelected = selectedIds.has(ticket.id);

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => navigate({ to: "/tickets/$id", params: { id: ticket.id } })}
                        className={cn(
                          "cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/30",
                          isSelected && "bg-primary/5",
                        )}
                      >
                        <td
                          className="px-4 py-3"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleTicketSelection(ticket.id)}
                            aria-label={`Selecionar chamado ${ticket.code || ticket.id}`}
                          />
                        </td>
                        <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                          <Link to="/tickets/$id" params={{ id: ticket.id }} className="hover:text-primary">
                            {ticket.code || ticket.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-2 py-3 font-medium">
                          <Link to="/tickets/$id" params={{ id: ticket.id }} className="hover:text-primary">
                            {ticket.title}
                          </Link>
                        </td>
                        <td className="hidden lg:table-cell px-2 py-3 text-muted-foreground">
                          {(ticket as { department_name?: string }).department_name || ticket.organization_name || ticket.client_name || ticket.client || "—"}
                        </td>
                        <td className="hidden lg:table-cell px-2 py-3 text-muted-foreground">
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
                        <td className="hidden lg:table-cell px-2 py-3 text-muted-foreground">
                          {getPrimaryTicketTechnician(ticket) || "—"}
                        </td>
                        <td className="hidden lg:table-cell px-2 py-3">
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
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 ? (
          <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-background/95 px-5 py-3 shadow-card backdrop-blur">
            <span className="text-sm font-medium text-muted-foreground">
              {selectedIds.size} selecionado(s)
            </span>
            <div className="h-4 w-px bg-border" />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              disabled={bulkSaving}
              onClick={() => {
                setBulkAction("status");
                setBulkValue("Finalizado");
              }}
            >
              <Check className="h-3.5 w-3.5" /> Fechar selecionados
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setBulkAction("technician")}
            >
              <UserRoundCheck className="h-3.5 w-3.5" /> Atribuir técnico
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={clearSelection}
            >
              <X className="h-3.5 w-3.5" /> Cancelar seleção
            </Button>
          </div>
        ) : null}

        {/* Bulk close confirmation */}
        <Dialog
          open={bulkAction === "status" && bulkValue === "Finalizado"}
          onOpenChange={(open) => {
            if (!open) {
              setBulkAction(null);
              setBulkValue("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Fechar chamados selecionados</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja fechar {selectedIds.size} chamado(s)? O status será alterado para "Finalizado".
            </p>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setBulkAction(null);
                  setBulkValue("");
                }}
              >
                Cancelar
              </Button>
              <Button disabled={bulkSaving} onClick={applyBulkAction}>
                {bulkSaving ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk assign technician dialog */}
        <Dialog
          open={bulkAction === "technician" && bulkValue === ""}
          onOpenChange={(open) => {
            if (!open) {
              setBulkAction(null);
              setBulkValue("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atribuir técnico</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-2">
              Selecione o técnico para atribuir aos {selectedIds.size} chamado(s) selecionado(s).
            </p>
            <Select onValueChange={(val) => setBulkValue(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar técnico..." />
              </SelectTrigger>
              <SelectContent>
                {technicianUsers.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.name || user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setBulkAction(null);
                  setBulkValue("");
                }}
              >
                Cancelar
              </Button>
              <Button disabled={bulkSaving || !bulkValue} onClick={applyBulkAction}>
                {bulkSaving ? "Salvando..." : "Atribuir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
          aria-label={`Ações do chamado ${ticket.code || ticket.id}`}
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
