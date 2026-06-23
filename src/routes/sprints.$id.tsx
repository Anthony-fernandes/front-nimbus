import { useMemo, useState } from "react";
import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Pencil, Plus, TimerReset, Trash2, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { PageHeader } from "@/components/app/PageHeader";
import {
  SprintActivityPlanForm,
  toSprintActivityPlanFormData,
  type SprintActivityPlanOption,
} from "@/components/forms/SprintActivityPlanForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatHoursLabel,
  getActivityExecutionSummary,
  getSprintPlanExecutionSummary,
  sumPlannedHours,
  sumRealizedHours,
} from "@/lib/activityFlow";
import { formatSprintStatusLabel } from "@/lib/labels";
import type { SprintActivityPlan } from "@/lib/types";
import { listActivities } from "@/services/activityService";
import { listActivityTimeEntries } from "@/services/activityTimeEntryService";
import { listActivityTags } from "@/services/activityTagService";
import {
  deleteSprintActivityPlan,
  listSprintActivityPlans,
  listSprintPlansBySprint,
  saveSprintActivityPlan,
} from "@/services/sprintActivityPlanService";
import {
  closeSprint,
  deleteSprint,
  getSprint,
  getSprintRetrospective,
  getSprintReview,
  getSprintVelocity,
  saveSprintRetrospective,
} from "@/services/sprintService";
import { formatDate, toNumber } from "@/services/utils";
import { listUsers } from "@/services/userService";
import { api } from "@/services/api";
import { BurndownChart } from "@/components/dashboard/Charts";

export const Route = createFileRoute("/sprints/$id")({
  head: () => ({ meta: [{ title: "Detalhes da sprint · NimbusDesk" }] }),
  component: SprintDetail,
});

function SprintDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SprintActivityPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [closeSprintOpen, setCloseSprintOpen] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [closingSprintPending, setClosingSprintPending] = useState(false);
  const [retroWentWell, setRetroWentWell] = useState("");
  const [retroToImprove, setRetroToImprove] = useState("");
  const [retroSaving, setRetroSaving] = useState(false);

  const sprintQuery = useQuery({ queryKey: ["sprint", id], queryFn: () => getSprint(id) });
  const activitiesQuery = useQuery({ queryKey: ["activities"], queryFn: () => listActivities() });
  const usersQuery = useQuery({ queryKey: ["form-users"], queryFn: () => listUsers() });
  const plansQuery = useQuery({
    queryKey: ["sprint-activity-plans", id],
    queryFn: () => listSprintPlansBySprint(id),
  });
  const allPlansQuery = useQuery({
    queryKey: ["all-sprint-activity-plans"],
    queryFn: () => listSprintActivityPlans(),
  });
  const allTimeEntriesQuery = useQuery({
    queryKey: ["activity-time-entries"],
    queryFn: () => listActivityTimeEntries(),
  });
  const activityTagsQuery = useQuery({
    queryKey: ["activity-tag-configs"],
    queryFn: () => listActivityTags(),
  });
  type BurndownRaw = { day?: string; date?: string; ideal: number; real?: number; actual?: number };
  const burndownQuery = useQuery({
    queryKey: ["sprint-burndown", id],
    queryFn: async () => {
      const response = await api.get<{ data?: BurndownRaw[]; results?: BurndownRaw[] } | BurndownRaw[]>(
        `/dashboard/widget-data/?source=sprint_burndown&sprint_id=${id}`,
      );
      const raw = response.data;
      const list: BurndownRaw[] = Array.isArray(raw)
        ? raw
        : ("results" in raw && Array.isArray(raw.results))
          ? raw.results
          : ("data" in raw && Array.isArray(raw.data))
            ? raw.data
            : [];
      return list.map((p) => ({
        name: p.day ?? p.date ?? "",
        Planejado: p.ideal,
        Realizado: p.real ?? p.actual ?? 0,
      }));
    },
    enabled: activeTab === "burndown",
  });

  const retroQuery = useQuery({
    queryKey: ["sprint-retrospective", id],
    queryFn: () => getSprintRetrospective(id),
  });

  const reviewQuery = useQuery({
    queryKey: ["sprint-review", id],
    queryFn: () => getSprintReview(id),
  });

  const velocityQuery = useQuery({
    queryKey: ["sprint-velocity"],
    queryFn: () => getSprintVelocity(),
  });

  const sprint = sprintQuery.data;
  const activities = activitiesQuery.data || [];
  const users = usersQuery.data || [];
  const sprintPlans = plansQuery.data || [];
  const allPlans = allPlansQuery.data || [];
  const allTimeEntries = allTimeEntriesQuery.data || [];
  const activityTags = activityTagsQuery.data || [];

  const activityMap = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity])),
    [activities],
  );
  const userMap = useMemo(
    () =>
      new Map(
        users.map((user) => [
          user.id,
          user.name
          || [user.first_name, user.last_name].filter(Boolean).join(" ")
          || user.username
          || user.email
          || "Usuário",
        ]),
      ),
    [users],
  );
  const tagNameSet = useMemo(
    () => new Set(activityTags.filter((tag) => tag.active).map((tag) => tag.name)),
    [activityTags],
  );

  const planningOptions = useMemo(() => {
    return activities
      .map((activity) => {
        const activityPlans = allPlans.filter((plan) => plan.activityId === activity.id);
        const activityPlansOutsideSprint = activityPlans.filter((plan) => plan.sprintId !== id);
        const activityEntries = allTimeEntries.filter((entry) => entry.activityId === activity.id);
        const summary = getActivityExecutionSummary({
          activity,
          plans: activityPlans,
          timeEntries: activityEntries,
        });

        return {
          id: activity.id,
          title: activity.title,
          projectName: activity.project_name || "Sem projeto",
          estimatedHours: summary.estimatedHours,
          plannedHoursOutsideSprint: sumPlannedHours(activityPlansOutsideSprint),
          realizedHours: summary.realizedHours,
          estimatedBalanceHours: summary.estimatedBalanceHours,
        } satisfies SprintActivityPlanOption;
      })
      .sort((left, right) => left.title.localeCompare(right.title, "pt-BR"));
  }, [activities, allPlans, allTimeEntries, id]);

  const totalPlannedHours = sumPlannedHours(sprintPlans);
  const sprintTimeEntries = allTimeEntries.filter((entry) => entry.sprintId === id);
  const totalRealizedHours = sumRealizedHours(sprintTimeEntries);
  const capacityUtilization =
    sprint?.capacity && sprint.capacity > 0
      ? Math.min(999, Math.round((totalPlannedHours / sprint.capacity) * 100))
      : 0;
  const overrunPlans = sprintPlans.filter((plan) => {
    const relatedEntries = allTimeEntries.filter((entry) => entry.activityId === plan.activityId);
    return getSprintPlanExecutionSummary(plan, relatedEntries).status === "over";
  }).length;

  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanDialogOpen(true);
  };

  const handleOpenEditPlan = (plan: SprintActivityPlan) => {
    setEditingPlan(plan);
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async (data: ReturnType<typeof toSprintActivityPlanFormData>) => {
    const selectedActivity = activities.find((activity) => activity.id === data.activityId) || null;

    if (!selectedActivity) {
      toast.error("Selecione a atividade que será planejada.");
      return;
    }

    setSavingPlan(true);
    try {
      await saveSprintActivityPlan(
        {
          id: editingPlan?.id,
          sprintId: id,
          activityId: data.activityId,
          projectId: selectedActivity.project || "",
          responsibleIds: data.responsibleIds,
          plannedHours: Number(data.plannedHours || 0),
          storyPoints: data.storyPoints ? Number(data.storyPoints) : undefined,
          plannedStartDate: data.plannedStartDate || "",
          plannedEndDate: data.plannedEndDate || "",
          order: data.order ? Number(data.order) : undefined,
          notes: data.notes || "",
        },
        editingPlan ? "edit" : "create",
        editingPlan?.id,
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] }),
        queryClient.invalidateQueries({ queryKey: ["all-sprint-activity-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-sprint-plans", data.activityId] }),
      ]);

      toast.success(editingPlan ? "Planejamento atualizado." : "Planejamento criado.");
      setPlanDialogOpen(false);
      setEditingPlan(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o planejamento.");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (plan: SprintActivityPlan) => {
    try {
      await deleteSprintActivityPlan(plan.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] }),
        queryClient.invalidateQueries({ queryKey: ["all-sprint-activity-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-sprint-plans", plan.activityId] }),
      ]);
      toast.success("Planejamento removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o planejamento.");
    }
  };

  const handleCloseSprint = async () => {
    try {
      setClosingSprintPending(true);
      await closeSprint(id, { notes: closeNotes });
      await queryClient.invalidateQueries({ queryKey: ["sprint", id] });
      await queryClient.invalidateQueries({ queryKey: ["sprint-review", id] });
      setCloseSprintOpen(false);
      toast.success("Sprint encerrada com sucesso!");
    } catch {
      toast.error("Não foi possível encerrar a sprint.");
    } finally {
      setClosingSprintPending(false);
    }
  };

  const handleSaveRetro = async () => {
    try {
      setRetroSaving(true);
      await saveSprintRetrospective(
        { sprint: id, went_well: retroWentWell, to_improve: retroToImprove, action_items: [] },
        retroQuery.data?.id,
      );
      await queryClient.invalidateQueries({ queryKey: ["sprint-retrospective", id] });
      toast.success("Retrospectiva salva!");
    } catch {
      toast.error("Não foi possível salvar a retrospectiva.");
    } finally {
      setRetroSaving(false);
    }
  };

  if (pathname !== `/sprints/${id}`) {
    return <Outlet />;
  }

  if (sprintQuery.isLoading) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando sprint...</div>
      </AppShell>
    );
  }

  if (!sprint) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-destructive">Sprint não encontrada.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Sprints", to: "/sprints" }, { label: sprint.name }]}
          title={sprint.name}
          subtitle={`${formatDate(sprint.start_at)} a ${formatDate(sprint.end_at)} · ${sprint.lead_name || "Sem responsável"}`}
          badges={
            <span className="rounded bg-success/15 px-2 py-1 text-[11px] text-success">
              {formatSprintStatusLabel(sprint.status || "Planejada")}
            </span>
          }
          actions={
            <>
              <Button
                type="button"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={handleOpenCreatePlan}
              >
                <Plus className="h-4 w-4" />
                Planejar atividade
              </Button>
              {sprint.status !== "Concluída" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-success/40 text-success hover:bg-success/10"
                  onClick={() => setCloseSprintOpen(true)}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Fechar Sprint
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to="/sprints/$id/edit" params={{ id }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Link>
              </Button>
              <ConfirmDelete
                onConfirm={async () => {
                  await Promise.all(sprintPlans.map((plan) => deleteSprintActivityPlan(plan.id)));
                  await deleteSprint(id);
                  toast.success("Sprint excluída.");
                  navigate({ to: "/sprints" });
                }}
              />
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Atividades planejadas" value={String(sprintPlans.length)} />
          <Stat label="Horas planejadas" value={formatHoursLabel(totalPlannedHours)} />
          <Stat label="Horas realizadas" value={formatHoursLabel(totalRealizedHours)} />
          <Stat label="Uso da capacidade" value={`${capacityUtilization}%`} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="border border-border bg-muted/40">
                <TabsTrigger value="overview">Visão geral</TabsTrigger>
                <TabsTrigger value="planning">Planejamento</TabsTrigger>
                <TabsTrigger value="burndown">Burndown</TabsTrigger>
                <TabsTrigger value="retrospective">Retrospectiva</TabsTrigger>
                <TabsTrigger value="review">Review</TabsTrigger>
                <TabsTrigger value="velocity">Velocidade</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card">
                  <h3 className="mb-2 text-sm font-semibold">Objetivo da sprint</h3>
                  <p className="text-sm text-muted-foreground">{sprint.goal || "Nenhum objetivo informado."}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="glass rounded-2xl p-5 shadow-card">
                    <h3 className="mb-3 text-sm font-semibold">Capacidade x planejamento</h3>
                    <div className="space-y-2 text-sm">
                      <SummaryLine label="Capacidade da sprint" value={formatHoursLabel(toNumber(sprint.capacity, 0))} />
                      <SummaryLine label="Total planejado" value={formatHoursLabel(totalPlannedHours)} />
                      <SummaryLine
                        label="Saldo de capacidade"
                        value={formatHoursLabel(Math.max(0, toNumber(sprint.capacity, 0) - totalPlannedHours))}
                      />
                    </div>
                  </div>

                  <div className="glass rounded-2xl p-5 shadow-card">
                    <h3 className="mb-3 text-sm font-semibold">Indicadores da sprint</h3>
                    <div className="space-y-2 text-sm">
                      <SummaryLine label="Atividades estouradas" value={String(overrunPlans)} />
                      <SummaryLine label="Apontamentos nesta sprint" value={String(sprintTimeEntries.length)} />
                      <SummaryLine
                        label="Tags ativas no catálogo"
                        value={String(tagNameSet.size)}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="planning" className="space-y-4">
                {sprintPlans.length === 0 ? (
                  <div className="glass rounded-2xl p-5 text-sm text-muted-foreground shadow-card">
                    Nenhuma atividade foi planejada para esta sprint ainda.
                  </div>
                ) : (
                  sprintPlans.map((plan) => {
                    const activity = activityMap.get(plan.activityId);
                    const relatedEntries = allTimeEntries.filter((entry) => entry.activityId === plan.activityId);
                    const planSummary = getSprintPlanExecutionSummary(plan, relatedEntries);
                    const responsibleNames = (plan.responsibleIds || [])
                      .map((responsibleId) => userMap.get(responsibleId) || "Usuário")
                      .join(", ");

                    return (
                      <div key={plan.id} className="glass rounded-2xl p-5 shadow-card">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{activity?.title || plan.activityId}</span>
                              {activity ? (
                                <Link
                                  to="/activities/$id"
                                  params={{ id: activity.id }}
                                  className="text-xs text-primary underline underline-offset-4"
                                >
                                  Abrir atividade
                                </Link>
                              ) : null}
                            </div>
                            <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                              <span>Estimativa total: {formatHoursLabel(toNumber(activity?.est_hours, 0))}</span>
                              <span>Planejado na sprint: {formatHoursLabel(planSummary.plannedHours)}</span>
                              <span>Realizado na sprint: {formatHoursLabel(planSummary.realizedHours)}</span>
                              <span>Diferença: {planSummary.differenceHours > 0 ? `+${formatHoursLabel(planSummary.differenceHours)}` : planSummary.differenceHours < 0 ? `-${formatHoursLabel(Math.abs(planSummary.differenceHours))}` : "0h"}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>Responsáveis: {responsibleNames || "Não definidos"}</span>
                              <span>Story points: {plan.storyPoints || 0}</span>
                              <span>Início previsto: {formatDate(plan.plannedStartDate)}</span>
                              <span>Fim previsto: {formatDate(plan.plannedEndDate)}</span>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">
                              {plan.notes || "Sem observação de planejamento."}
                            </p>
                          </div>

                          <div className="flex flex-col items-start gap-2 lg:items-end">
                            <span className={getPlanStatusClass(planSummary.status as "over" | "under" | "balanced")}>
                              {planSummary.label}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => handleOpenEditPlan(plan)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <ConfirmDelete
                                trigger={
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Remover
                                  </Button>
                                }
                                title="Remover planejamento?"
                                description="Esta atividade sairá do planejamento desta sprint, mas a atividade em si continuará existindo."
                                onConfirm={() => handleDeletePlan(plan)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="burndown" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card">
                  <h3 className="mb-4 text-sm font-semibold">Burndown da sprint</h3>
                  {burndownQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Carregando...</div>
                  ) : !burndownQuery.data || burndownQuery.data.length === 0 ? (
                    <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
                      Sem dados de burndown disponíveis para este sprint.
                    </div>
                  ) : (
                    <SprintBurndownChart data={burndownQuery.data} />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="retrospective" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card space-y-4">
                  <h3 className="text-sm font-semibold">Retrospectiva da Sprint</h3>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">O que foi bem?</label>
                    <textarea
                      className="w-full min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
                      placeholder="Liste os pontos positivos da sprint..."
                      value={retroQuery.data?.went_well || retroWentWell}
                      onChange={(e) => setRetroWentWell(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">O que pode melhorar?</label>
                    <textarea
                      className="w-full min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
                      placeholder="Liste pontos de melhoria..."
                      value={retroQuery.data?.to_improve || retroToImprove}
                      onChange={(e) => setRetroToImprove(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={retroSaving}
                      onClick={handleSaveRetro}
                    >
                      {retroSaving ? "Salvando..." : "Salvar retrospectiva"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="review" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card space-y-4">
                  <h3 className="text-sm font-semibold">Review da Sprint</h3>
                  {reviewQuery.data ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border bg-muted/10 p-4 text-center">
                        <div className="text-2xl font-bold">{reviewQuery.data.delivered_points}</div>
                        <div className="text-xs text-muted-foreground">Pontos entregues</div>
                        <div className="mt-1 text-xs text-muted-foreground">de {reviewQuery.data.planned_points} planejados</div>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/10 p-4 text-center">
                        <div className="text-2xl font-bold">{reviewQuery.data.delivered_items}</div>
                        <div className="text-xs text-muted-foreground">Itens entregues</div>
                        <div className="mt-1 text-xs text-muted-foreground">de {reviewQuery.data.planned_items} planejados</div>
                      </div>
                      {reviewQuery.data.notes && (
                        <div className="col-span-2 rounded-xl border border-border bg-muted/10 p-4 text-sm">
                          {reviewQuery.data.notes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                      Review ainda não gerado. Feche a sprint para gerar automaticamente.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="velocity" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Velocidade histórica</h3>
                    {velocityQuery.data && (
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                        Média: {velocityQuery.data.avg_velocity} pts/sprint
                      </span>
                    )}
                  </div>
                  {velocityQuery.isLoading ? (
                    <div className="text-xs text-muted-foreground">Carregando velocidade...</div>
                  ) : !velocityQuery.data?.sprints?.length ? (
                    <div className="rounded-xl border border-border bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhum dado de velocidade disponível ainda.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={velocityQuery.data.sprints} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="sprint_name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                        />
                        <Bar dataKey="delivered_points" name="Pontos entregues" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        {velocityQuery.data.avg_velocity > 0 && (
                          <ReferenceLine y={velocityQuery.data.avg_velocity} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: "Média", fontSize: 10 }} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <div className="glass rounded-2xl p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold">Detalhes</h3>
              <dl className="space-y-2 text-sm">
                {[
                  ["Responsável", sprint.lead_name || "-"],
                  ["Status", formatSprintStatusLabel(sprint.status || "Planejada")],
                  ["Início", formatDate(sprint.start_at)],
                  ["Fim", formatDate(sprint.end_at)],
                  ["Capacidade", formatHoursLabel(toNumber(sprint.capacity, 0))],
                  ["Horas planejadas", formatHoursLabel(totalPlannedHours)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <InfoPanel
              icon={TrendingUp}
              text={`Total realizado nesta sprint: ${formatHoursLabel(totalRealizedHours)}.`}
            />
            <InfoPanel
              icon={TimerReset}
              text={
                overrunPlans > 0
                  ? `${overrunPlans} atividade(s) estouraram o planejado nesta sprint.`
                  : "Nenhuma atividade estourou o planejado nesta sprint."
              }
            />
          </aside>
        </div>
      </div>

      <Dialog
        open={planDialogOpen}
        onOpenChange={(open) => {
          setPlanDialogOpen(open);
          if (!open) {
            setEditingPlan(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl glass-strong">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Editar planejamento da sprint" : "Planejar atividade na sprint"}
            </DialogTitle>
            <DialogDescription>
              Defina quem vai executar, quantas horas serão planejadas neste ciclo e as previsões da sprint.
            </DialogDescription>
          </DialogHeader>

          <SprintActivityPlanForm
            key={editingPlan?.id || "new-sprint-activity-plan"}
            initial={toSprintActivityPlanFormData(
              editingPlan
                ? {
                    activityId: editingPlan.activityId,
                    responsibleIds: editingPlan.responsibleIds || [],
                    plannedHours: String(editingPlan.plannedHours ?? ""),
                    storyPoints:
                      editingPlan.storyPoints != null ? String(editingPlan.storyPoints) : "",
                    plannedStartDate: editingPlan.plannedStartDate || "",
                    plannedEndDate: editingPlan.plannedEndDate || "",
                    order: editingPlan.order != null ? String(editingPlan.order) : "",
                    notes: editingPlan.notes || "",
                  }
                : null,
            )}
            activities={planningOptions}
            users={users}
            saving={savingPlan}
            submitLabel={editingPlan ? "Salvar planejamento" : "Adicionar à sprint"}
            onSubmit={handleSavePlan}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={closeSprintOpen} onOpenChange={setCloseSprintOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Sprint</DialogTitle>
            <DialogDescription>
              Ao fechar a sprint, as atividades incompletas serão movidas para o backlog e o review será gerado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-muted-foreground">Observações finais (opcional)</label>
            <textarea
              className="w-full min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
              placeholder="Adicione observações sobre o encerramento..."
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseSprintOpen(false)}>Cancelar</Button>
            <Button disabled={closingSprintPending} onClick={handleCloseSprint}>
              {closingSprintPending ? "Encerrando..." : "Confirmar encerramento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

interface BurndownPoint {
  name: string;
  Planejado: number;
  Realizado: number;
}

function SprintBurndownChart({ data }: { data: BurndownPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Line
          type="monotone"
          dataKey="Planejado"
          name="Ideal"
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="5 5"
          dot={false}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="Realizado"
          name="Real"
          stroke="hsl(var(--primary))"
          dot={{ r: 3 }}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function InfoPanel({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="glass flex items-center gap-2 rounded-2xl p-5 text-sm text-muted-foreground shadow-card">
      <Icon className="h-4 w-4" /> {text}
    </div>
  );
}

function getPlanStatusClass(status: "balanced" | "under" | "over") {
  if (status === "over") {
    return "rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive";
  }

  if (status === "under") {
    return "rounded-md border border-info/30 bg-info/10 px-2 py-1 text-[11px] text-info";
  }

  return "rounded-md border border-success/30 bg-success/10 px-2 py-1 text-[11px] text-success";
}
