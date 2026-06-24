import { useMemo, useState } from "react";
import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, CheckCircle, ChevronRight, Pencil, Plus, Search, TimerReset, Trash2, TrendingUp, X } from "lucide-react";
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
import { listTickets } from "@/services/ticketService";
import { listActivityTags } from "@/services/activityTagService";
import {
  deleteSprintActivityPlan,
  listSprintActivityPlans,
  listSprintPlansBySprint,
  saveSprintActivityPlan,
} from "@/services/sprintActivityPlanService";
import {
  listSprintTicketPlansBySprint,
  saveSprintTicketPlan,
  deleteSprintTicketPlan,
} from "@/services/sprintTicketPlanService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/sprints/$id")({
  head: () => ({ meta: [{ title: "Detalhes da sprint · NimbusDesk" }] }),
  component: SprintDetail,
});

type WizardTicketRow = { ticketId: string; responsibleIds: string[]; userHours: Record<string,string>; plannedHours: string; storyPoints: string; priority: string; complexity: string; plannedEndDate: string; notes: string; savedId?: string };
type WizardActivityRow = { activityId: string; responsibleIds: string[]; userHours: Record<string,string>; plannedHours: string; storyPoints: string; priority: string; complexity: string; plannedEndDate: string; notes: string; savedId?: string };

const FIBONACCI_SP = [1, 2, 3, 5, 8, 13, 21] as const;
const SP_HOUR_THRESHOLDS: Record<number, number> = { 1: 2, 2: 4, 3: 8, 5: 16, 8: 24, 13: 40, 21: Infinity };

function hoursToSP(hours: number): number {
  for (const sp of FIBONACCI_SP) {
    if (hours <= SP_HOUR_THRESHOLDS[sp]) return sp;
  }
  return 21;
}

function spToHours(sp: number): number {
  const map: Record<number, number> = { 1: 2, 2: 4, 3: 8, 5: 16, 8: 24, 13: 40, 21: 48 };
  return map[sp] ?? 0;
}

const PRIORITY_OPTIONS = ["Crítica", "Alta", "Média", "Baixa"] as const;
const PRIORITY_COLORS: Record<string, string> = {
  "Crítica": "bg-red-500/15 text-red-500 border-red-500/30",
  "Alta": "bg-orange-500/15 text-orange-500 border-orange-500/30",
  "Média": "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  "Baixa": "bg-blue-500/15 text-blue-500 border-blue-500/30",
};

