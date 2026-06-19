import { useMemo, useState, type ReactNode } from "react";
import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Ban,
  BookOpen,
  Check,
  CheckCheck,
  Clock,
  Link2,
  Pause,
  Pencil,
  Play,
  ShieldCheck,
  Tags,
  TicketCheck,
  UserRoundCheck,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { PageHeader } from "@/components/app/PageHeader";
import { TicketApprovalPanel } from "@/components/tickets/TicketApprovalPanel";
import { TicketRatingPanel } from "@/components/tickets/TicketRatingPanel";
import { TicketWorkflowDialog, type TicketWorkflowDialogSubmitData } from "@/components/tickets/TicketWorkflowDialog";
import { TicketTimeline } from "@/components/tickets/TicketTimeline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatPriorityLabel, formatTicketStatusLabel } from "@/lib/labels";
import { isClientUser } from "@/lib/auth";
import {
  canApproveTickets,
  canCategorizeTickets,
  canFinalizeTickets,
  hasAnyPermission,
  hasPermission,
} from "@/lib/permissions";
import {
  buildTicketTimeline,
  buildSprintBacklogItems,
  findTicketCategory,
  getTicketPriorityClass,
  getTicketStatusClass,
} from "@/lib/tickets";
import {
  canTransitionTicket,
  getAvailableTicketActions,
  getTicketStatusConfig,
  isTicketSlaPaused,
  prepareTicketWorkflowAction,
  type TicketWorkflowActionDefinition,
  type TicketWorkflowActionId,
} from "@/lib/ticketWorkflow";
import type { Ticket, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getStoredUser } from "@/services/authService";
import { listActivities } from "@/services/activityService";
import { listSprints } from "@/services/sprintService";
import { listTicketCategories } from "@/services/ticketCategoryService";
import { listTicketTimeline, createTicketTimelineComment } from "@/services/ticketTimelineService";
import { convertTicketToKb, listKnowledgeCategories } from "@/services/knowledgeService";
import { deleteTicket, getTicket, transitionTicket } from "@/services/ticketService";
import { listTicketWorkflowStatuses } from "@/services/ticketWorkflowService";
import { listUsers } from "@/services/userService";
import { formatDate, formatDateTime } from "@/services/utils";

export const Route = createFileRoute("/tickets/$id")({
  head: () => ({ meta: [{ title: "Detalhes do chamado - Nimbus" }] }),
  component: TicketDetail,
});

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

function TicketDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentUser = getStoredUser<User>();
  const [dialogState, setDialogState] = useState<TicketWorkflowDialogState>(null);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [confirmGenerateActivityOpen, setConfirmGenerateActivityOpen] = useState(false);
  const [convertKbOpen, setConvertKbOpen] = useState(false);
  const [convertKbCategory, setConvertKbCategory] = useState<string>("");
  const canViewTickets = hasAnyPermission(currentUser, [
    "tickets.viewAll",
    "tickets.viewAssigned",
    "tickets.viewTeam",
    "tickets.viewOwn",
  ]);

  const ticketQuery = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => getTicket(id),
    enabled: canViewTickets,
  });
  const activitiesQuery = useQuery({
    queryKey: ["ticket-activities", id],
    queryFn: () => listActivities({ ticket: id }),
    enabled: canViewTickets,
  });
  const categoriesQuery = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: () => listTicketCategories(),
    enabled: canViewTickets,
  });
  const sprintsQuery = useQuery({
    queryKey: ["sprints"],
    queryFn: () => listSprints(),
    enabled: canViewTickets,
  });
  const timelineQuery = useQuery({
    queryKey: ["ticket-timeline", id],
    queryFn: () => listTicketTimeline(id),
    enabled: canViewTickets,
  });
  const usersQuery = useQuery({
    queryKey: ["workflow-users"],
    queryFn: () => listUsers(),
    enabled: canViewTickets,
  });
  const statusConfigsQuery = useQuery({
    queryKey: ["ticket-workflow-status-configs"],
    queryFn: () => listTicketWorkflowStatuses(),
    enabled: canViewTickets,
  });
  const kbCategoriesQuery = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: listKnowledgeCategories,
    enabled: convertKbOpen,
  });
  const convertToKbMutation = useMutation({
    mutationFn: () => ticketQuery.data ? convertTicketToKb(ticketQuery.data.id, convertKbCategory || undefined) : Promise.reject(),
    onSuccess: (article) => {
      setConvertKbOpen(false);
      toast.success("Artigo criado na Base de Conhecimento!", {
        action: { label: "Ver artigo →", onClick: () => navigate({ to: "/knowledge/$id", params: { id: article.id } }) },
      });
    },
    onError: () => toast.error("Não foi possível converter o chamado."),
  });

  if (pathname !== `/tickets/${id}`) {
    return <Outlet />;
  }

  if (ticketQuery.isLoading) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
          Carregando chamado...
        </div>
      </AppShell>
    );
  }

  const ticket = ticketQuery.data;
  const activities = activitiesQuery.data || [];
  const categories = categoriesQuery.data || [];
  const sprints = sprintsQuery.data || [];
  const users = usersQuery.data || [];
  const statusConfigs = statusConfigsQuery.data || [];

  if (!ticket) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-destructive">
          Chamado nao encontrado.
        </div>
      </AppShell>
    );
  }

  const timeline = buildTicketTimeline(
    {
      ...ticket,
      timeline: [...(ticket.timeline || []), ...(timelineQuery.data || [])],
    },
    { categories, activities, sprints },
  );
  const checklist = ticket.checklist || [];
  const checklistDone = checklist.filter((item) => item.done).length;
  const checklistProgress = checklist.length
    ? Math.round((checklistDone / checklist.length) * 100)
    : 0;
  const canApprove = canApproveTickets(currentUser);
  const canCategorize = canCategorizeTickets(currentUser);
  const canFinalize = canFinalizeTickets(currentUser);
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
  const workflowActions = getAvailableTicketActions(ticket, statusConfigs, workflowPermissions);
  const workflowTransitionActions = workflowActions.filter(
    (action) => !["open_details", "edit"].includes(action.id),
  );
  const currentStatusConfig = getTicketStatusConfig(ticket.status, statusConfigs);
  const currentCategory = findTicketCategory(
    categories,
    ticket.category_id || ticket.category_name || ticket.category,
  );
  const linkedActivityIds = Array.from(
    new Set(
      [
        ticket.linked_activity || "",
        ...(ticket.linked_activities || []),
        ...activities.map((activity) => activity.id),
      ].filter(Boolean),
    ),
  );
  const canGenerateActivity =
    !currentStatusConfig?.is_final && (currentCategory ? currentCategory.allow_project_activity !== false : true);
  const sprintEntries = sprints
    .map((sprint) => ({
      sprint,
      backlogItems: buildSprintBacklogItems(sprint.backlog, [ticket], activities),
    }))
    .filter(({ backlogItems }) =>
      backlogItems.some((item) => item.item_type === "ticket" && item.item_id === ticket.id),
    );

  const runWorkflowAction = async (
    actionId: TicketWorkflowActionId,
    formData?: TicketWorkflowDialogSubmitData,
  ) => {
    const actionDefinition = workflowTransitionActions.find((action) => action.id === actionId);
    if (!actionDefinition?.targetStatus) {
      toast.error("Essa acao nao esta disponivel para o status atual.");
      return;
    }

    if (!canTransitionTicket(ticket, actionDefinition.targetStatus, statusConfigs)) {
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
        queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["ticket-timeline", id] }),
      ]);

      toast.success(preparedAction.successMessage);
      setDialogState(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar o chamado.");
    } finally {
      setWorkflowSaving(false);
    }
  };

  const requestWorkflowAction = (actionId: TicketWorkflowActionId) => {
    const actionDefinition = workflowTransitionActions.find((action) => action.id === actionId);
    if (!actionDefinition) {
      toast.error("Essa acao nao esta disponivel para o status atual.");
      return;
    }

    if (MODAL_ACTIONS.has(actionId)) {
      setDialogState({ ticket, actionId });
      return;
    }

    void runWorkflowAction(actionId);
  };

  const publishComment = async ({
    message,
    visibility,
  }: {
    message: string;
    visibility: "internal" | "client";
  }) => {
    try {
      await createTicketTimelineComment({ ticket: id, message, visibility });
      await queryClient.invalidateQueries({ queryKey: ["ticket-timeline", id] });
      toast.success("Interacao registrada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "A API atual ainda nao suporta comentarios independentes.",
      );
    }
  };

  const openGenerateActivityForm = (forceDuplicate = false) => {
    const params = new URLSearchParams();
    params.set("ticket", ticket.id);

    if (ticket.project) {
      params.set("project", ticket.project);
    }

    if (forceDuplicate) {
      params.set("forceDuplicate", "1");
    }

    window.location.assign(`/activities/new?${params.toString()}`);
  };

  const handleGenerateActivity = () => {
    if (linkedActivityIds.length > 0) {
      setConfirmGenerateActivityOpen(true);
      return;
    }

    openGenerateActivityForm();
  };

  const workflowContext =
    ticket.pause_reason
    || ticket.waiting_reason
    || ticket.validation_notes
    || ticket.triage_notes
    || ticket.resolution_description
    || ticket.cancel_reason
    || ticket.internal_notes
    || "";

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Chamados", to: "/tickets" }, { label: ticket.code || id }]}
          title={
            <span className="flex items-center gap-3">
              <span className="font-mono text-sm text-muted-foreground">
                {ticket.code || id}
              </span>
              <span>{ticket.title}</span>
            </span>
          }
          subtitle={`${ticket.organization_name || ticket.client_name || "Sem organizacao"} · ${ticket.requester_user_name || ticket.requester || "Sem solicitante"} · aberto em ${formatDate(ticket.opened_at)}`}
          badges={
            <span className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getTicketPriorityClass(ticket.priority)}`}
              >
                {formatPriorityLabel(ticket.priority || "Pendente")}
              </span>
              <span className={`rounded-md px-2 py-1 text-[11px] ${getTicketStatusClass(ticket.status)}`}>
                {formatTicketStatusLabel(ticket.status || "Aberto")}
              </span>
              {isTicketSlaPaused(ticket, statusConfigs) ? (
                <span className="rounded-md bg-warning/15 px-2 py-1 text-[11px] font-medium text-warning">
                  SLA pausado
                </span>
              ) : null}
            </span>
          }
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    toast.success("Link copiado!");
                  }).catch(() => {
                    toast.error("Nao foi possivel copiar o link.");
                  });
                }}
              >
                <Link2 className="h-3.5 w-3.5" /> Compartilhar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to="/tickets/$id/edit" params={{ id }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Link>
              </Button>
              {canGenerateActivity ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleGenerateActivity}
                >
                  <Workflow className="h-3.5 w-3.5" /> Gerar atividade
                </Button>
              ) : null}
              {canApprove || canEditTickets ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setConvertKbOpen(true)}
                >
                  <BookOpen className="h-3.5 w-3.5" /> Converter para KB
                </Button>
              ) : null}
              <ConfirmDelete
                onConfirm={async () => {
                  await deleteTicket(id);
                  toast.success("Chamado excluido.");
                  navigate({ to: "/tickets" });
                }}
              />
            </>
          }
        />

        <TicketApprovalPanel
          ticket={ticket}
          currentUser={currentUser}
          onChanged={() => ticketQuery.refetch()}
        />
        <TicketRatingPanel ticket={ticket} currentUser={currentUser} onChanged={() => ticketQuery.refetch()} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="SLA" value={ticket.sla || "8h"} icon={Clock} />
          <StatCard label="Horas estimadas" value={`${ticket.est_hours || 0}h`} icon={TicketCheck} />
          <StatCard label="Horas trabalhadas" value={`${ticket.done_hours || 0}h`} icon={Activity} />
          <StatCard label="Atividades" value={String(activities.length)} icon={Workflow} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="glass space-y-4 rounded-2xl p-5 shadow-card">
              {workflowContext ? (
                <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                  {workflowContext}
                </div>
              ) : null}

              {workflowTransitionActions.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                  Nenhuma ação de fluxo disponível para o status atual.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {workflowTransitionActions.map((action) => (
                    <Button
                      key={action.id}
                      type="button"
                      size="sm"
                      variant={action.destructive ? "outline" : "default"}
                      className={cn(
                        "gap-1.5",
                        action.destructive
                          ? "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          : action.id === "categorize"
                            ? "border-primary/45 bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary"
                          : action.id === "finish"
                            ? "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                            : "border-border bg-muted/20 text-foreground hover:bg-muted/40",
                      )}
                      onClick={() => requestWorkflowAction(action.id)}
                    >
                      {getActionIcon(action)}
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <SectionCard
              title="Dados da solicitacao"
              description="Descricao original, urgencia informada e anexos do chamado."
            >
              <dl className="grid gap-3 sm:grid-cols-2">
                <DataRow label="Tipo" value={ticket.type || "Solicitacao"} />
                <DataRow label="Urgencia" value={ticket.urgency || "Media"} />
                <DataRow label="Origem" value={ticket.origin || "Portal da organizacao"} />
                <DataRow label="Criado em" value={formatDateTime(ticket.opened_at || ticket.created_at)} />
              </dl>
              <div className="rounded-xl border border-border bg-muted/15 p-4 text-sm leading-relaxed">
                {ticket.description || "Sem descricao cadastrada."}
              </div>
              <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                {ticket.attachments?.length
                  ? `${ticket.attachments.length} anexo(s) registrados pela API.`
                  : "A API atual ainda pode nao expor anexos. A interface ja esta preparada para isso."}
              </div>
            </SectionCard>

            <SectionCard
              title="Categorização interna"
              description="Categoria, subcategoria, prioridade, SLA e regras do atendimento."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DataRow label="Categoria" value={ticket.category_name || ticket.category || "-"} />
                <DataRow label="Subcategoria" value={ticket.subcategory || "-"} />
                <DataRow label="Tipo" value={ticket.type || "-"} />
                <DataRow label="Prioridade" value={ticket.priority || "Pendente"} />
                <DataRow label="Impacto" value={ticket.impact || "Pendente"} />
                <DataRow label="SLA" value={ticket.sla || "8h"} />
                <DataRow label="Exige aprovação" value={ticket.approval_required ? "Sim" : "Não"} />
                <DataRow
                  label="Avaliação do cliente"
                  value={ticket.requires_client_validation ? "Sim" : "Não"}
                />
                <DataRow label="Equipe responsavel" value={ticket.team || "-"} />
              </div>

              {ticket.triage_notes ? (
                <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                  {ticket.triage_notes}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title="Atendimento técnico"
              description="Responsáveis, esforço, checklist e atividades ligadas ao chamado."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <DataRow
                  label="Responsavel tecnico"
                  value={ticket.responsible_technician_name || ticket.technician_names?.[0] || "-"}
                />
                <DataRow
                  label="Tecnicos envolvidos"
                  value={ticket.technician_names?.join(", ") || "-"}
                />
                <DataRow label="Horas estimadas" value={`${ticket.est_hours || 0}h`} />
                <DataRow label="Horas trabalhadas" value={`${ticket.done_hours || 0}h`} />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Checklist técnico</div>
                {checklist.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                    Nenhum item de checklist registrado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {checklist.map((item, index) => (
                      <div
                        key={`${item.text}-${index}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3"
                      >
                        <span
                          className={`h-4 w-4 rounded border ${item.done ? "border-success bg-success" : "border-border"}`}
                        />
                        <span className={`text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Atividades vinculadas</div>
                {activities.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                    Nenhuma atividade vinculada ainda.
                  </div>
                ) : (
                  activities.map((activity) => (
                    <Link
                      key={activity.id}
                      to="/activities/$id"
                      params={{ id: activity.id }}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/10 px-4 py-3 transition-colors hover:border-primary/40"
                    >
                      <div>
                        <div className="text-sm font-medium">{activity.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {activity.project_name || "Sem projeto"} · {activity.status || "Backlog"}
                        </div>
                      </div>
                      <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                        {activity.type || "Atividade"}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </SectionCard>

            {ticket.custom_values && ticket.custom_values.length > 0 ? (
              <SectionCard
                title="Campos extras"
                description="Campos personalizados configurados para este tipo de chamado."
              >
                <dl className="grid gap-3 sm:grid-cols-2">
                  {ticket.custom_values.map((cv) => (
                    <DataRow key={cv.id} label={cv.field_label} value={cv.value || "-"} />
                  ))}
                </dl>
              </SectionCard>
            ) : null}

            <TicketTimeline events={timeline} allowComposer onCommentSubmit={publishComment} />

            <SectionCard
              title="Sprint / Planejamento"
              description="Historico de alocacao do chamado em sprints, sem depender de projeto."
            >
              {sprintEntries.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                  Este chamado ainda nao entrou no backlog de nenhuma sprint.
                </div>
              ) : (
                <div className="space-y-2">
                  {sprintEntries.map(({ sprint }) => (
                    <Link
                      key={sprint.id}
                      to="/sprints/$id"
                      params={{ id: sprint.id }}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/10 px-4 py-3 transition-colors hover:border-primary/40"
                    >
                      <div>
                        <div className="text-sm font-medium">{sprint.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(sprint.start_at)} a {formatDate(sprint.end_at)}
                        </div>
                      </div>
                      <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                        {sprint.status || "Planejada"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <aside className="space-y-4">
            <SectionCard title="Cabeçalho do chamado">
              <div className="space-y-2 text-sm">
                <DataRow
                  label="Organizacao atendida"
                  value={ticket.organization_name || ticket.client_name || "-"}
                />
                <DataRow label="Solicitante" value={ticket.requester_user_name || ticket.requester || "-"} />
                <DataRow
                  label="Contato responsavel"
                  value={formatContactResponsible(ticket)}
                />
                <DataRow label="Status" value={formatTicketStatusLabel(ticket.status || "Aberto")} />
                <DataRow label="Aberto em" value={formatDateTime(ticket.opened_at || ticket.created_at)} />
                <DataRow label="Prazo" value={formatDate(ticket.due_at)} />
                <DataRow label="Finalizado em" value={formatDateTime(ticket.finished_at)} />
              </div>
            </SectionCard>

            <SectionCard title="Marcos do workflow">
              <div className="space-y-2 text-sm">
                <DataRow label="Triagem concluída" value={formatNullableDateTime(ticket.triage_completed_at) || "Não"} />
                <DataRow label="Atendimento iniciado" value={formatNullableDateTime(ticket.started_at) || "Não"} />
                <DataRow label="Pausado em" value={formatNullableDateTime(ticket.paused_at) || "-"} />
                <DataRow label="Cancelado em" value={formatNullableDateTime(ticket.canceled_at) || "-"} />
                <DataRow label="Motivo da pausa" value={ticket.pause_reason || "-"} />
                <DataRow label="Motivo da espera" value={ticket.waiting_reason || "-"} />
              </div>
            </SectionCard>

            <SectionCard title="Progresso do checklist">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {checklistDone} de {checklist.length} concluidos
                </div>
                <div className="text-sm font-medium">{checklistProgress}%</div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-primary"
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>
            </SectionCard>

            <SectionCard title="Conversão e vínculos">
              <div className="space-y-2 text-sm">
                <DataRow
                  label="Atividade principal"
                  value={ticket.linked_activity_name || ticket.linked_activity || "-"}
                />
                <DataRow
                  label="Convertido em atividade"
                  value={ticket.converted_to_activity ? "Sim" : "Não"}
                />
                {ticket.project_name ? (
                  <DataRow
                    label="Projeto de destino"
                    value={`${ticket.project_name} (legado/opcional)`}
                  />
                ) : null}
                <DataRow label="Atualizado em" value={formatDateTime(ticket.updated_at)} />
              </div>
            </SectionCard>

            <SectionCard title="Histórico técnico">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>Criado em {formatDateTime(ticket.created_at)}</div>
                <div>Ultima atualizacao em {formatDateTime(ticket.updated_at)}</div>
                {ticket.resolution_description ? (
                  <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-foreground">
                    {ticket.resolution_description}
                  </div>
                ) : null}
                {ticket.internal_notes && !ticket.resolution_description ? (
                  <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-foreground">
                    {ticket.internal_notes}
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>

      <AlertDialog
        open={confirmGenerateActivityOpen}
        onOpenChange={setConfirmGenerateActivityOpen}
      >
        <AlertDialogContent className="border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar nova atividade</AlertDialogTitle>
            <AlertDialogDescription>
              Este chamado ja possui atividade vinculada. Deseja criar uma nova mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmGenerateActivityOpen(false);
                openGenerateActivityForm(true);
              }}
            >
              Criar nova atividade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

          await runWorkflowAction(dialogState.actionId, formData);
        }}
      />

      <Dialog open={convertKbOpen} onOpenChange={setConvertKbOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converter chamado em artigo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Um rascunho de artigo será criado na Base de Conhecimento com o conteúdo deste chamado.
            </p>
            <Select value={convertKbCategory} onValueChange={setConvertKbCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Categoria (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {(kbCategoriesQuery.data ?? []).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertKbOpen(false)}>Cancelar</Button>
            <Button onClick={() => convertToKbMutation.mutate()} disabled={convertToKbMutation.isPending}>
              {convertToKbMutation.isPending ? "Convertendo..." : "Converter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function getActionIcon(action: TicketWorkflowActionDefinition) {
  switch (action.id) {
    case "approve":
      return <ShieldCheck className="h-3.5 w-3.5" />;
    case "reject":
    case "cancel":
      return <Ban className="h-3.5 w-3.5" />;
    case "categorize":
      return <Tags className="h-3.5 w-3.5" />;
    case "start_service":
    case "resume_service":
      return <Play className="h-3.5 w-3.5" />;
    case "wait_customer":
      return <UserRoundCheck className="h-3.5 w-3.5" />;
    case "send_validation":
      return <CheckCheck className="h-3.5 w-3.5" />;
    case "pause":
      return <Pause className="h-3.5 w-3.5" />;
    case "finish":
      return <Check className="h-3.5 w-3.5" />;
    default:
      return <Workflow className="h-3.5 w-3.5" />;
  }
}

function formatNullableDateTime(value?: string | null) {
  return value ? formatDateTime(value) : "";
}

function formatContactResponsible(ticket: Ticket) {
  const name = ticket.contact_responsible_name || "";
  const phone = ticket.contact_responsible_phone || "";

  if (name && phone) {
    return `${name} · ${phone}`;
  }

  return name || phone || "-";
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="glass space-y-4 rounded-2xl p-5 shadow-card">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/10 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{value || "-"}</dd>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Clock;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
