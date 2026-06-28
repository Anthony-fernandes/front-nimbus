import { useMemo, useRef, useState, type ReactNode } from "react";
import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  BookOpen,
  Check,
  CheckCheck,
  Clock,
  Clock2,
  Download,
  Eye,
  File,
  FileImage,
  FileText,
  FileVideo,
  Link2,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  ShieldCheck,
  Tags,
  TicketCheck,
  Upload,
  UserRoundCheck,
  Workflow,
  Wrench,
  X,
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
import type { Ticket, TicketAttachment, User } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getStoredUser } from "@/services/authService";
import { listActivities } from "@/services/activityService";
import { listSprints } from "@/services/sprintService";
import { listTicketCategories } from "@/services/ticketCategoryService";
import { listTicketTimeline, createTicketTimelineComment } from "@/services/ticketTimelineService";
import { listTicketRelations, createTicketRelation, deleteTicketRelation, listTicketStatusHistory, reopenTicket } from "@/services/ticketRelationService";
import type { TicketRelation, TicketStatusHistoryEntry } from "@/lib/types";
import { convertTicketToKb, listKnowledgeCategories } from "@/services/knowledgeService";
import { deleteTicket, getTicket, listTicketAttachments, transitionTicket, uploadTicketAttachment } from "@/services/ticketService";
import { listTicketWorkflowStatuses } from "@/services/ticketWorkflowService";
import { listUsers } from "@/services/userService";
import { formatDate, formatDateTime , parseApiError} from "@/services/utils";

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
  const [viewerAttachment, setViewerAttachment] = useState<TicketAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [relationsOpen, setRelationsOpen] = useState(false);
  const [newRelationType, setNewRelationType] = useState("relacionado");
  const [newRelatedTicketCode, setNewRelatedTicketCode] = useState("");
  const [addingRelation, setAddingRelation] = useState(false);
  const [reopening, setReopening] = useState(false);
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

  const attachmentsQuery = useQuery({
    queryKey: ["ticket-attachments", id],
    queryFn: () => listTicketAttachments(id),
    enabled: canViewTickets,
  });

  const relationsQuery = useQuery({
    queryKey: ["ticket-relations", id],
    queryFn: () => listTicketRelations(id),
    enabled: canViewTickets,
  });

  const statusHistoryQuery = useQuery({
    queryKey: ["ticket-status-history", id],
    queryFn: () => listTicketStatusHistory(id),
    enabled: canViewTickets,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadTicketAttachment(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-attachments", id] });
      toast.success("Anexo enviado com sucesso!");
    },
    onError: () => toast.error("Erro ao enviar anexo."),
    onSettled: () => setUploading(false),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    uploadMutation.mutate(file);
    e.target.value = "";
  }

  const technicianUsers = useMemo(
    () => (usersQuery.data || []).filter((user) => !isClientUser(user)),
    [usersQuery.data],
  );

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
          Chamado não encontrado.
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
      toast.error("Essa ação não está disponível para o status atual.");
      return;
    }

    if (!canTransitionTicket(ticket, actionDefinition.targetStatus, statusConfigs)) {
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
        queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["ticket-timeline", id] }),
      ]);

      toast.success(preparedAction.successMessage);
      setDialogState(null);
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível atualizar o chamado."));
    } finally {
      setWorkflowSaving(false);
    }
  };

  const requestWorkflowAction = (actionId: TicketWorkflowActionId) => {
    const actionDefinition = workflowTransitionActions.find((action) => action.id === actionId);
    if (!actionDefinition) {
      toast.error("Essa ação não está disponível para o status atual.");
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
      toast.success("Interação registrada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "A API atual ainda não suporta comentários independentes.",
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

  const handleReopen = async () => {
    try {
      setReopening(true);
      await reopenTicket(id);
      await queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      toast.success("Chamado reaberto com sucesso.");
    } catch (error) {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Não foi possível reabrir o chamado.");
    } finally {
      setReopening(false);
    }
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
          subtitle={`${ticket.organization_name || ticket.client_name || "Sem organização"} · ${ticket.requester_user_name || ticket.requester || "Sem solicitante"} · aberto em ${formatDate(ticket.opened_at)}`}
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
              {ticket.sla_due_at && !isTicketSlaPaused(ticket, statusConfigs) && (() => {
                const due = new Date(ticket.sla_due_at);
                const now = new Date();
                const diff = due.getTime() - now.getTime();
                const isOverdue = diff < 0;
                const hoursLeft = Math.abs(diff) / 3600000;
                const label = isOverdue
                  ? `SLA vencido há ${hoursLeft.toFixed(0)}h`
                  : hoursLeft < 2
                  ? `SLA: ${(diff / 60000).toFixed(0)}min restantes`
                  : `SLA: ${hoursLeft.toFixed(0)}h restantes`;
                return (
                  <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${isOverdue ? "bg-destructive/15 text-destructive" : hoursLeft < 4 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
                    <Clock className="inline h-3 w-3 mr-0.5" />
                    {label}
                  </span>
                );
              })()}
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
                    toast.error("Não foi possível copiar o link.");
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
              {(ticket.status === "Finalizado" || ticket.status === "Cancelado") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-warning/40 text-warning hover:bg-warning/10"
                  disabled={reopening}
                  onClick={handleReopen}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {reopening ? "Reabrindo..." : "Reabrir"}
                </Button>
              )}
              <ConfirmDelete
                onConfirm={async () => {
                  await deleteTicket(id);
                  toast.success("Chamado excluído.");
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
              title="Dados da solicitação"
              description="Descrição original, urgência informada e anexos do chamado."
            >
              <dl className="grid gap-3 sm:grid-cols-2">
                <DataRow label="Tipo" value={ticket.type || "Solicitação"} />
                <DataRow label="Urgência" value={ticket.urgency || "Média"} />
                <DataRow label="Origem" value={ticket.origin || "Portal da organização"} />
                <DataRow label="Criado em" value={formatDateTime(ticket.opened_at || ticket.created_at)} />
              </dl>
              <div className="rounded-xl border border-border bg-muted/15 p-4 text-sm leading-relaxed">
                {ticket.description || "Sem descrição cadastrada."}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Anexos</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "Enviando..." : "Enviar anexo"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                {attachmentsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Carregando anexos...</p>
                ) : !attachmentsQuery.data?.length ? (
                  <p className="text-xs text-muted-foreground">Nenhum anexo registrado.</p>
                ) : (
                  <ul className="space-y-2">
                    {attachmentsQuery.data.map((att) => (
                      <AttachmentCard
                        key={att.id}
                        attachment={att}
                        onView={() => setViewerAttachment(att)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Categorização interna"
              description="Categoria, subcategoria, prioridade, SLA e regras do atendimento."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DataRow label="Categoria" value={ticket.category_name || ticket.category || "-"} />
                <DataRow label="Subcategoria" value={ticket.subcategory || "-"} />
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Tipo ITIL</div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {ticket.type === "Incidente" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    {ticket.type === "Problema" && <Wrench className="h-3.5 w-3.5 text-warning" />}
                    {ticket.type === "Mudanca" && <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />}
                    {(!ticket.type || ticket.type === "Requisicao" || ticket.type === "Solicitação") && <Clock2 className="h-3.5 w-3.5 text-muted-foreground" />}
                    {ticket.type || "Solicitação"}
                  </div>
                </div>
                <DataRow label="Prioridade" value={ticket.priority || "Pendente"} />
                <DataRow label="Impacto" value={ticket.impact || "Pendente"} />
                <DataRow label="Urgência" value={ticket.urgency || "-"} />
                <DataRow label="SLA" value={ticket.sla || "8h"} />
                <DataRow label="Exige aprovação" value={ticket.approval_required ? "Sim" : "Não"} />
                <DataRow
                  label="Avaliação do cliente"
                  value={ticket.requires_client_validation ? "Sim" : "Não"}
                />
                <DataRow label="Equipe responsável" value={ticket.team || "-"} />
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
                  label="Responsável técnico"
                  value={ticket.responsible_technician_name || ticket.technician_names?.[0] || "-"}
                />
                <DataRow
                  label="Técnicos envolvidos"
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

            <SectionCard
              title="Chamados relacionados"
              description="Vínculos entre chamados (duplicado, bloqueador, relacionado)."
            >
              <div className="space-y-2">
                {relationsQuery.isLoading ? (
                  <div className="text-xs text-muted-foreground">Carregando...</div>
                ) : (relationsQuery.data || []).length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                    Nenhum chamado relacionado.
                  </div>
                ) : (
                  (relationsQuery.data || []).map((rel) => (
                    <div key={rel.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/10 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          {rel.relation_type === "duplicado" ? "Duplicado" :
                           rel.relation_type === "bloqueia" ? "Bloqueia" :
                           rel.relation_type === "bloqueado_por" ? "Bloqueado por" : "Relacionado"}
                        </span>
                        <span className="text-sm">{rel.related_ticket_code || rel.related_ticket}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await deleteTicketRelation(rel.id);
                          queryClient.invalidateQueries({ queryKey: ["ticket-relations", id] });
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
                <div className="flex gap-2">
                  <Select value={newRelationType} onValueChange={setNewRelationType}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relacionado">Relacionado a</SelectItem>
                      <SelectItem value="duplicado">Duplicado de</SelectItem>
                      <SelectItem value="bloqueia">Bloqueia</SelectItem>
                      <SelectItem value="bloqueado_por">Bloqueado por</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    className="h-8 flex-1 rounded-md border border-border bg-background px-3 text-xs"
                    placeholder="ID do chamado relacionado..."
                    value={newRelatedTicketCode}
                    onChange={(e) => setNewRelatedTicketCode(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={addingRelation || !newRelatedTicketCode.trim()}
                    onClick={async () => {
                      if (!newRelatedTicketCode.trim()) return;
                      setAddingRelation(true);
                      try {
                        await createTicketRelation({
                          ticket: id,
                          related_ticket: newRelatedTicketCode.trim(),
                          relation_type: newRelationType,
                        });
                        setNewRelatedTicketCode("");
                        queryClient.invalidateQueries({ queryKey: ["ticket-relations", id] });
                        toast.success("Relação adicionada.");
                      } catch {
                        toast.error("Não foi possível adicionar a relação.");
                      } finally {
                        setAddingRelation(false);
                      }
                    }}
                  >
                    {addingRelation ? "..." : "Vincular"}
                  </Button>
                </div>
              </div>
            </SectionCard>

            <TicketTimeline events={timeline} allowComposer onCommentSubmit={publishComment} />

            <SectionCard
              title="Sprint / Planejamento"
              description="Histórico de alocação do chamado em sprints, sem depender de projeto."
            >
              {sprintEntries.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                  Este chamado ainda não entrou no backlog de nenhuma sprint.
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

            <SectionCard
              title="Histórico de status"
              description="Registro de todas as mudanças de status deste chamado."
            >
              {statusHistoryQuery.isLoading ? (
                <div className="text-xs text-muted-foreground">Carregando...</div>
              ) : (statusHistoryQuery.data || []).length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                  Nenhuma mudança de status registrada ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {(statusHistoryQuery.data || []).map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-border bg-muted/10 px-4 py-3">
                      <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          {entry.status_from && (
                            <>
                              <span className="text-muted-foreground">{entry.status_from}</span>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <span className="font-medium">{entry.status_to}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {entry.changed_by_name || "Sistema"} · {formatDateTime(entry.created_at)}
                        </div>
                        {entry.reason && (
                          <div className="mt-1 text-xs text-muted-foreground">{entry.reason}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <aside className="space-y-4">
            <SectionCard title="Cabeçalho do chamado">
              <div className="space-y-2 text-sm">
                <DataRow
                  label="Organização atendida"
                  value={ticket.organization_name || ticket.client_name || "-"}
                />
                <DataRow label="Solicitante" value={ticket.requester_user_name || ticket.requester || "-"} />
                <DataRow
                  label="Contato responsável"
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

            {(ticket.reopen_count || ticket.last_reopened_at || ticket.reopen_deadline) && (
              <SectionCard title="Reabertura">
                <div className="space-y-2 text-sm">
                  {ticket.reopen_count ? (
                    <DataRow label="Reaberturas" value={String(ticket.reopen_count)} />
                  ) : null}
                  {ticket.last_reopened_at ? (
                    <DataRow label="Última reabertura" value={formatDateTime(ticket.last_reopened_at)} />
                  ) : null}
                  {ticket.reopen_deadline ? (
                    <DataRow label="Prazo para reabrir" value={formatDateTime(ticket.reopen_deadline)} />
                  ) : null}
                </div>
              </SectionCard>
            )}

            <SectionCard title="Histórico técnico">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>Criado em {formatDateTime(ticket.created_at)}</div>
                <div>Última atualização em {formatDateTime(ticket.updated_at)}</div>
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
              Este chamado já possui atividade vinculada. Deseja criar uma nova mesmo assim?
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

      <AttachmentViewerDialog
        attachment={viewerAttachment}
        onClose={() => setViewerAttachment(null)}
      />
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

function getAttachmentType(att: TicketAttachment): "image" | "pdf" | "video" | "other" {
  const ct = att.content_type?.toLowerCase() ?? "";
  const name = att.name?.toLowerCase() ?? "";
  if (ct.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name)) return "image";
  if (ct === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (ct.startsWith("video/") || /\.(mp4|webm)$/.test(name)) return "video";
  return "other";
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentTypeIcon({ att }: { att: TicketAttachment }) {
  const type = getAttachmentType(att);
  if (type === "image") return <FileImage className="h-4 w-4 text-blue-500" />;
  if (type === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (type === "video") return <FileVideo className="h-4 w-4 text-purple-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function AttachmentCard({ attachment, onView }: { attachment: TicketAttachment; onView: () => void }) {
  const url = attachment.url ?? "";
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 px-3 py-2.5">
      <AttachmentTypeIcon att={attachment} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.name}</p>
        {attachment.size ? (
          <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onView}>
          <Eye className="h-3.5 w-3.5" />
          Visualizar
        </Button>
        <a href={url} download={attachment.name} target="_blank" rel="noreferrer">
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
            <Download className="h-3.5 w-3.5" />
            Baixar
          </Button>
        </a>
      </div>
    </li>
  );
}

function AttachmentViewerDialog({
  attachment,
  onClose,
}: {
  attachment: TicketAttachment | null;
  onClose: () => void;
}) {
  if (!attachment) return null;
  const url = attachment.url ?? "";
  const type = getAttachmentType(attachment);

  return (
    <Dialog open={Boolean(attachment)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <DialogTitle className="truncate text-sm">{attachment.name}</DialogTitle>
          <div className="flex shrink-0 gap-2">
            <a href={url} download={attachment.name} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                <Download className="h-3.5 w-3.5" />
                Baixar
              </Button>
            </a>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex items-center justify-center overflow-hidden rounded-xl bg-muted/20">
          {type === "image" && (
            <img src={url} alt={attachment.name} className="max-h-[70vh] w-full object-contain" />
          )}
          {type === "pdf" && (
            <iframe
              src={url}
              title={attachment.name}
              className="w-full border-0"
              style={{ height: "70vh" }}
            />
          )}
          {type === "video" && (
            <video controls src={url} className="max-h-[70vh] w-full" />
          )}
          {type === "other" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <File className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Este tipo de arquivo não pode ser visualizado. Use o botão Baixar.
              </p>
              <a href={url} download={attachment.name} target="_blank" rel="noreferrer">
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Baixar arquivo
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
