import { useMemo, useState } from "react";
import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  History,
  Link2,
  Pencil,
  Plus,
  TimerReset,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { PageHeader } from "@/components/app/PageHeader";
import { ActivityTimeEntryForm, toActivityTimeEntryFormData } from "@/components/forms/ActivityTimeEntryForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatHoursLabel,
  getActivityExecutionSummary,
  getSprintPlanExecutionSummary,
} from "@/lib/activityFlow";
import { formatActivityStatusLabel, formatPriorityLabel } from "@/lib/labels";
import type { ActivityTimeEntry } from "@/lib/types";
import { deleteActivity, getActivity } from "@/services/activityService";
import {
  deleteActivityTimeEntry,
  listActivityTimeEntries,
  saveActivityTimeEntry,
} from "@/services/activityTimeEntryService";
import { listActivityTags, resolveActivityTagBadges } from "@/services/activityTagService";
import {
  findGeneratedTimeEntryCost,
  listActivityGeneratedCosts,
  listProjectCosts,
  removeActivityTimeEntryCost,
} from "@/services/projectCostService";
import {
  deleteSprintActivityPlan,
  listSprintPlansByActivity,
} from "@/services/sprintActivityPlanService";
import { listSprints } from "@/services/sprintService";
import { formatCurrency, formatDate, formatDateTime, toNumber } from "@/services/utils";
import { listUsers } from "@/services/userService";

export const Route = createFileRoute("/activities/$id")({
  head: () => ({ meta: [{ title: "Detalhes da atividade - Stratos Suite" }] }),
  component: ActivityDetail,
});

function ActivityDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ActivityTimeEntry | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);

  const activityQuery = useQuery({ queryKey: ["activity", id], queryFn: () => getActivity(id) });
  const timeEntriesQuery = useQuery({
    queryKey: ["activity-time-entries", id],
    queryFn: () => listActivityTimeEntries(id),
  });
  const sprintPlansQuery = useQuery({
    queryKey: ["activity-sprint-plans", id],
    queryFn: () => listSprintPlansByActivity(id),
  });
  const usersQuery = useQuery({
    queryKey: ["activity-time-entry-users"],
    queryFn: () => listUsers(),
  });
  const sprintsQuery = useQuery({
    queryKey: ["sprints"],
    queryFn: () => listSprints(),
  });
  const activityTagsQuery = useQuery({
    queryKey: ["activity-tag-configs"],
    queryFn: () => listActivityTags(),
  });
  const generatedCostsQuery = useQuery({
    queryKey: ["activity-generated-costs", id, activityQuery.data?.project],
    queryFn: async () => {
      if (!activityQuery.data?.project) {
        return [];
      }

      const costs = await listProjectCosts(activityQuery.data.project);
      return listActivityGeneratedCosts(costs, id);
    },
    enabled: Boolean(activityQuery.data?.project),
  });

  const activity = activityQuery.data;
  const timeEntries = timeEntriesQuery.data || [];
  const sprintPlans = sprintPlansQuery.data || [];
  const users = usersQuery.data || [];
  const sprints = sprintsQuery.data || [];
  const activityTags = activityTagsQuery.data || [];
  const generatedCosts = generatedCostsQuery.data || [];
  const calculateHourlyCost =
    typeof activity?.calculateHourlyCost === "boolean"
      ? activity.calculateHourlyCost
      : Boolean(activity?.calculate_hourly_cost);

  const executionSummary = getActivityExecutionSummary({
    activity,
    plans: sprintPlans,
    timeEntries,
  });

  const sprintNameMap = useMemo(
    () => new Map(sprints.map((sprint) => [sprint.id, sprint.name])),
    [sprints],
  );

  const legacyHours = Math.max(0, toNumber(activity?.done_hours, 0));
  const legacyDescription = activity?.work_description || "";
  const legacyEntry =
    activity && (legacyHours > 0 || legacyDescription)
      ? {
          id: `legacy:${activity.id}`,
          activityId: activity.id,
          sprintId: undefined,
          projectId: activity.project || "",
          collaboratorId: activity.assignee || "",
          collaboratorName: activity.assignee_name || "Registro legado",
          date:
            activity.updated_at?.slice(0, 10)
            || activity.created_at?.slice(0, 10)
            || new Date().toISOString().slice(0, 10),
          hours: legacyHours,
          workDescription:
            legacyDescription || "Apontamento legado trazido do modelo antigo da atividade.",
          createdAt: activity.created_at || new Date().toISOString(),
          updatedAt: activity.updated_at,
        }
      : null;
  const displayEntries = [...(legacyEntry ? [legacyEntry] : []), ...timeEntries].sort((left, right) => {
    const leftTime = new Date(left.date || left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.date || right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });

  const totalGeneratedCost = generatedCosts.reduce((sum, cost) => sum + toNumber(cost.amount, 0), 0);
  const tagBadges = resolveActivityTagBadges(activity, activityTags);

  const sprintOptions = sprintPlans.map((plan) => ({
    value: plan.sprintId,
    label: sprintNameMap.get(plan.sprintId) || "Sprint",
  }));

  const handleOpenCreateEntry = () => {
    setEditingEntry(null);
    setEntryDialogOpen(true);
  };

  const handleOpenEditEntry = (entry: ActivityTimeEntry) => {
    setEditingEntry(entry);
    setEntryDialogOpen(true);
  };

  const handleSaveEntry = async (data: ReturnType<typeof toActivityTimeEntryFormData>) => {
    if (!activity) {
      return;
    }

    const collaborator = users.find((user) => user.id === data.collaboratorId) || null;

    setSavingEntry(true);
    try {
      await saveActivityTimeEntry(
        {
          id: editingEntry?.id,
          activityId: activity.id,
          projectId: activity.project || "",
          collaboratorId: data.collaboratorId,
          collaboratorName: collaborator?.name,
          date: data.date,
          hours: parseFloat(data.hours) || 0,
          sprintId: data.sprintId,
          workDescription: data.workDescription,
        },
        {
          mode: editingEntry ? "edit" : "create",
          entryId: editingEntry?.id,
          activity,
          collaborator,
        },
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["activity-time-entries", id] }),
        queryClient.invalidateQueries({ queryKey: ["activity-time-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-generated-costs", id, activity.project] }),
        queryClient.invalidateQueries({ queryKey: ["project-costs", activity.project] }),
        queryClient.invalidateQueries({ queryKey: ["project", activity.project] }),
      ]);

      toast.success(editingEntry ? "Apontamento atualizado." : "Apontamento criado.");
      setEntryDialogOpen(false);
      setEditingEntry(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o apontamento.");
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteEntry = async (entry: ActivityTimeEntry) => {
    try {
      await deleteActivityTimeEntry(entry.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["activity-time-entries", id] }),
        queryClient.invalidateQueries({ queryKey: ["activity-time-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-generated-costs", id, activity?.project] }),
        activity?.project
          ? queryClient.invalidateQueries({ queryKey: ["project-costs", activity.project] })
          : Promise.resolve(),
        activity?.project
          ? queryClient.invalidateQueries({ queryKey: ["project", activity.project] })
          : Promise.resolve(),
      ]);
      toast.success("Apontamento removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel remover o apontamento.");
    }
  };

  if (pathname !== `/activities/${id}`) {
    return <Outlet />;
  }

  if (activityQuery.isLoading) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
          Carregando atividade...
        </div>
      </AppShell>
    );
  }

  if (!activity) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-destructive">
          Atividade nao encontrada.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Atividades", to: "/activities" }, { label: activity.title }]}
          title={
            <span className="flex items-center gap-3">
              <span className="font-mono text-sm text-muted-foreground">{id.slice(0, 8)}</span>
              <span>{activity.title}</span>
            </span>
          }
          subtitle={`${activity.project_name || "Sem projeto"} · Responsavel sugerido: ${activity.assignee_name || "Nao definido"}`}
          badges={
            <span className="flex items-center gap-2">
              <span className="rounded-md border border-warning/30 bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                {formatPriorityLabel(activity.priority || "Media")}
              </span>
              <span className="rounded-md bg-info/15 px-2 py-1 text-[11px] text-info">
                {formatActivityStatusLabel(activity.status || "Backlog")}
              </span>
            </span>
          }
          actions={
            <>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to="/activities/$id/edit" params={{ id }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Link>
              </Button>
              <ConfirmDelete
                onConfirm={async () => {
                  await Promise.all(timeEntries.map((entry) => deleteActivityTimeEntry(entry.id)));
                  await Promise.all(sprintPlans.map((plan) => deleteSprintActivityPlan(plan.id)));

                  if (activity.project) {
                    await removeActivityTimeEntryCost({
                      activityId: id,
                      projectId: activity.project,
                    });
                  }

                  await deleteActivity(id);
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["activities"] }),
                    queryClient.invalidateQueries({ queryKey: ["activity", id] }),
                    queryClient.invalidateQueries({ queryKey: ["all-sprint-activity-plans"] }),
                    activity.project
                      ? queryClient.invalidateQueries({ queryKey: ["project-costs", activity.project] })
                      : Promise.resolve(),
                    activity.project
                      ? queryClient.invalidateQueries({ queryKey: ["project", activity.project] })
                      : Promise.resolve(),
                  ]);
                  toast.success("Atividade excluida.");
                  navigate({ to: "/activities" });
                }}
              />
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Estimativa total" value={formatHoursLabel(executionSummary.estimatedHours)} />
          <Stat label="Planejado em sprints" value={formatHoursLabel(executionSummary.plannedHours)} />
          <Stat label="Realizado" value={formatHoursLabel(executionSummary.realizedHours)} />
          <Stat
            label="Saldo estimado"
            value={
              executionSummary.estimatedBalanceHours >= 0
                ? formatHoursLabel(executionSummary.estimatedBalanceHours)
                : `-${formatHoursLabel(Math.abs(executionSummary.estimatedBalanceHours))}`
            }
          />
          <Stat label="Custo gerado" value={formatCurrency(totalGeneratedCost)} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="border border-border bg-muted/40">
                <TabsTrigger value="overview">Visao geral</TabsTrigger>
                <TabsTrigger value="time-entries">Apontamentos</TabsTrigger>
                <TabsTrigger value="planning">Planejamento</TabsTrigger>
                <TabsTrigger value="history">Historico</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card">
                  <h3 className="mb-2 text-sm font-semibold">Descricao</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {activity.description || "Sem descricao cadastrada."}
                  </p>
                </div>

                <div className="glass rounded-2xl p-5 shadow-card">
                  <h3 className="mb-3 text-sm font-semibold">Resumo operacional</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DataCard label="Planejado nas sprints" value={formatHoursLabel(executionSummary.plannedHours)} />
                    <DataCard label="Realizado nos apontamentos" value={formatHoursLabel(executionSummary.realizedHours)} />
                    <DataCard
                      label="Resultado da estimativa"
                      value={
                        executionSummary.isEstimateExceeded
                          ? `Estourou ${formatHoursLabel(executionSummary.estimatedOverflowHours)}`
                          : `Saldo ${formatHoursLabel(Math.max(0, executionSummary.estimatedBalanceHours))}`
                      }
                    />
                    <DataCard
                      label="Custo automatico"
                      value={
                        calculateHourlyCost
                          ? formatCurrency(totalGeneratedCost)
                          : "Desativado"
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="time-entries" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Apontamentos de trabalho</h3>
                      <p className="text-sm text-muted-foreground">
                        Registre aqui o tempo realmente trabalhado na atividade.
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                      onClick={handleOpenCreateEntry}
                    >
                      <Plus className="h-4 w-4" />
                      Novo apontamento
                    </Button>
                  </div>
                </div>

                {displayEntries.length === 0 ? (
                  <div className="glass rounded-2xl p-5 text-sm text-muted-foreground shadow-card">
                    Nenhum apontamento registrado ainda.
                  </div>
                ) : (
                  displayEntries.map((entry) => {
                    const generatedCost =
                      entry.id.startsWith("legacy:")
                        ? generatedCosts.find(
                            (cost) => cost.timeEntryId === `activity:${activity.id}`,
                          ) || null
                        : findGeneratedTimeEntryCost(generatedCosts, entry.id);
                    const sprintName = entry.sprintId ? sprintNameMap.get(entry.sprintId) || "Sprint" : "Sem sprint";
                    const isLegacyEntry = entry.id.startsWith("legacy:");

                    return (
                      <div
                        key={entry.id}
                        className="glass rounded-2xl p-5 shadow-card"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{entry.collaboratorName || "Colaborador"}</span>
                              {isLegacyEntry ? (
                                <span className="rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                  Legado
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{formatDate(entry.date)}</span>
                              <span>{formatHoursLabel(entry.hours)}</span>
                              <span>{sprintName}</span>
                              <span>
                                {generatedCost
                                  ? `Custo ${formatCurrency(generatedCost.amount)}`
                                  : calculateHourlyCost
                                    ? "Sem custo gerado"
                                    : "Custo por hora desativado"}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {entry.workDescription || "Sem descricao registrada para este apontamento."}
                            </p>
                          </div>

                          {!isLegacyEntry ? (
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => handleOpenEditEntry(entry)}
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
                                    Remover
                                  </Button>
                                }
                                title="Remover apontamento?"
                                description="O custo gerado automaticamente para este apontamento tambem sera removido."
                                onConfirm={() => handleDeleteEntry(entry)}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="planning" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card">
                  <h3 className="text-sm font-semibold">Planejamento em sprints</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O planejamento da atividade acontece dentro da sprint, com horas previstas e responsaveis.
                  </p>
                </div>

                {sprintPlans.length === 0 ? (
                  <div className="glass rounded-2xl p-5 text-sm text-muted-foreground shadow-card">
                    Esta atividade ainda nao foi planejada em nenhuma sprint.
                  </div>
                ) : (
                  sprintPlans.map((plan) => {
                    const planSummary = getSprintPlanExecutionSummary(plan, timeEntries);
                    const sprintName = sprintNameMap.get(plan.sprintId) || "Sprint";

                    return (
                      <div key={plan.id} className="glass rounded-2xl p-5 shadow-card">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{sprintName}</span>
                              <Link
                                to="/sprints/$id"
                                params={{ id: plan.sprintId }}
                                className="text-xs text-primary underline underline-offset-4"
                              >
                                Abrir sprint
                              </Link>
                            </div>
                            <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                              <span>Planejado: {formatHoursLabel(planSummary.plannedHours)}</span>
                              <span>Realizado: {formatHoursLabel(planSummary.realizedHours)}</span>
                              <span>Story points: {plan.storyPoints || 0}</span>
                              <span>Ordem: {plan.order ?? "-"}</span>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">
                              {plan.notes || "Sem observacao de planejamento."}
                            </p>
                          </div>
                          <span className={getPlanStatusClass(planSummary.status as "over" | "under" | "balanced")}>
                            {planSummary.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="history">
                <div className="glass rounded-2xl p-5 shadow-card">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <History className="h-4 w-4" /> Historico do registro
                  </h3>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li>Criado em {formatDateTime(activity.created_at)}</li>
                    <li>Atualizado em {formatDateTime(activity.updated_at)}</li>
                    <li>Ultimo apontamento: {displayEntries[0] ? formatDateTime(displayEntries[0].updatedAt || displayEntries[0].createdAt) : "Nao informado"}</li>
                  </ol>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <div className="glass rounded-2xl p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold">Detalhes</h3>
              <dl className="space-y-2 text-sm">
                {[
                  ["Tipo", activity.type || "-"],
                  ["Status", formatActivityStatusLabel(activity.status || "Backlog")],
                  ["Prioridade", formatPriorityLabel(activity.priority || "Media")],
                  ["Projeto", activity.project_name || "-"],
                  ["Chamado de origem", activity.ticket_code || "-"],
                  ["Responsavel sugerido", activity.assignee_name || "-"],
                  ["Custo por hora", calculateHourlyCost ? "Ativo" : "Desativado"],
                  ["Estimativa total", formatHoursLabel(executionSummary.estimatedHours)],
                  ["Realizado", formatHoursLabel(executionSummary.realizedHours)],
                  ["Planejado em sprints", formatHoursLabel(executionSummary.plannedHours)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="glass rounded-2xl p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold">Tags</h3>
              {tagBadges.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma tag vinculada.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tagBadges.map((tag) => (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                        tag.active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted/20 text-muted-foreground"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full border border-white/10"
                        style={{ backgroundColor: tag.color || "#5ea8ff" }}
                      />
                      <span>{tag.name}</span>
                      {!tag.active ? (
                        <span className="text-[10px] uppercase">{tag.isLegacy ? "Legada" : "Inativa"}</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <InfoPanel
              icon={Link2}
              text={
                activity.ticket_code
                  ? `Atividade vinculada ao chamado ${activity.ticket_code}.`
                  : "Atividade sem chamado de origem."
              }
            />
            <InfoPanel
              icon={TimerReset}
              text={
                executionSummary.isEstimateExceeded
                  ? `A estimativa foi estourada em ${formatHoursLabel(executionSummary.estimatedOverflowHours)}.`
                  : `Saldo atual da estimativa: ${formatHoursLabel(Math.max(0, executionSummary.estimatedBalanceHours))}.`
              }
            />
            <InfoPanel
              icon={Wallet}
              text={
                calculateHourlyCost
                  ? `Os apontamentos geram custo automatico. Total atual: ${formatCurrency(totalGeneratedCost)}.`
                  : "Os apontamentos desta atividade nao geram custo automatico."
              }
            />
          </aside>
        </div>
      </div>

      <Dialog
        open={entryDialogOpen}
        onOpenChange={(open) => {
          setEntryDialogOpen(open);
          if (!open) {
            setEditingEntry(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl glass-strong">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Editar apontamento" : "Novo apontamento de trabalho"}
            </DialogTitle>
            <DialogDescription>
              Registre o tempo realmente trabalhado nesta atividade. O custo automatico sera gerado a partir daqui, se estiver habilitado.
            </DialogDescription>
          </DialogHeader>

          <ActivityTimeEntryForm
            key={editingEntry?.id || "new-activity-time-entry"}
            initial={toActivityTimeEntryFormData(editingEntry)}
            users={users}
            sprintOptions={sprintOptions}
            calculateHourlyCost={calculateHourlyCost}
            saving={savingEntry}
            submitLabel={editingEntry ? "Salvar apontamento" : "Criar apontamento"}
            onSubmit={handleSaveEntry}
          />
        </DialogContent>
      </Dialog>
    </AppShell>
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

function InfoPanel({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="glass flex items-center gap-2 rounded-2xl p-5 text-sm text-muted-foreground shadow-card">
      <Icon className="h-4 w-4" /> {text}
    </div>
  );
}

function DataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
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