function UserHoursBreakdown({ users, responsible, userHours, totalHours, onChange }: {
  users: import("@/lib/types").User[]; responsible: string[]; userHours: Record<string,string>;
  totalHours: number; onChange: (uh: Record<string,string>) => void;
}) {
  const sum = responsible.reduce((s, uid) => s + (Number(userHours[uid]) || 0), 0);
  const diff = totalHours - sum;
  const getName = (uid: string) => {
    const u = users.find(x => String(x.id) === String(uid));
    if (!u) return "Carregando...";
    return u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || u.email || "Usuário";
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Distribuição de horas por técnico</span>
        {responsible.length > 0 && totalHours > 0 && (
          <span className={`text-xs font-medium ${Math.abs(diff) < 0.01 ? "text-success" : "text-warning"}`}>
            {Math.abs(diff) < 0.01 ? "✓ Balanceado" : diff > 0 ? `Faltam ${diff.toFixed(1)}h` : `Excedente ${Math.abs(diff).toFixed(1)}h`}
          </span>
        )}
      </div>
      {responsible.length === 0 && <p className="text-xs text-muted-foreground">Adicione responsáveis para distribuir as horas.</p>}
      {responsible.map(uid => {
        const name = getName(uid);
        const h = Number(userHours[uid]) || 0;
        const pct = totalHours > 0 ? Math.min(100, (h / totalHours) * 100) : 0;
        return (
          <div key={uid} className="flex items-center gap-3">
            <span className="w-32 truncate text-xs font-medium">{name}</span>
            <input
              type="number" min="0" step="0.5"
              value={userHours[uid] ?? ""}
              onChange={e => onChange({ ...userHours, [uid]: e.target.value })}
              className="w-20 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs outline-none focus:border-primary"
            />
            <span className="text-xs text-muted-foreground">h</span>
            <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
      {responsible.length > 1 && (
        <button type="button"
          onClick={() => {
            const perUser = totalHours / responsible.length;
            onChange(Object.fromEntries(responsible.map(uid => [uid, String(perUser.toFixed(1))])));
          }}
          className="text-xs text-primary hover:underline"
        >
          Distribuir igualmente
        </button>
      )}
    </div>
  );
}


function SprintDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SprintActivityPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardTicketRows, setWizardTicketRows] = useState<WizardTicketRow[]>([]);
  const [wizardActivityRows, setWizardActivityRows] = useState<WizardActivityRow[]>([]);
  const [wizardTicketSearch, setWizardTicketSearch] = useState("");
  const [wizardActivitySearch, setWizardActivitySearch] = useState("");
  const [wizardSaving, setWizardSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
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
  const ticketsQuery = useQuery({
    queryKey: ["tickets-for-sprint-wizard"],
    queryFn: () => listTickets({ page_size: 200 }),
    enabled: wizardOpen,
  });
  const ticketPlansQuery = useQuery({
    queryKey: ["sprint-ticket-plans", id],
    queryFn: () => listSprintTicketPlansBySprint(id),
  });
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

  const sprintDays = useMemo(() => {
    if (!sprint?.start_at || !sprint?.end_at) return 10;
    const start = new Date(sprint.start_at);
    const end = new Date(sprint.end_at);
    let days = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) days++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, days);
  }, [sprint?.start_at, sprint?.end_at]);
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

  const openWizard = () => {
    setWizardStep(1);
    setWizardTicketSearch("");
    setWizardActivitySearch("");
    // pre-populate from existing saved plans
    const existingTicketPlans = ticketPlansQuery.data || [];
    setWizardTicketRows(existingTicketPlans.map((p) => ({
      ticketId: p.ticketId,
      responsibleIds: p.responsibleIds || [],
      userHours: Object.fromEntries(Object.entries(p.userHours || {}).map(([k,v]) => [k, String(v)])),
      plannedHours: String(p.plannedHours ?? ""),
      storyPoints: p.storyPoints != null ? String(p.storyPoints) : "",
      priority: p.priority || "Média",
      complexity: p.complexity ? String(p.complexity) : "",
      plannedEndDate: p.plannedEndDate || "",
      notes: p.notes || "",
      savedId: p.id,
    })));
    const existingActivityPlans = plansQuery.data || [];
    setWizardActivityRows(existingActivityPlans.map((p) => ({
      activityId: p.activityId,
      responsibleIds: p.responsibleIds || [],
      userHours: Object.fromEntries(Object.entries(p.userHours || {}).map(([k,v]) => [k, String(v)])),
      plannedHours: String(p.plannedHours ?? ""),
      storyPoints: p.storyPoints != null ? String(p.storyPoints) : "",
      priority: p.priority || "Média",
      complexity: p.complexity ? String(p.complexity) : "",
      plannedEndDate: p.plannedEndDate || "",
      notes: p.notes || "",
      savedId: p.id,
    })));
    setWizardOpen(true);
  };

  const handleWizardNext = async () => {
    if (wizardStep === 1) {
      if (wizardTicketRows.length === 0) { setWizardStep(2); return; }
      setWizardSaving(true);
      try {
        const updatedRows = [...wizardTicketRows];
        for (let i = 0; i < updatedRows.length; i++) {
          const row = updatedRows[i];
          const payload = {
            sprintId: id,
            ticketId: row.ticketId,
            responsibleIds: row.responsibleIds,
            plannedHours: Number(row.plannedHours || 0),
            storyPoints: row.storyPoints ? Number(row.storyPoints) : undefined,
            notes: row.notes,
            userHours: Object.fromEntries(Object.entries(row.userHours).map(([k,v]) => [k, Number(v) || 0])),
            priority: row.priority || "Média",
            complexity: row.complexity ? Number(row.complexity) : undefined,
            plannedEndDate: row.plannedEndDate || "",
          };
          if (row.savedId) {
            await saveSprintTicketPlan({ ...payload, id: row.savedId }, "edit", row.savedId);
          } else {
            const saved = await saveSprintTicketPlan(payload, "create");
            updatedRows[i] = { ...row, savedId: saved.id };
          }
        }
        setWizardTicketRows(updatedRows);
        await queryClient.invalidateQueries({ queryKey: ["sprint-ticket-plans", id] });
        toast.success("Chamados salvos.");
        setWizardStep(2);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar chamados.");
      } finally {
        setWizardSaving(false);
      }
    } else if (wizardStep === 2) {
      if (wizardActivityRows.length === 0) { setWizardStep(3); return; }
      setWizardSaving(true);
      try {
        const updatedRows = [...wizardActivityRows];
        for (let i = 0; i < updatedRows.length; i++) {
          const row = updatedRows[i];
          const activity = activities.find((a) => a.id === row.activityId);
          if (!activity) continue;
          const payload = {
            sprintId: id,
            activityId: row.activityId,
            projectId: activity.project || "",
            responsibleIds: row.responsibleIds,
            plannedHours: Number(row.plannedHours || 0),
            storyPoints: row.storyPoints ? Number(row.storyPoints) : undefined,
            plannedEndDate: row.plannedEndDate || "",
            notes: row.notes,
            userHours: Object.fromEntries(Object.entries(row.userHours).map(([k,v]) => [k, Number(v) || 0])),
            priority: row.priority || "Média",
            complexity: row.complexity ? Number(row.complexity) : undefined,
          };
          if (row.savedId) {
            await saveSprintActivityPlan({ ...payload, id: row.savedId }, "edit", row.savedId);
          } else {
            const saved = await saveSprintActivityPlan(payload, "create");
            updatedRows[i] = { ...row, savedId: saved.id };
          }
        }
        setWizardActivityRows(updatedRows);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] }),
          queryClient.invalidateQueries({ queryKey: ["all-sprint-activity-plans"] }),
        ]);
        toast.success("Atividades salvas.");
        setWizardStep(3);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar atividades.");
      } finally {
        setWizardSaving(false);
      }
    }
  };

  const handleWizardFinish = async () => {
    await queryClient.invalidateQueries({ queryKey: ["sprint", id] });
    toast.success("Planejamento concluído!");
    setWizardOpen(false);
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
                onClick={openWizard}
              >
                <Plus className="h-4 w-4" />
                Planejar sprint
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


      {/* ─── 3-step planning wizard ─── */}
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) setWizardOpen(false); }}>
        <DialogContent className="max-w-6xl glass-strong max-h-[90vh] flex flex-col overflow-hidden p-0">
          {/* wizard header + step indicators */}
          <div className="flex-shrink-0 border-b border-border px-6 pt-5 pb-4">
            <DialogTitle className="text-lg font-semibold">Planejamento da sprint</DialogTitle>
            <DialogDescription className="sr-only">Planejamento em 3 etapas</DialogDescription>
            <div className="mt-4 flex items-center gap-2">
              {(["Chamados", "Atividades", "Finalização"] as const).map((label, idx) => {
                const step = (idx + 1) as 1 | 2 | 3;
                const done = wizardStep > step;
                const active = wizardStep === step;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      done ? "bg-primary text-primary-foreground" :
                      active ? "bg-gradient-primary text-white shadow-glow" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <Check className="h-3.5 w-3.5" /> : step}
                    </div>
                    <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                    {idx < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* step content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">

            {/* ── STEP 1: Chamados ── */}
            {wizardStep === 1 && (() => {
              type TicketItem = { id: string; code?: string; title?: string; status?: string; sprint?: string | null; priority?: string };
              const allTickets = (Array.isArray(ticketsQuery.data)
                ? ticketsQuery.data
                : (ticketsQuery.data as { results?: unknown[] } | undefined)?.results ?? []) as TicketItem[];
              const openTickets = allTickets.filter((t) => t.status !== "Resolvido" && t.status !== "Fechado" && t.status !== "Cancelado");
              const addedIds = new Set(wizardTicketRows.map((r) => r.ticketId));
              const available = openTickets.filter((t) => !addedIds.has(t.id));
              const searchLower = wizardTicketSearch.toLowerCase();
              const filteredAvailable = wizardTicketSearch.trim()
                ? available.filter((t) => (t.title ?? "").toLowerCase().includes(searchLower) || (t.code ?? "").toLowerCase().includes(searchLower))
                : available;

              const updateTicketRow = (ticketId: string, patch: Partial<WizardTicketRow>) => {
                setWizardTicketRows((prev) => prev.map((r) => r.ticketId === ticketId ? { ...r, ...patch } : r));
              };

              return (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Adicione chamados que serão trabalhados nesta sprint e defina responsáveis e horas planejadas para cada um.</p>

                  {/* add ticket search */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 px-4 text-sm text-primary transition hover:border-primary hover:bg-primary/5">
                        <Plus className="h-4 w-4" />
                        Adicionar chamado
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0 glass" align="start">
                      <div className="p-3 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            autoFocus
                            value={wizardTicketSearch}
                            onChange={(e) => setWizardTicketSearch(e.target.value)}
                            placeholder="Buscar por código ou título..."
                            className="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-9 pr-3 text-sm outline-none"
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {ticketsQuery.isLoading ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">Carregando...</p>
                        ) : filteredAvailable.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">Nenhum chamado disponível.</p>
                        ) : (
                          filteredAvailable.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/40 transition"
                              onClick={() => {
                                setWizardTicketRows((prev) => [...prev, { ticketId: t.id, responsibleIds: [], userHours: {}, plannedHours: "", storyPoints: "", priority: "Média", complexity: "", plannedEndDate: "", notes: "" }]);
                                setWizardTicketSearch("");
                              }}
                            >
                              <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{t.code}</span>
                              <span className="min-w-0 flex-1 truncate">{t.title}</span>
                              {t.priority && <span className="shrink-0 text-[10px] text-muted-foreground">{t.priority}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* inline table */}
                  <div>
                      {wizardTicketRows.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                                <th className="px-3 py-2 text-left font-medium">Chamado</th>
                                <th className="px-3 py-2 text-left font-medium w-44">Responsáveis</th>
                                <th className="px-3 py-2 text-left font-medium w-20">SP</th>
                                <th className="px-3 py-2 text-left font-medium w-20">Horas</th>
                                <th className="px-3 py-2 text-left font-medium w-28">Previsão término</th>
                                <th className="px-3 py-2 w-8" />
                                <th className="px-3 py-2 w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {wizardTicketRows.map((row) => {
                                const ticket = (allTickets as TicketItem[]).find((t) => t.id === row.ticketId);
                                const rowKey = `ticket-${row.ticketId}`;
                                const isExpanded = expandedRows.has(rowKey);
                                return (
                                  <>
                                    <tr key={row.ticketId} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <Badge className={`shrink-0 text-[10px] border ${PRIORITY_COLORS[row.priority] || ""}`}>{row.priority}</Badge>
                                          <div>
                                            <span className="font-mono text-xs text-muted-foreground">{ticket?.code} </span>
                                            <span className="truncate">{ticket?.title ?? row.ticketId}</span>
                                            {row.savedId && <span className="ml-2 text-[10px] text-primary">✓</span>}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <WizardUserSelect
                                          users={users}
                                          selected={row.responsibleIds}
                                          onChange={(ids) => updateTicketRow(row.ticketId, { responsibleIds: ids })}
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <select
                                          value={row.storyPoints}
                                          onChange={(e) => {
                                            const sp = Number(e.target.value);
                                            updateTicketRow(row.ticketId, { storyPoints: e.target.value, plannedHours: sp ? String(spToHours(sp)) : row.plannedHours });
                                          }}
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                        >
                                          <option value="">—</option>
                                          {FIBONACCI_SP.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                                        </select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          value={row.plannedHours}
                                          onChange={(e) => {
                                            const h = Number(e.target.value);
                                            updateTicketRow(row.ticketId, { plannedHours: e.target.value, storyPoints: h ? String(hoursToSP(h)) : row.storyPoints });
                                          }}
                                          placeholder="0"
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="date"
                                          value={row.plannedEndDate}
                                          onChange={(e) => updateTicketRow(row.ticketId, { plannedEndDate: e.target.value })}
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <button type="button" onClick={() => setExpandedRows(prev => { const n = new Set(prev); n.has(rowKey) ? n.delete(rowKey) : n.add(rowKey); return n; })} className="text-muted-foreground hover:text-foreground transition text-xs">
                                          {isExpanded ? "▲" : "▼"}
                                        </button>
                                      </td>
                                      <td className="px-3 py-2">
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (row.savedId) {
                                              try { await deleteSprintTicketPlan(row.savedId); } catch { /* ignore */ }
                                            }
                                            setWizardTicketRows((prev) => prev.filter((r) => r.ticketId !== row.ticketId));
                                          }}
                                          className="text-destructive/50 hover:text-destructive transition"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr key={`${row.ticketId}-expanded`} className="border-b border-border bg-muted/10">
                                        <td colSpan={7} className="px-4 py-3 space-y-3">
                                          <UserHoursBreakdown
                                            users={users}
                                            responsible={row.responsibleIds}
                                            userHours={row.userHours}
                                            totalHours={Number(row.plannedHours) || 0}
                                            onChange={(uh) => updateTicketRow(row.ticketId, { userHours: uh })}
                                          />
                                          <div className="flex items-start gap-6">
                                            <div className="space-y-1">
                                              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                                              <div className="flex gap-1.5">
                                                {PRIORITY_OPTIONS.map(p => (
                                                  <button key={p} type="button"
                                                    onClick={() => updateTicketRow(row.ticketId, { priority: p })}
                                                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${row.priority === p ? PRIORITY_COLORS[p] : "border-border text-muted-foreground hover:border-primary/50"}`}
                                                  >{p}</button>
                                                ))}
                                              </div>
                                            </div>
                                            <div className="flex-1 space-y-1">
                                              <label className="text-xs font-medium text-muted-foreground">Observações</label>
                                              <textarea
                                                rows={2}
                                                value={row.notes}
                                                onChange={e => updateTicketRow(row.ticketId, { notes: e.target.value })}
                                                placeholder="Adicione observações sobre este chamado na sprint..."
                                                className="w-full resize-none rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs outline-none focus:border-primary"
                                              />
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {wizardTicketRows.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">Nenhum chamado adicionado ainda.</p>
                      )}
                  </div>
                </div>
              );
            })()}

            {/* ── STEP 2: Atividades de projetos ── */}
            {wizardStep === 2 && (() => {
              const addedActivityIds = new Set(wizardActivityRows.map((r) => r.activityId));
              const availableActivities = planningOptions.filter((a) => !addedActivityIds.has(a.id));
              const actSearchLower = wizardActivitySearch.toLowerCase();
              const filteredActivities = wizardActivitySearch.trim()
                ? availableActivities.filter((a) => a.title.toLowerCase().includes(actSearchLower) || (a.projectName ?? "").toLowerCase().includes(actSearchLower))
                : availableActivities;

              const updateActivityRow = (activityId: string, patch: Partial<WizardActivityRow>) => {
                setWizardActivityRows((prev) => prev.map((r) => r.activityId === activityId ? { ...r, ...patch } : r));
              };

              return (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Adicione atividades de projetos que serão executadas nesta sprint. Edite diretamente na tabela.</p>

                  {/* add activity */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 px-4 text-sm text-primary transition hover:border-primary hover:bg-primary/5">
                        <Plus className="h-4 w-4" />
                        Adicionar atividade
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[540px] p-0 glass" align="start">
                      <div className="p-3 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            autoFocus
                            value={wizardActivitySearch}
                            onChange={(e) => setWizardActivitySearch(e.target.value)}
                            placeholder="Buscar por título ou projeto..."
                            className="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-9 pr-3 text-sm outline-none"
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredActivities.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma atividade disponível.</p>
                        ) : (
                          filteredActivities.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/40 transition"
                              onClick={() => {
                                setWizardActivityRows((prev) => [...prev, { activityId: a.id, responsibleIds: [], userHours: {}, plannedHours: String(a.estimatedBalanceHours > 0 ? a.estimatedBalanceHours : ""), storyPoints: "", priority: "Média", complexity: "", plannedEndDate: "", notes: "" }]);
                                setWizardActivitySearch("");
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{a.title}</div>
                                <div className="text-xs text-muted-foreground">{a.projectName} · saldo: {formatHoursLabel(a.estimatedBalanceHours)}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* inline table */}
                  <div>
                      {wizardActivityRows.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                                <th className="px-3 py-2 text-left font-medium">Atividade</th>
                                <th className="px-3 py-2 text-left font-medium w-44">Responsáveis</th>
                                <th className="px-3 py-2 text-left font-medium w-20">SP</th>
                                <th className="px-3 py-2 text-left font-medium w-20">Horas</th>
                                <th className="px-3 py-2 text-left font-medium w-28">Previsão término</th>
                                <th className="px-3 py-2 w-8" />
                                <th className="px-3 py-2 w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {wizardActivityRows.map((row) => {
                                const activity = activities.find((a) => a.id === row.activityId);
                                const rowKey = `activity-${row.activityId}`;
                                const isExpanded = expandedRows.has(rowKey);
                                return (
                                  <>
                                    <tr key={row.activityId} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <Badge className={`shrink-0 text-[10px] border ${PRIORITY_COLORS[row.priority] || ""}`}>{row.priority}</Badge>
                                          <div>
                                            <div className="truncate font-medium max-w-[150px]">{activity?.title ?? row.activityId}</div>
                                            {activity?.project_name && <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{activity.project_name}</div>}
                                            {row.savedId && <span className="text-[10px] text-primary">✓</span>}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <WizardUserSelect
                                          users={users}
                                          selected={row.responsibleIds}
                                          onChange={(ids) => updateActivityRow(row.activityId, { responsibleIds: ids })}
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <select
                                          value={row.storyPoints}
                                          onChange={(e) => {
                                            const sp = Number(e.target.value);
                                            updateActivityRow(row.activityId, { storyPoints: e.target.value, plannedHours: sp ? String(spToHours(sp)) : row.plannedHours });
                                          }}
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                        >
                                          <option value="">—</option>
                                          {FIBONACCI_SP.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                                        </select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          value={row.plannedHours}
                                          onChange={(e) => {
                                            const h = Number(e.target.value);
                                            updateActivityRow(row.activityId, { plannedHours: e.target.value, storyPoints: h ? String(hoursToSP(h)) : row.storyPoints });
                                          }}
                                          placeholder="0"
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="date"
                                          value={row.plannedEndDate}
                                          onChange={(e) => updateActivityRow(row.activityId, { plannedEndDate: e.target.value })}
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <button type="button" onClick={() => setExpandedRows(prev => { const n = new Set(prev); n.has(rowKey) ? n.delete(rowKey) : n.add(rowKey); return n; })} className="text-muted-foreground hover:text-foreground transition text-xs">
                                          {isExpanded ? "▲" : "▼"}
                                        </button>
                                      </td>
                                      <td className="px-3 py-2">
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (row.savedId) {
                                              try { await deleteSprintActivityPlan(row.savedId); await queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] }); } catch { /* ignore */ }
                                            }
                                            setWizardActivityRows((prev) => prev.filter((r) => r.activityId !== row.activityId));
                                          }}
                                          className="text-destructive/50 hover:text-destructive transition"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr key={`${row.activityId}-expanded`} className="border-b border-border bg-muted/10">
                                        <td colSpan={7} className="px-4 py-3 space-y-3">
                                          <UserHoursBreakdown
                                            users={users}
                                            responsible={row.responsibleIds}
                                            userHours={row.userHours}
                                            totalHours={Number(row.plannedHours) || 0}
                                            onChange={(uh) => updateActivityRow(row.activityId, { userHours: uh })}
                                          />
                                          <div className="flex items-start gap-6">
                                            <div className="space-y-1">
                                              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                                              <div className="flex gap-1.5">
                                                {PRIORITY_OPTIONS.map(p => (
                                                  <button key={p} type="button"
                                                    onClick={() => updateActivityRow(row.activityId, { priority: p })}
                                                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${row.priority === p ? PRIORITY_COLORS[p] : "border-border text-muted-foreground hover:border-primary/50"}`}
                                                  >{p}</button>
                                                ))}
                                              </div>
                                            </div>
                                            <div className="flex-1 space-y-1">
                                              <label className="text-xs font-medium text-muted-foreground">Observações</label>
                                              <textarea
                                                rows={2}
                                                value={row.notes}
                                                onChange={e => updateActivityRow(row.activityId, { notes: e.target.value })}
                                                placeholder="Adicione observações sobre esta atividade na sprint..."
                                                className="w-full resize-none rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs outline-none focus:border-primary"
                                              />
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {wizardActivityRows.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma atividade adicionada ainda.</p>
                      )}
                  </div>
                </div>
              );
            })()}

            {/* ── STEP 3: Finalização ── */}
            {wizardStep === 3 && (() => {
              const totalTicketHours = wizardTicketRows.reduce((s, r) => s + Number(r.plannedHours || 0), 0);
              const totalActivityHours = wizardActivityRows.reduce((s, r) => s + Number(r.plannedHours || 0), 0);
              const totalPlannedAfter = totalTicketHours + totalActivityHours;
              const totalSP = [...wizardTicketRows, ...wizardActivityRows].reduce((s, r) => s + (Number(r.storyPoints) || 0), 0);
              const capacity = sprint?.capacity ?? 0;
              const capacityPct = capacity > 0 ? Math.min(999, Math.round((totalPlannedAfter / capacity) * 100)) : 0;
              type TicketItem3 = { id: string; code?: string; title?: string };
              const allTickets3 = (Array.isArray(ticketsQuery.data)
                ? ticketsQuery.data
                : (ticketsQuery.data as { results?: unknown[] } | undefined)?.results ?? []) as TicketItem3[];

              return (
                <div className="space-y-5">
                  {/* 4 stat cards */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Total SP", value: String(totalSP) },
                      { label: "Total Horas", value: formatHoursLabel(totalPlannedAfter) },
                      { label: "Capacidade", value: formatHoursLabel(capacity) },
                      { label: "Utilização", value: `${capacityPct}%`, color: capacityPct > 100 ? "text-destructive" : capacityPct > 80 ? "text-warning" : "text-success" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl border border-border bg-card/60 p-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`mt-1 text-xl font-bold ${color ?? ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {capacity > 0 && (
                    <div className="space-y-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${capacityPct > 100 ? "bg-destructive" : "bg-gradient-primary"}`}
                          style={{ width: `${Math.min(100, capacityPct)}%` }}
                        />
                      </div>
                      {capacityPct > 100 && (
                        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          Planejamento excede a capacidade da sprint.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Chamados ({wizardTicketRows.length})
                      </p>
                      {wizardTicketRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum chamado.</p>
                      ) : (
                        <div className="space-y-1">
                          {wizardTicketRows.map((row) => {
                            const ticket = allTickets3.find((t) => t.id === row.ticketId);
                            return (
                              <div key={row.ticketId} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-sm">
                                <Badge className={`shrink-0 text-[10px] border ${PRIORITY_COLORS[row.priority] || ""}`}>{row.priority}</Badge>
                                <span className="font-mono text-xs text-muted-foreground">{ticket?.code}</span>
                                <span className="min-w-0 flex-1 truncate">{ticket?.title ?? row.ticketId}</span>
                                <span className="shrink-0 text-xs font-medium">{row.plannedHours ? `${row.plannedHours}h` : "—"}</span>
                                {row.storyPoints && <span className="shrink-0 text-xs text-muted-foreground">{row.storyPoints}SP</span>}
                                {row.savedId && <Check className="h-3 w-3 shrink-0 text-primary" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Atividades ({wizardActivityRows.length})
                      </p>
                      {wizardActivityRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma atividade.</p>
                      ) : (
                        <div className="space-y-1">
                          {wizardActivityRows.map((row) => {
                            const activity = activities.find((a) => a.id === row.activityId);
                            return (
                              <div key={row.activityId} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-sm">
                                <Badge className={`shrink-0 text-[10px] border ${PRIORITY_COLORS[row.priority] || ""}`}>{row.priority}</Badge>
                                <span className="min-w-0 flex-1 truncate">{activity?.title ?? row.activityId}</span>
                                <span className="shrink-0 text-xs font-medium">{row.plannedHours ? `${row.plannedHours}h` : "—"}</span>
                                {row.storyPoints && <span className="shrink-0 text-xs text-muted-foreground">{row.storyPoints}SP</span>}
                                {row.savedId && <Check className="h-3 w-3 shrink-0 text-primary" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>

          {/* wizard footer */}
          <div className="flex-shrink-0 flex items-center justify-between border-t border-border px-6 py-4">
            <Button
              variant="outline"
              onClick={() => {
                if (wizardStep === 1) setWizardOpen(false);
                else setWizardStep((s) => (s - 1) as 1 | 2 | 3);
              }}
              disabled={wizardSaving}
            >
              {wizardStep === 1 ? "Cancelar" : "← Voltar"}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Etapa {wizardStep} de 3</span>
              {wizardStep < 3 ? (
                <Button
                  onClick={handleWizardNext}
                  disabled={wizardSaving}
                  className="gap-1.5 bg-gradient-primary text-white shadow-glow hover:opacity-90"
                >
                  {wizardSaving ? "Salvando..." : <><span>Próximo</span><ChevronRight className="h-4 w-4" /></>}
                </Button>
              ) : (
                <Button
                  onClick={handleWizardFinish}
                  disabled={wizardSaving}
                  className="gap-1.5 bg-gradient-primary text-white shadow-glow hover:opacity-90"
                >
                  Concluir planejamento
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── edit single plan dialog (kept for inline edits) ─── */}
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

function WizardUserSelect({ users, selected, onChange }: { users: import("@/lib/types").User[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);

  const getUserLabel = (u: import("@/lib/types").User) =>
    u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || u.email || "Usuário";

  const toggle = (uid: string) => {
    const next = selectedSet.has(uid) ? selected.filter((x) => x !== uid) : [...selected, uid];
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex min-h-[32px] w-full flex-wrap items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-left text-xs hover:border-primary transition">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">Selecionar...</span>
          ) : (
            selected.slice(0, 3).map((uid) => {
              const u = users.find((x) => x.id === uid);
              const name = u ? getUserLabel(u) : uid;
              return (
                <span key={uid} className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary font-medium">
                  {name.split(" ")[0]}
                </span>
              );
            })
          )}
          {selected.length > 3 && <span className="text-[10px] text-muted-foreground">+{selected.length - 3}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1 glass" align="start">
        <div className="max-h-48 overflow-y-auto">
          {users.map((u) => {
            const checked = selectedSet.has(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/40 transition"
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${checked ? "border-primary bg-primary" : "border-border"}`}>
                  {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </div>
                <span className="truncate">{getUserLabel(u)}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
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
