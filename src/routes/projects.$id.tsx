import { useMemo, useState } from "react";
import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  Calendar,
  DollarSign,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Users2,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { UserPickerField } from "@/components/forms/UserPickerField";
import { ProjectCostDialog, type ProjectCostFormInput } from "@/components/projects/ProjectCostDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProjectProgressSummary, isProjectActivityCompleted } from "@/lib/projectProgress";
import type { Project, ProjectCost, ProjectStage } from "@/lib/types";
import { listActivities } from "@/services/activityService";
import { getProject, deleteProject, normalizeProjectStages, updateProject } from "@/services/projectService";
import {
  calculateProjectCostSummary,
  createProjectCost,
  deleteProjectCost,
  listProjectCosts,
  updateProjectCost,
} from "@/services/projectCostService";
import { listTickets } from "@/services/ticketService";
import { listUsers } from "@/services/userService";
import { formatCurrency, formatDateSafe, toNumber } from "@/services/utils";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({ meta: [{ title: "Detalhes do projeto - NimbusDesk" }] }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<ProjectCost | null>(null);
  const [costMutationPending, setCostMutationPending] = useState(false);
  const [deletingCostId, setDeletingCostId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [togglingStageId, setTogglingStageId] = useState<string | null>(null);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [selectedMembersToAdd, setSelectedMembersToAdd] = useState<string[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [addingMembersPending, setAddingMembersPending] = useState(false);

  const projectQuery = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id) });
  const activitiesQuery = useQuery({
    queryKey: ["project-activities", id],
    queryFn: () => listActivities({ project: id }),
  });
  const costsQuery = useQuery({
    queryKey: ["project-costs", id],
    queryFn: () => listProjectCosts(id),
  });
  const usersQuery = useQuery({
    queryKey: ["project-users"],
    queryFn: () => listUsers(),
    enabled: costDialogOpen || isAddMembersOpen,
  });
  const ticketsQuery = useQuery({
    queryKey: ["project-cost-tickets"],
    queryFn: () => listTickets(),
    enabled: costDialogOpen,
  });

  const project = projectQuery.data;
  const activities = Array.isArray(activitiesQuery.data) ? activitiesQuery.data : [];
  const stages = normalizeProjectStages(project?.checklist) as ProjectStage[];
  const costs = Array.isArray(costsQuery.data) ? costsQuery.data : [];
  const progressSummary = useMemo(
    () => getProjectProgressSummary({ checklist: stages }, activities),
    [activities, stages],
  );
  const summary = useMemo(
    () => calculateProjectCostSummary(costs, project?.budget),
    [costs, project?.budget],
  );
  const legacyRealCost = toNumber(project?.real_cost, 0);
  const budgetConsumedWidth = Math.max(0, Math.min(summary.percentConsumed, 100));
  const percentConsumedLabel = formatPercent(summary.percentConsumed);
  const newActivityHref = `/activities/new?project=${id}`;
  const teamMembers = useMemo(() => {
    const teamIds = Array.isArray(project?.team) ? project.team : [];
    const teamNames = Array.isArray(project?.team_names) ? project.team_names : [];

    if (teamIds.length) {
      return teamIds.map((memberId, index) => ({
        id: memberId,
        name: teamNames[index] || "Membro sem nome",
      }));
    }

    return teamNames.map((name, index) => ({
      id: "",
      name: name || "Membro sem nome",
      fallbackKey: `team-name-${index}`,
    }));
  }, [project?.team, project?.team_names]);
  const teamRows = useMemo(
    () =>
      teamMembers.map((member) => {
        const relatedActivities = activities.filter((activity) =>
          isActivityAssignedToMember(activity, member),
        );

        return {
          ...member,
          totalActivities: relatedActivities.length,
          inProgressActivities: relatedActivities.filter((activity) =>
            isActivityInProgress(activity.status),
          ).length,
          completedActivities: relatedActivities.filter((activity) =>
            isActivityCompleted(activity.status),
          ).length,
        };
      }),
    [activities, teamMembers],
  );

  const collaboratorOptions = useMemo(
    () =>
      (usersQuery.data || []).map((user) => ({
        value: user.id,
        label:
          user.name
          || [user.first_name, user.last_name].filter(Boolean).join(" ")
          || user.username
          || user.email
          || "Colaborador",
        subtitle: user.job_title || user.specialty || user.email || user.username || "",
      })),
    [usersQuery.data],
  );
  const currentTeamIds = useMemo(
    () => new Set(Array.isArray(project?.team) ? project.team : []),
    [project?.team],
  );
  const selectedMembersToAddSet = useMemo(
    () => new Set(selectedMembersToAdd),
    [selectedMembersToAdd],
  );
  const availableTeamMemberOptions = useMemo(
    () =>
      collaboratorOptions.filter(
        (option) =>
          !currentTeamIds.has(option.value) || selectedMembersToAddSet.has(option.value),
      ),
    [collaboratorOptions, currentTeamIds, selectedMembersToAddSet],
  );
  const relatedItemOptions = useMemo(() => {
    const ticketPool = (ticketsQuery.data || []).filter((ticket) => {
      if (!project?.client) {
        return true;
      }

      return ticket.client === project.client;
    });

    return [
      ...activities.map((activity) => ({
        id: activity.id,
        type: "activity" as const,
        label: activity.title,
        subtitle: activity.status || "Backlog",
      })),
      ...ticketPool.map((ticket) => ({
        id: ticket.id,
        type: "ticket" as const,
        label: ticket.code ? `${ticket.code} - ${ticket.title}` : ticket.title,
        subtitle: ticket.status || "Aberto",
      })),
    ];
  }, [activities, project?.client, ticketsQuery.data]);

  if (pathname !== `/projects/${id}`) {
    return <Outlet />;
  }

  if (projectQuery.isLoading) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
          Carregando projeto...
        </div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <div className="glass space-y-4 rounded-2xl p-6 text-sm shadow-card">
          <div className="text-base font-semibold text-foreground">Projeto não encontrado.</div>
          <div className="text-muted-foreground">
            O projeto solicitado pode ter sido removido ou ainda não está disponível.
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/projects">Voltar para projetos</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  async function refreshProjectCosts() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project", id] }),
      queryClient.invalidateQueries({ queryKey: ["project-costs", id] }),
    ]);
  }

  function closeCostDialog() {
    setCostDialogOpen(false);
    setEditingCost(null);
  }

  function closeAddMembersDialog() {
    setIsAddMembersOpen(false);
    setSelectedMembersToAdd([]);
    setMemberSearchTerm("");
  }

  async function handleSaveCost(payload: ProjectCostFormInput) {
    setCostMutationPending(true);

    try {
      if (editingCost) {
        await updateProjectCost(id, editingCost.id, {
          ...editingCost,
          ...payload,
          projectId: id,
          source: "manual",
        });
        toast.success("Lançamento de custo atualizado.");
      } else {
        await createProjectCost(id, { ...payload, projectId: id, source: "manual" });
        toast.success("Lançamento de custo adicionado.");
      }

      await refreshProjectCosts();
      closeCostDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar custo do projeto.");
    } finally {
      setCostMutationPending(false);
    }
  }

  async function handleDeleteCost(costId: string) {
    setDeletingCostId(costId);

    try {
      await deleteProjectCost(id, costId);
      await refreshProjectCosts();
      toast.success("Lançamento de custo removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir custo do projeto.");
    } finally {
      setDeletingCostId(null);
    }
  }

  async function handleRemoveTeamMember(memberId: string, memberName: string) {
    if (!memberId || !project) {
      toast.error("Não foi possível identificar este membro para remoção.");
      return;
    }

    setRemovingMemberId(memberId);

    try {
      await updateProject(id, {
        team: (Array.isArray(project.team) ? project.team : []).filter((currentId) => currentId !== memberId),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      toast.success(`${memberName} removido da equipe do projeto.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao remover membro da equipe.");
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleAddTeamMembers() {
    if (!selectedMembersToAdd.length || !project) {
      return;
    }

    setAddingMembersPending(true);

    try {
      const nextTeamIds = Array.from(
        new Set([...(Array.isArray(project.team) ? project.team : []), ...selectedMembersToAdd]),
      );

      await updateProject(id, { team: nextTeamIds });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      toast.success("Membros adicionados à equipe do projeto.");
      closeAddMembersDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar membros à equipe.");
    } finally {
      setAddingMembersPending(false);
    }
  }

  async function handleConfirmAddMembers() {
    if (!project || !selectedMembersToAdd.length) {
      return;
    }

    setAddingMembersPending(true);

    const newMemberIds = selectedMembersToAdd.filter((memberId) => !currentTeamIds.has(memberId));

    if (!newMemberIds.length) {
      closeAddMembersDialog();
      setAddingMembersPending(false);
      return;
    }

    const nextTeamIds = Array.from(
      new Set([...(Array.isArray(project.team) ? project.team : []), ...newMemberIds]),
    );
    const memberLabelById = new Map<string, string>();

    teamMembers.forEach((member) => {
      if (member.id) {
        memberLabelById.set(member.id, member.name);
      }
    });

    collaboratorOptions.forEach((option) => {
      memberLabelById.set(option.value, option.label);
    });

    const nextTeamNames = nextTeamIds.map(
      (memberId, index) => memberLabelById.get(memberId) || `Membro ${index + 1}`,
    );
    const previousProject = queryClient.getQueryData<Project>(["project", id]) || project;

    queryClient.setQueryData<Project>(["project", id], (cachedProject) => {
      const baseProject = cachedProject || project;

      if (!baseProject) {
        return cachedProject;
      }

      return {
        ...baseProject,
        team: nextTeamIds,
        team_names: nextTeamNames,
      } as Project;
    });

    try {
      await updateProject(id, { team: nextTeamIds });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      toast.success("Membros adicionados à equipe do projeto.");
      closeAddMembersDialog();
    } catch (error) {
      queryClient.setQueryData(["project", id], previousProject);
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar membros à equipe.");
    } finally {
      setAddingMembersPending(false);
    }
  }

  async function handleToggleStage(stageId: string, completed: boolean) {
    const cachedProject = queryClient.getQueryData<Project>(["project", id]) || project;

    if (!cachedProject) {
      return;
    }

    const previousProject = cachedProject;
    const updatedStages = (normalizeProjectStages(cachedProject.checklist) as ProjectStage[])
      .map((stage) => (stage && stage.id === stageId ? { ...stage, completed } : stage))
      .filter(Boolean) as ProjectStage[];

    queryClient.setQueryData<Project>(["project", id], {
      ...cachedProject,
      checklist: updatedStages,
    });
    setTogglingStageId(stageId);

    try {
      await updateProject(id, {
        checklist: toProjectStagePayload(updatedStages),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", id] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    } catch (error) {
      queryClient.setQueryData(["project", id], previousProject);
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar etapa do projeto.");
    } finally {
      setTogglingStageId(null);
    }
  }

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Projetos", to: "/projects" }, { label: project.name }]}
          title={project.name}
          subtitle={`${project.organization_name || project.client_name || "Nao informado"} - ${project.owner_name || project.leader_name || "Nao informado"}`}
          badges={
            <span
              className={`rounded px-2 py-1 text-[11px] ${getProjectStatusBadgeClass(project.status || "Não informado")}`}
            >
              {project.status || "Não informado"}
            </span>
          }
          actions={
            <>
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                asChild
              >
                <a href={newActivityHref}>
                  <Plus className="h-3.5 w-3.5" /> Nova atividade
                </a>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to="/projects/$id/edit" params={{ id }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Link>
              </Button>
              <ConfirmDelete
                onConfirm={async () => {
                  await deleteProject(id);
                  toast.success("Projeto excluido");
                  navigate({ to: "/projects" });
                }}
              />
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            icon={Activity}
            label="Progresso geral"
            value={`${progressSummary.percent}%`}
            helper={getProgressSourceChipLabel(progressSummary.source)}
          />
          <Stat icon={TrendingUp} label="Atividades" value={String(activities.length)} />
          <Stat icon={Users2} label="Equipe" value={String(teamRows.length)} />
          <Stat icon={Calendar} label="Etapas" value={String(stages.length)} />
        </div>

        <div className="space-y-5">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="border border-border bg-muted/40">
              <TabsTrigger value="overview">Detalhes</TabsTrigger>
              <TabsTrigger value="team">Equipe</TabsTrigger>
              <TabsTrigger value="activities">Atividades</TabsTrigger>
              <TabsTrigger value="costs">Custos</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.95fr)]">
                <div className="glass rounded-2xl p-5 shadow-card">
                  <div className="flex h-full flex-col gap-5">
                    <div>
                      <div className="space-y-1.5">
                        <div className="text-sm font-medium text-foreground">
                          Descrição do projeto
                        </div>
                        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                          {project.description || "Sem descrição informada."}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Progresso geral
                        </div>
                        <div className="mt-2 text-4xl font-semibold text-foreground">
                          {progressSummary.percent}%
                        </div>
                      </div>
                      <div className="space-y-1 sm:text-right">
                        <div className="text-sm font-medium text-foreground">
                          {getProgressSummaryLine(progressSummary)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {progressSummary.helperText}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-gradient-primary"
                          style={{ width: `${progressSummary.percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Execução concluída</span>
                        <span>{progressSummary.percent}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <ProjectDetailPanel
                  clientName={project.organization_name || project.client_name || "Nao informado"}
                  startAt={project.start_at}
                  dueAt={project.due_at}
                  status={project.status || "Não informado"}
                />
              </div>
              <div className="glass rounded-2xl p-5 shadow-card">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Etapas do projeto</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Acompanhe as principais etapas planejadas e suas previsões de término.
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stages.filter((stage) => stage.completed).length} concluída(s) de {stages.length}
                  </div>
                </div>
                {stages.length ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-muted/10">
                    {stages.map((stage) => (
                      <div
                        key={stage.id}
                        className={`grid gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1.45fr)_220px_150px] md:items-center ${stage.completed ? "bg-success/5" : ""}`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <Checkbox
                            checked={stage.completed}
                            onCheckedChange={(value) => {
                              void handleToggleStage(stage.id, Boolean(value));
                            }}
                            disabled={togglingStageId === stage.id}
                            aria-label={
                              stage.completed
                                ? `Marcar etapa ${stage.title} como pendente`
                                : `Marcar etapa ${stage.title} como concluída`
                            }
                            className="mt-0.5 h-5 w-5 rounded-full border-border data-[state=checked]:border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
                          />
                          <div className="min-w-0">
                            <div className={`text-sm font-medium ${stage.completed ? "text-foreground/80" : "text-foreground"}`}>
                              {stage.title}
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Previsão de término
                          </div>
                          <div className="mt-1 text-sm text-foreground">
                            {stage.expectedEndDate
                              ? formatDateSafe(stage.expectedEndDate)
                              : "Sem previsão de término definida."}
                          </div>
                        </div>
                        <div className="flex md:justify-end">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${getStageStatusBadgeClass(stage.completed)}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${stage.completed ? "bg-success" : "bg-muted-foreground/60"}`}
                            />
                            {stage.completed ? "Concluída" : "Pendente"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Nenhuma etapa cadastrada para este projeto.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              <ProjectTeamPanel
                members={teamRows}
                removingMemberId={removingMemberId}
                onAddMembers={() => setIsAddMembersOpen(true)}
                onRemoveMember={handleRemoveTeamMember}
              />
            </TabsContent>

            <TabsContent value="activities" className="space-y-3">
              {activities.length === 0 && (
                <EmptyPanel text="Nenhuma atividade vinculada a este projeto ainda. Use o botao acima para cadastrar a primeira." />
              )}
              {activities.map((activity) => (
                <Link
                  key={activity.id}
                  to="/activities/$id"
                  params={{ id: activity.id }}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 transition hover:bg-muted/30"
                >
                  <span className="text-sm">{activity.title}</span>
                  <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                    {activity.status || "Backlog"}
                  </span>
                </Link>
              ))}
            </TabsContent>

            <TabsContent value="costs" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <Stat
                    icon={DollarSign}
                    label="Orçamento total"
                    value={formatCurrency(summary.budget)}
                    helper="Planejado para o projeto"
                  />
                  <Stat
                    icon={DollarSign}
                    label="Total realizado"
                    value={formatCurrency(summary.realized)}
                    helper="Calculado pelos lançamentos"
                  />
                  <Stat
                    icon={DollarSign}
                    label="Saldo restante"
                    value={formatCurrency(summary.balance)}
                    tone={summary.balance < 0 ? "warning" : undefined}
                    helper={summary.balance < 0 ? "Acima do orçamento" : "Disponível para consumo"}
                  />
                  <Stat
                    icon={TrendingUp}
                    label="Percentual consumido"
                    value={percentConsumedLabel}
                    tone={summary.percentConsumed >= 100 ? "warning" : undefined}
                    helper="Relação entre realizado e orçamento"
                  />
                  <Stat
                    icon={Calendar}
                    label="Prazo do projeto"
                    value={formatDateSafe(project.due_at)}
                    helper={project.start_at ? `Início em ${formatDateSafe(project.start_at)}` : "Sem data inicial definida"}
                  />
                </div>

                <div className="glass rounded-2xl p-5 shadow-card">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold">Consumo do orçamento</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatCurrency(summary.realized)} de {formatCurrency(summary.budget)} já foram consumidos em {costs.length} lançamento(s).
                      </p>
                    </div>
                    <div className="pt-0.5 text-right">
                      <div className="text-2xl font-semibold text-primary">
                        {percentConsumedLabel}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className={summary.percentConsumed >= 100 ? "h-full bg-warning" : "h-full bg-gradient-primary"}
                      style={{ width: `${budgetConsumedWidth}%` }}
                    />
                  </div>
                </div>

                <div className="glass rounded-2xl p-5 shadow-card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Lançamentos de custos</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Registre horas de colaboradores e custos manuais para formar o realizado do projeto.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                      onClick={() => {
                        setEditingCost(null);
                        setCostDialogOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar custo
                    </Button>
                  </div>

                  {costsQuery.isLoading ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                      Carregando lançamentos de custos...
                    </div>
                  ) : costs.length === 0 ? (
                    <div className="mt-4 space-y-3">
                      {legacyRealCost > 0 && (
                        <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                          Este projeto possui custo realizado legado de {formatCurrency(legacyRealCost)}, mas ainda não tem lançamentos detalhados cadastrados.
                        </div>
                      )}
                      <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-10 text-center">
                        <div className="text-sm font-medium">Nenhum custo lancado ainda.</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Use o botao acima para registrar horas de colaboradores ou despesas manuais.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-border">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Tipo</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Horas</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="w-[160px] text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {costs.map((cost) => (
                            <TableRow key={cost.id}>
                              <TableCell>
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                  cost.source === "activity_time_entry"
                                    ? "border-info/25 bg-info/10 text-info"
                                    : "border-primary/20 bg-primary/10 text-primary"
                                }`}>
                                  {cost.source === "activity_time_entry" ? "Atividade" : "Manual"}
                                </span>
                              </TableCell>
                              <TableCell className="min-w-[240px]">
                                <div className="font-medium">
                                  {cost.type === "hours"
                                    ? cost.collaboratorName || "Colaborador não identificado"
                                    : cost.description || "Custo manual"}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {cost.type === "hours"
                                    ? cost.relatedItemTitle
                                      ? `${cost.relatedItemTitle} · ${formatHours(cost.hours || 0)}h · ${formatCurrency(cost.hourlyRate || 0)}/h`
                                      : `Sem atividade ou chamado relacionado · ${formatHours(cost.hours || 0)}h · ${formatCurrency(cost.hourlyRate || 0)}/h`
                                    : cost.notes || "Sem observações adicionais."}
                                </div>
                              </TableCell>
                              <TableCell>{formatDateSafe(cost.date)}</TableCell>
                              <TableCell>{cost.category}</TableCell>
                              <TableCell>
                                {cost.type === "hours" && cost.hours != null
                                  ? `${formatHours(cost.hours)}h`
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(cost.amount)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  {cost.source === "activity_time_entry" && cost.relatedItemId ? (
                                    <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                                      <Link to="/activities/$id/edit" params={{ id: cost.relatedItemId }}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Link>
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2"
                                        onClick={() => {
                                          setEditingCost(cost);
                                          setCostDialogOpen(true);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <ConfirmDelete
                                        trigger={
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2 text-destructive hover:text-destructive"
                                            disabled={deletingCostId === cost.id}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        }
                                        title="Excluir lançamento de custo?"
                                        description="O valor sera removido do realizado do projeto."
                                        onConfirm={() => {
                                          void handleDeleteCost(cost.id);
                                        }}
                                      />
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ProjectCostDialog
        open={costDialogOpen}
        onOpenChange={(open) => {
          setCostDialogOpen(open);
          if (!open) {
            setEditingCost(null);
          }
        }}
        mode={editingCost ? "edit" : "create"}
        initial={editingCost}
        collaborators={collaboratorOptions}
        relatedItems={relatedItemOptions}
        onSubmit={handleSaveCost}
        submitting={costMutationPending}
      />

      <Dialog
        open={isAddMembersOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsAddMembersOpen(true);
            return;
          }

          closeAddMembersDialog();
        }}
      >
        <DialogContent className="overflow-visible border-border bg-background/95 p-0 shadow-card backdrop-blur sm:max-w-2xl">
          <div className="space-y-5 p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-base font-semibold">
                Adicionar membros à equipe
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Pesquise e selecione os usuários que ainda não fazem parte deste projeto.
              </DialogDescription>
            </DialogHeader>

            {usersQuery.isLoading ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                Carregando usuários disponíveis...
              </div>
            ) : availableTeamMemberOptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
                Todos os usuários disponíveis já fazem parte da equipe.
              </div>
            ) : (
              <UserPickerField
                options={availableTeamMemberOptions}
                selected={selectedMembersToAdd}
                onChange={setSelectedMembersToAdd}
                query={memberSearchTerm}
                onQueryChange={setMemberSearchTerm}
                dropdownStrategy="inline"
                placeholder="Adicionar membro..."
                selectedLabel="Membros selecionados"
                emptySelectedText="Nenhum membro selecionado ainda."
              />
            )}

            <DialogFooter className="gap-2 border-t border-border/70 pt-4 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeAddMembersDialog}
                disabled={addingMembersPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={() => {
                  void handleConfirmAddMembers();
                }}
                disabled={
                  addingMembersPending
                  || selectedMembersToAdd.length === 0
                }
              >
                Adicionar membros
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="glass rounded-2xl p-5 text-sm text-muted-foreground shadow-card">
      {text}
    </div>
  );
}

function ProjectTeamPanel({
  members,
  removingMemberId,
  onAddMembers,
  onRemoveMember,
}: {
  members: Array<{
    id: string;
    name: string;
    fallbackKey?: string;
    totalActivities: number;
    inProgressActivities: number;
    completedActivities: number;
  }>;
  removingMemberId?: string | null;
  onAddMembers: () => void;
  onRemoveMember: (memberId: string, memberName: string) => void;
}) {
  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Equipe</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Membros participantes e alocados neste projeto.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddMembers}>
          <Plus className="h-3.5 w-3.5" /> Adicionar mais
        </Button>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[140px]">Sigla</TableHead>
              <TableHead>Membro</TableHead>
              <TableHead className="w-[120px] text-center">Atividades</TableHead>
              <TableHead className="w-[160px] text-center">Em andamento</TableHead>
              <TableHead className="w-[130px] text-center">Concluídas</TableHead>
              <TableHead className="w-[140px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length ? (
              members.map((member) => (
                <TableRow key={member.id || member.fallbackKey || member.name}>
                  <TableCell>
                    <span className="inline-flex min-w-[44px] justify-center rounded-full bg-gradient-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                      {getMemberInitials(member.name)}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{member.name || "Membro sem nome"}</TableCell>
                  <TableCell className="text-center">{member.totalActivities}</TableCell>
                  <TableCell className="text-center">{member.inProgressActivities}</TableCell>
                  <TableCell className="text-center">{member.completedActivities}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {member.id ? (
                        <ConfirmDelete
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-destructive hover:text-destructive"
                              disabled={removingMemberId === member.id}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          }
                          title="Remover membro da equipe?"
                          description={` ${member.name || "Membro sem nome"} sera removido deste projeto.`.trim()}
                          onConfirm={() => onRemoveMember(member.id, member.name || "Membro sem nome")}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem acao</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum membro informado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ProjectDetailPanel({
  clientName,
  startAt,
  dueAt,
  status,
}: {
  clientName: string;
  startAt?: string | null;
  dueAt?: string | null;
  status: string;
}) {
  const details = [
    { label: "Organização atendida", value: clientName },
    { label: "Início", value: formatDateSafe(startAt) },
    { label: "Término", value: formatDateSafe(dueAt) },
  ];

  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <div>
        <h3 className="text-sm font-semibold">Informações do projeto</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Dados principais do escopo, cronograma e status atual.
        </p>
      </div>

      <dl className="mt-4">
        {details.map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-1 border-b border-border/60 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <dt className="text-sm text-muted-foreground">
              {item.label}
            </dt>
            <dd className="text-sm font-medium text-foreground sm:text-right">
              {item.value}
            </dd>
          </div>
        ))}

        <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <dt className="text-sm text-muted-foreground">
            Status atual
          </dt>
          <dd>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${getProjectStatusBadgeClass(status)}`}
            >
              {status}
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  helper?: string;
  tone?: "warning";
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${tone === "warning" ? "text-warning" : ""}`}>
        {value}
      </div>
      {helper && <div className="mt-1 text-xs text-muted-foreground">{helper}</div>}
    </div>
  );
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }

  const digits = value >= 10 || Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)}%`;
}

function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function getProgressSourceChipLabel(source: "activities" | "stages" | "none") {
  if (source === "activities") {
    return "Baseado em atividades";
  }

  if (source === "stages") {
    return "Baseado em etapas";
  }

  return "Sem base de cálculo";
}

function getProgressSummaryLine(summary: {
  source: "activities" | "stages" | "none";
  completedCount: number;
  totalCount: number;
}) {
  if (!summary.totalCount) {
    return "Nenhuma atividade ou etapa concluída ainda.";
  }

  const noun = summary.source === "activities" ? "atividades" : "etapas";
  return `${summary.completedCount} de ${summary.totalCount} ${noun} concluídas`;
}

function getStageStatusBadgeClass(completed: boolean) {
  if (completed) {
    return "border-success/20 bg-success/10 text-success";
  }

  return "border-border bg-muted/40 text-muted-foreground";
}

function toProjectStagePayload(stages: ProjectStage[]): ProjectStage[] {
  return stages.map((stage) => ({
    id: stage.id,
    title: stage.title,
    expectedEndDate: stage.expectedEndDate || undefined,
    completed: Boolean(stage.completed),
  }));
}

function getProjectStatusBadgeClass(status?: string | null) {
  const normalizedStatus = normalizeComparisonValue(status);

  if (normalizedStatus === "concluido") {
    return "border-success/20 bg-success/10 text-success";
  }

  if (normalizedStatus === "em risco") {
    return "border-warning/20 bg-warning/10 text-warning";
  }

  if (normalizedStatus === "pausado") {
    return "border-border bg-muted/40 text-muted-foreground";
  }

  if (["planejado", "em andamento", "ativo"].includes(normalizedStatus)) {
    return "border-primary/20 bg-primary/10 text-primary";
  }

  return "border-border bg-muted/40 text-muted-foreground";
}

function normalizeComparisonValue(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getMemberInitials(name?: string | null) {
  const segments = String(name || "")
    .split(" ")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return "--";
  }

  return segments
    .map((segment) => segment[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isActivityCompleted(status?: string | null) {
  return isProjectActivityCompleted(status);
}

function isActivityInProgress(status?: string | null) {
  const normalizedStatus = normalizeComparisonValue(status);

  if (!normalizedStatus || isActivityCompleted(status)) {
    return false;
  }

  return !["backlog", "a fazer", "planejado"].includes(normalizedStatus);
}

function isActivityAssignedToMember(
  activity: { assignee?: string | null; assignee_name?: string | null },
  member: { id: string; name: string },
) {
  const memberId = normalizeComparisonValue(member.id);
  const activityAssigneeId = normalizeComparisonValue(activity.assignee);

  if (memberId && activityAssigneeId && memberId === activityAssigneeId) {
    return true;
  }

  const memberName = normalizeComparisonValue(member.name);
  const activityAssigneeName = normalizeComparisonValue(activity.assignee_name);

  return Boolean(memberName && activityAssigneeName && memberName === activityAssigneeName);
}
