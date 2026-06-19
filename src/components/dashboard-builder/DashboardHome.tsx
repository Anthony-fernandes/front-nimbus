import { type DragEvent as ReactDragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Ban,
  BarChart3,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Filter,
  Flag,
  FolderKanban,
  Funnel,
  Gauge,
  GripVertical,
  History,
  Layers3,
  LayoutDashboard,
  LineChart as LineChartIcon,
  ListTodo,
  Loader2,
  MessageSquare,
  Minus,
  PencilLine,
  PieChart,
  Play,
  Plus,
  Rocket,
  Save,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  Ticket as TicketIcon,
  TimerReset,
  Trash2,
  Type,
  UserRound,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import ReactGridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  DASHBOARD_COMPONENT_TEMPLATES,
  DASHBOARD_FILTER_DEFINITIONS,
  DASHBOARD_SOURCE_CATALOG,
  DASHBOARD_TONE_OPTIONS,
  STATUS_LABELS,
  VIEW_TYPE_LABELS,
  createDashboardComponent,
  createDashboardId,
  type DashboardComponentConfig,
  type DashboardComponentTemplate,
  type DashboardDefinition,
  type DashboardFilterDefinition,
  type DashboardFilterKey,
  type DashboardFilterState,
  type DashboardTone,
  type DashboardViewType,
  autoPackComponents,
} from "@/lib/dashboardBuilder";
import { getUserDisplayName, getUserRole } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type {
  Activity as ActivityType,
  ActivityTimeEntry,
  Organization,
  Project,
  Sprint,
  SprintActivityPlan,
  Ticket,
  User,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { listActivities } from "@/services/activityService";
import { listActivityTimeEntries } from "@/services/activityTimeEntryService";
import { getStoredUser } from "@/services/authService";
import { listClients } from "@/services/clientService";
import {
  buildFilterOptions,
  getDefaultFilterState,
  resolveComponentData,
  type DashboardFilterOptions,
  type DashboardResolvedData,
} from "@/services/dashboardBuilderData";
import {
  createDashboard,
  deleteDashboard,
  duplicateDashboard,
  listDashboards,
  publishDashboard,
  setActiveDashboard,
  updateDashboard,
} from "@/services/dashboardBuilderService";
import { listProjects } from "@/services/projectService";
import { getTicketsReport } from "@/services/reportService";
import { listSprintActivityPlans } from "@/services/sprintActivityPlanService";
import { listSprints } from "@/services/sprintService";
import { listTickets } from "@/services/ticketService";
import { listUsers } from "@/services/userService";

const DASHBOARDS_QUERY_KEY = ["dashboard-builder", "dashboards"] as const;
const EMPTY_OPTION_VALUE = "__empty__";
const LEGACY_GLOBAL_SECTION_TITLE = "Painel operacional global";
const OPERATIONAL_FILTER_TYPES: DashboardFilterKey[] = ["team", "sprint"];

const tooltipStyle = {
  background: "oklch(0.20 0.018 265)",
  border: "1px solid oklch(0.30 0.02 265)",
  borderRadius: 12,
  fontSize: 12,
  color: "oklch(0.97 0.01 250)",
  padding: "8px 10px",
};

const COMPONENT_LABELS: Record<DashboardComponentConfig["type"], string> = {
  kpi: "KPI",
  line: "Linha",
  bar: "Barra",
  donut: "Donut",
  table: "Tabela",
  list: "Lista",
  funnel: "Funil",
  progress: "Progresso",
  text: "Texto",
  section: "Secao",
  separator: "Separador",
  formula: "Métrica calculada",
};

const TONE_LABELS: Record<DashboardTone, string> = {
  primary: "Primario",
  accent: "Destaque",
  success: "Sucesso",
  warning: "Atencao",
  destructive: "Critico",
  neutral: "Neutro",
};

const TONE_CLASSES: Record<DashboardTone, string> = {
  primary: "text-primary bg-primary/12 border-primary/30",
  accent: "text-accent bg-accent/12 border-accent/30",
  success: "text-success bg-success/12 border-success/30",
  warning: "text-warning bg-warning/12 border-warning/30",
  destructive: "text-destructive bg-destructive/12 border-destructive/30",
  neutral: "text-muted-foreground bg-muted/40 border-border",
};

const TONE_ACCENTS: Record<DashboardTone, string> = {
  primary: "from-primary/18 via-primary/8 to-transparent",
  accent: "from-accent/18 via-accent/8 to-transparent",
  success: "from-success/18 via-success/8 to-transparent",
  warning: "from-warning/18 via-warning/8 to-transparent",
  destructive: "from-destructive/18 via-destructive/8 to-transparent",
  neutral: "from-muted/40 via-muted/15 to-transparent",
};

const TONE_GLOWS: Record<DashboardTone, string> = {
  primary: "bg-primary/18",
  accent: "bg-accent/18",
  success: "bg-success/16",
  warning: "bg-warning/18",
  destructive: "bg-destructive/18",
  neutral: "bg-muted/20",
};

const TONE_ICON_TEXT: Record<DashboardTone, string> = {
  primary: "text-primary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  neutral: "text-muted-foreground",
};

const TONE_CHART_COLORS: Record<DashboardTone, string[]> = {
  primary: ["oklch(0.72 0.20 260)", "oklch(0.62 0.14 245)", "oklch(0.58 0.12 225)"],
  accent: ["oklch(0.80 0.16 85)", "oklch(0.74 0.13 110)", "oklch(0.68 0.10 140)"],
  success: ["oklch(0.74 0.18 155)", "oklch(0.68 0.14 165)", "oklch(0.60 0.10 170)"],
  warning: ["oklch(0.78 0.16 75)", "oklch(0.72 0.13 60)", "oklch(0.66 0.11 45)"],
  destructive: ["oklch(0.68 0.22 28)", "oklch(0.62 0.18 20)", "oklch(0.56 0.14 12)"],
  neutral: ["oklch(0.64 0.03 260)", "oklch(0.58 0.02 250)", "oklch(0.50 0.02 240)"],
};

const COL_SPAN_CLASS: Record<number, string> = {
  1: "md:col-span-1 xl:col-span-1",
  2: "md:col-span-1 xl:col-span-2",
  3: "md:col-span-1 xl:col-span-3",
  4: "md:col-span-2 xl:col-span-4",
  5: "md:col-span-2 xl:col-span-5",
  6: "md:col-span-2 xl:col-span-6",
  7: "md:col-span-2 xl:col-span-7",
  8: "md:col-span-2 xl:col-span-8",
  9: "md:col-span-2 xl:col-span-9",
  10: "md:col-span-2 xl:col-span-10",
  11: "md:col-span-2 xl:col-span-11",
  12: "md:col-span-2 xl:col-span-12",
};

const BUILDER_GRID_COLUMNS = 12;
const BUILDER_GRID_GAP = 12;
const BUILDER_GRID_ROW_HEIGHT = 110;

type DashboardGridLayout = DashboardComponentConfig["layout"];
type BuilderGridRect = { x: number; y: number; w: number; h: number };

type BuilderDragDescriptor =
  | {
      kind: "component";
      componentId: string;
      type: DashboardComponentConfig["type"];
      w: number;
      h: number;
    }
  | {
      kind: "template";
      templateType: DashboardComponentConfig["type"];
      w: number;
      h: number;
    };

const ICON_MAP: Record<string, LucideIcon> = {
  activity: Activity,
  "alert-triangle": AlertTriangle,
  ban: Ban,
  "bar-chart-3": BarChart3,
  "building-2": Building2,
  "calendar-days": CalendarDays,
  "calendar-range": CalendarRange,
  "check-circle-2": CheckCircle2,
  "circle-dot": CircleDot,
  "clock-3": Clock3,
  flag: Flag,
  "folder-kanban": FolderKanban,
  funnel: Funnel,
  gauge: Gauge,
  "kanban-square": LayoutDashboard,
  "layout-dashboard": LayoutDashboard,
  "layers-3": Layers3,
  "line-chart": LineChartIcon,
  list: ListTodo,
  "list-todo": ListTodo,
  "message-square": MessageSquare,
  "messages-square": MessageSquare,
  minus: Minus,
  "pie-chart": PieChart,
  play: Play,
  "play-circle": Play,
  progress: Gauge,
  rocket: Rocket,
  section: LayoutDashboard,
  "shield-alert": ShieldAlert,
  siren: AlertTriangle,
  table: LayoutDashboard,
  ticket: TicketIcon,
  "timer-reset": TimerReset,
  type: Type,
  "user-round": UserRound,
  "user-x": UserX,
  users: Users,
};

type CreateDashboardForm = {
  name: string;
  description: string;
  type: DashboardViewType;
};

type DashboardMetric = {
  component: DashboardComponentConfig;
  data: DashboardResolvedData;
};

type DashboardComponentPatch = Omit<Partial<DashboardComponentConfig>, "layout"> & {
  layout?: Partial<DashboardComponentConfig["layout"]>;
};

type DashboardHomeScreen = "viewer" | "builder";
type BuilderSidebarTab = "inspector" | "dashboard" | "history";

const LIBRARY_GROUPS = [
  {
    id: "indicators",
    label: "Indicadores",
    types: ["kpi", "progress"] as DashboardComponentConfig["type"][],
  },
  {
    id: "charts",
    label: "Graficos",
    types: ["line", "bar", "donut", "funnel"] as DashboardComponentConfig["type"][],
  },
  {
    id: "data",
    label: "Dados",
    types: ["table", "list"] as DashboardComponentConfig["type"][],
  },
  {
    id: "layout",
    label: "Layout",
    types: ["text", "section", "separator"] as DashboardComponentConfig["type"][],
  },
] as const;

const ICON_OPTIONS = Object.keys(ICON_MAP)
  .sort((left, right) => left.localeCompare(right, "pt-BR"))
  .map((key) => ({ value: key, label: key.replaceAll("-", " ") }));

export function DashboardHome({ screen = "viewer" }: { screen?: DashboardHomeScreen }) {
  const editing = screen === "builder";
  const currentUser = getStoredUser<User>();
  const queryClient = useQueryClient();
  const canManageDashboards =
    getUserRole(currentUser) === "ADMIN" || hasPermission(currentUser, "settings.edit");

  const dashboardsQuery = useQuery({
    queryKey: DASHBOARDS_QUERY_KEY,
    queryFn: () => listDashboards(),
  });

  const dataQueries = useQueries({
    queries: [
      { queryKey: ["dashboard-data", "tickets"], queryFn: () => listTickets() },
      { queryKey: ["dashboard-data", "users"], queryFn: () => listUsers() },
      { queryKey: ["dashboard-data", "sprints"], queryFn: () => listSprints() },
      { queryKey: ["dashboard-data", "activities"], queryFn: () => listActivities() },
      { queryKey: ["dashboard-data", "sprint-plans"], queryFn: () => listSprintActivityPlans() },
      { queryKey: ["dashboard-data", "time-entries"], queryFn: () => listActivityTimeEntries() },
      { queryKey: ["dashboard-data", "projects"], queryFn: () => listProjects() },
      { queryKey: ["dashboard-data", "clients"], queryFn: () => listClients() },
    ],
  });

  const tickets = (dataQueries[0].data as Ticket[] | undefined) ?? [];
  const users = (dataQueries[1].data as User[] | undefined) ?? [];
  const sprints = (dataQueries[2].data as Sprint[] | undefined) ?? [];
  const activities = (dataQueries[3].data as ActivityType[] | undefined) ?? [];
  const sprintPlans = (dataQueries[4].data as SprintActivityPlan[] | undefined) ?? [];
  const timeEntries = (dataQueries[5].data as ActivityTimeEntry[] | undefined) ?? [];
  const projects = (dataQueries[6].data as Project[] | undefined) ?? [];
  const clients = (dataQueries[7].data as Organization[] | undefined) ?? [];
  const isDataLoading = dataQueries.some((query) => query.isLoading);

  const dashboardDataContext = useMemo(
    () => ({
      tickets,
      users,
      sprints,
      activities,
      sprintPlans,
      timeEntries,
      projects,
      clients,
    }),
    [activities, clients, projects, sprintPlans, sprints, tickets, timeEntries, users],
  );

  const dashboards = useMemo(
    () =>
      sortDashboards(
        ((dashboardsQuery.data as DashboardDefinition[] | undefined) ?? []).map(
          (dashboard) => normalizeDashboard(sanitizeOperationalDashboard(dashboard)),
        ),
      ),
    [dashboardsQuery.data],
  );
  const activeDashboard = useMemo(
    () => dashboards.find((dashboard) => dashboard.isActive) || dashboards[0] || null,
    [dashboards],
  );

  const [selectedDashboardId, setSelectedDashboardId] = useState("");
  const [draftDashboard, setDraftDashboard] = useState<DashboardDefinition | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [filterState, setFilterState] = useState<DashboardFilterState>({});
  const [createForm, setCreateForm] = useState<CreateDashboardForm>({
    name: "",
    description: "",
    type: "custom",
  });
  const [librarySearch, setLibrarySearch] = useState("");
  const [builderSidebarTab, setBuilderSidebarTab] = useState<BuilderSidebarTab>("dashboard");

  useEffect(() => {
    if (!dashboards.length) {
      return;
    }

    const isValidSelection = dashboards.some((dashboard) => dashboard.id === selectedDashboardId);
    if (!isValidSelection) {
      setSelectedDashboardId(activeDashboard?.id || dashboards[0].id);
    }
  }, [activeDashboard?.id, dashboards, selectedDashboardId]);

  const selectedDashboard = useMemo(
    () => dashboards.find((dashboard) => dashboard.id === selectedDashboardId) || activeDashboard,
    [activeDashboard, dashboards, selectedDashboardId],
  );

  useEffect(() => {
    if (!editing || !selectedDashboard) {
      return;
    }

    setDraftDashboard((current) => {
      if (current && current.id === selectedDashboard.id) {
        return current;
      }

      const cloned = cloneDashboard(selectedDashboard);

      // If all components have x=0 (legacy/unpositioned), auto-pack them so
      // the fixed positions are stored in the draft and saved when the user hits Save.
      const allUnpositioned =
        cloned.components.length > 0 &&
        cloned.components.every((c) => (c.layout.x ?? 0) === 0);
      if (allUnpositioned) {
        const packed = autoPackComponents(cloned.components);
        return { ...cloned, components: packed };
      }

      return cloned;
    });
  }, [editing, selectedDashboard]);

  useEffect(() => {
    if (!editing) {
      setSelectedComponentId(null);
      setDraftDashboard(null);
    }
  }, [editing]);

  const dashboardInView = useMemo(
    () => (editing ? draftDashboard || selectedDashboard || activeDashboard : activeDashboard),
    [activeDashboard, draftDashboard, editing, selectedDashboard],
  );

  const filterOptions = useMemo(
    () => buildFilterOptions(dashboardDataContext),
    [dashboardDataContext],
  );

  useEffect(() => {
    if (!dashboardInView) {
      return;
    }

    setFilterState((current) => {
      const next = mergeFilterState(current, dashboardInView, filterOptions);
      return areFilterStatesEqual(current, next) ? current : next;
    });
  }, [dashboardInView, filterOptions]);

  const visibleComponents = useMemo(
    () =>
      sortComponents(dashboardInView?.components || []).filter(
        (component) => editing || component.isVisible,
      ),
    [dashboardInView?.components, editing],
  );
  const metrics: DashboardMetric[] = useMemo(
    () =>
      visibleComponents.map((component) => ({
        component,
        data: resolveComponentData(component, dashboardDataContext, filterState),
      })),
    [dashboardDataContext, filterState, visibleComponents],
  );
  const selectedComponent =
    editing && draftDashboard && selectedComponentId
      ? draftDashboard.components.find((component) => component.id === selectedComponentId) || null
      : null;
  const comparableDraft = editing && draftDashboard && selectedDashboard ? draftDashboard : null;
  const comparableSelected = editing && draftDashboard && selectedDashboard ? selectedDashboard : null;

  const isDashboardDirty =
    comparableDraft && comparableSelected
      ? serializeDashboard(comparableDraft) !== serializeDashboard(comparableSelected)
      : false;

  useEffect(() => {
    if (!editing) {
      return;
    }

    if (selectedComponentId) {
      setBuilderSidebarTab("inspector");
    }
  }, [editing, selectedComponentId]);

  async function refreshDashboards() {
    return queryClient.fetchQuery({
      queryKey: DASHBOARDS_QUERY_KEY,
      queryFn: () => listDashboards(),
    });
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setPendingAction(label);

    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel concluir a acao.";
      toast.error(message);
    } finally {
      setPendingAction("");
    }
  }

  function updateDraft(mutator: (dashboard: DashboardDefinition) => DashboardDefinition) {
    setDraftDashboard((current) => {
      if (!current) {
        return current;
      }

      return normalizeDashboard(mutator(cloneDashboard(current)));
    });
  }

  async function handleCreateDashboard() {
    await runAction("create", async () => {
      const created = await createDashboard({
        name: createForm.name.trim() || "Novo dashboard",
        description: createForm.description.trim(),
        type: createForm.type,
        createdBy: getUserDisplayName(currentUser),
        status: "draft",
      });

      await refreshDashboards();
      setCreateOpen(false);
      setCreateForm({ name: "", description: "", type: "custom" });
      setSelectedDashboardId(created.id);
      setDraftDashboard(cloneDashboard(created));
      toast.success("Dashboard criado no editor.");
    });
  }

  async function handleSaveDashboard() {
    if (!draftDashboard) {
      return;
    }

    await runAction("save", async () => {
      const saved = await updateDashboard(draftDashboard.id, draftDashboard);
      await refreshDashboards();
      setSelectedDashboardId(saved.id);
      setDraftDashboard(cloneDashboard(saved));
      toast.success("Dashboard salvo.");
    });
  }

  async function handlePublishDashboard() {
    const target = draftDashboard || selectedDashboard;
    if (!target) {
      return;
    }

    await runAction("publish", async () => {
      if (draftDashboard && isDashboardDirty) {
        await updateDashboard(draftDashboard.id, draftDashboard);
      }

      const published = await publishDashboard(target.id);
      await refreshDashboards();
      setSelectedDashboardId(published?.id || target.id);
      setDraftDashboard(cloneDashboard(published || target));
      toast.success("Dashboard publicado e ativado.");
    });
  }

  async function handleSetActiveDashboard() {
    const target = editing ? draftDashboard || selectedDashboard : selectedDashboard || activeDashboard;
    if (!target) {
      return;
    }

    await runAction("activate", async () => {
      if (draftDashboard && isDashboardDirty) {
        await updateDashboard(draftDashboard.id, draftDashboard);
      }

      const activated = await setActiveDashboard(target.id);
      await refreshDashboards();
      setDraftDashboard(activated ? cloneDashboard(activated) : cloneDashboard(target));
      toast.success("Dashboard ativo atualizado.");
    });
  }

  async function handleDuplicateDashboard() {
    const target = selectedDashboard || activeDashboard;
    if (!target) {
      return;
    }

    await runAction("duplicate", async () => {
      const duplicated = await duplicateDashboard(target.id);
      await refreshDashboards();
      setSelectedDashboardId(duplicated.id);
      setDraftDashboard(cloneDashboard(duplicated));
      toast.success("Dashboard duplicado.");
    });
  }

  async function handleDeleteDashboard() {
    const target = selectedDashboard || activeDashboard;
    if (!target) {
      return;
    }

    await runAction("delete", async () => {
      await deleteDashboard(target.id);
      const nextDashboards = await refreshDashboards();
      const nextList = sortDashboards(nextDashboards as DashboardDefinition[]);
      setSelectedDashboardId(nextList.find((dashboard) => dashboard.isActive)?.id || nextList[0]?.id || "");
      setDraftDashboard(null);
      setSelectedComponentId(null);
      toast.success("Dashboard removido.");
    });
  }

  function handleAddComponent(
    templateType: DashboardComponentConfig["type"],
    layoutRect?: BuilderGridRect,
  ) {
    const template = DASHBOARD_COMPONENT_TEMPLATES.find((item) => item.type === templateType);
    if (!template) {
      return;
    }

    const component = createDashboardComponent(template, draftDashboard?.components.length || 0);
    const source = DASHBOARD_SOURCE_CATALOG.find((item) => item.key === template.defaultDataSource);

    if (source) {
      component.tone = source.tone;
      component.icon = source.icon;
      component.title = source.defaultTitle;
      component.subtitle = source.defaultSubtitle;
      component.dataSource = source.key;
    }

    if (layoutRect) {
      component.layout = buildComponentLayoutPatch(component, layoutRect);
    }

    updateDraft((dashboard) => ({
      ...dashboard,
      components: [...dashboard.components, component],
    }));
    setSelectedComponentId(component.id);
    setBuilderSidebarTab("inspector");
  }

  function handleDuplicateComponent(componentId: string) {
    updateDraft((dashboard) => {
      const sorted = sortComponents(dashboard.components);
      const index = sorted.findIndex((component) => component.id === componentId);
      if (index < 0) {
        return dashboard;
      }

      const duplicated = {
        ...cloneComponent(sorted[index]),
        id: createDashboardId("component"),
        title: `${sorted[index].title} (copia)`,
      };

      const next = [...sorted];
      next.splice(index + 1, 0, duplicated);
      return { ...dashboard, components: next };
    });
  }

  function handleMoveComponent(componentId: string, direction: -1 | 1) {
    updateDraft((dashboard) => {
      const target = dashboard.components.find((component) => component.id === componentId);
      if (!target) {
        return dashboard;
      }

      return {
        ...dashboard,
        components: dashboard.components.map((component) =>
          component.id === componentId
            ? {
                ...component,
                layout: buildComponentLayoutPatch(component, {
                  x: component.layout.x,
                  y: Math.max(0, component.layout.y + direction),
                  w: component.layout.w,
                  h: component.layout.h,
                }),
              }
            : component,
        ),
      };
    });
  }

  function handleRemoveComponent(componentId: string) {
    updateDraft((dashboard) => ({
      ...dashboard,
      components: dashboard.components.filter((component) => component.id !== componentId),
    }));

    if (selectedComponentId === componentId) {
      setSelectedComponentId(null);
    }
  }

  function handleToggleComponentVisibility(componentId: string) {
    updateDraft((dashboard) => ({
      ...dashboard,
      components: dashboard.components.map((component) =>
        component.id === componentId
          ? { ...component, isVisible: !component.isVisible }
          : component,
      ),
    }));
  }

  function updateComponent(componentId: string, patch: DashboardComponentPatch) {
    updateDraft((dashboard) => ({
      ...dashboard,
      components: dashboard.components.map((component) =>
        component.id === componentId ? applyDashboardComponentPatch(component, patch) : component,
      ),
    }));
  }

  function handleUpdateComponentLayout(componentId: string, rect: BuilderGridRect) {
    updateDraft((dashboard) => ({
      ...dashboard,
      components: dashboard.components.map((component) =>
        component.id === componentId
          ? {
              ...component,
              layout: buildComponentLayoutPatch(component, rect),
            }
          : component,
      ),
    }));
  }

  function updateDashboardFilter(filterId: string, patch: Partial<DashboardFilterDefinition>) {
    updateDraft((dashboard) => ({
      ...dashboard,
      filters: dashboard.filters.map((filter) =>
        filter.id === filterId ? { ...filter, ...patch } : filter,
      ),
    }));
  }

  function discardDraftChanges() {
    if (!selectedDashboard) {
      setDraftDashboard(null);
      setSelectedComponentId(null);
      return;
    }

    setDraftDashboard(cloneDashboard(selectedDashboard));
    setSelectedComponentId(null);
    toast.success("Alteracoes descartadas.");
  }

  const isEditorScreen = screen === "builder";
  const pageTitle = isEditorScreen ? "Editor de dashboards" : "Dashboard operacional";
  const pageSubtitle = isEditorScreen
    ? "Gerencie dashboards, publique versoes e ajuste o layout em uma tela dedicada de edicao."
    : "Acompanhe o dashboard ativo da operacao sem misturar visualizacao com configuracao.";
  const filteredTemplateGroups = useMemo(
    () =>
      LIBRARY_GROUPS.map((group) => ({
        ...group,
        templates: DASHBOARD_COMPONENT_TEMPLATES.filter((template) => {
          if (!group.types.includes(template.type)) {
            return false;
          }

          const query = librarySearch.trim().toLowerCase();
          if (!query) {
            return true;
          }

          return [
            template.label,
            template.description,
            COMPONENT_LABELS[template.type],
          ].some((value) => value.toLowerCase().includes(query));
        }),
      })).filter((group) => group.templates.length > 0),
    [librarySearch],
  );

  return (
    <DashboardWorkspace
      screen={screen}
      canManageDashboards={canManageDashboards}
      pageTitle={pageTitle}
      pageSubtitle={pageSubtitle}
      dashboards={dashboards}
      selectedDashboard={selectedDashboard}
      activeDashboard={activeDashboard}
      dashboardInView={dashboardInView}
      dashboardsLoading={dashboardsQuery.isLoading}
      dataLoading={isDataLoading}
      filterOptions={filterOptions}
      filterState={filterState}
      onFilterChange={(key, value) => {
        setFilterState((current) => ({
          ...current,
          [key]: value || undefined,
        }));
      }}
      onResetFilters={() => {
        if (!dashboardInView) {
          return;
        }

        setFilterState(getDefaultFilterState(dashboardInView));
      }}
      metrics={metrics}
      selectedComponentId={selectedComponentId}
      selectedComponent={selectedComponent}
      isDashboardDirty={Boolean(isDashboardDirty)}
      pendingAction={pendingAction}
      createOpen={createOpen}
      createForm={createForm}
      librarySearch={librarySearch}
      builderSidebarTab={builderSidebarTab}
      filteredTemplateGroups={filteredTemplateGroups}
      onBuilderSidebarTabChange={setBuilderSidebarTab}
      onLibrarySearchChange={setLibrarySearch}
      onSelectDashboard={(value) => {
        if (editing && isDashboardDirty) {
          toast.info("Salve ou cancele as alteracoes antes de trocar de dashboard.");
          return;
        }

        setSelectedDashboardId(value);
      }}
      onCreateOpenChange={setCreateOpen}
      onCreateFormChange={(patch) => setCreateForm((current) => ({ ...current, ...patch }))}
      onCreateDashboard={handleCreateDashboard}
      onCreateEmpty={() => setCreateOpen(true)}
      onDuplicateDashboard={handleDuplicateDashboard}
      onPublishDashboard={handlePublishDashboard}
      onSetActiveDashboard={handleSetActiveDashboard}
      onDeleteDashboard={handleDeleteDashboard}
      onDiscardChanges={discardDraftChanges}
      onSaveDashboard={handleSaveDashboard}
      onSelectComponent={(componentId) => {
        setSelectedComponentId(componentId);
        setBuilderSidebarTab("inspector");
      }}
      onConfigureDashboard={() => setBuilderSidebarTab("dashboard")}
      onAddComponent={handleAddComponent}
      onAddComponentAtLayout={handleAddComponent}
      onDuplicateComponent={handleDuplicateComponent}
      onMoveComponent={handleMoveComponent}
      onRemoveComponent={handleRemoveComponent}
      onToggleComponentVisibility={handleToggleComponentVisibility}
      onUpdateComponentLayout={handleUpdateComponentLayout}
      onUpdateComponent={(patch) => {
        if (!selectedComponent) {
          return;
        }

        updateComponent(selectedComponent.id, patch);
      }}
      onUpdateDashboard={(patch) =>
        updateDraft((dashboard) => ({
          ...dashboard,
          ...patch,
        }))
      }
      onUpdateDashboardFilter={updateDashboardFilter}
    />
  );

}

function DashboardWorkspace({
  screen,
  canManageDashboards,
  pageTitle,
  pageSubtitle,
  dashboards,
  selectedDashboard,
  activeDashboard,
  dashboardInView,
  dashboardsLoading,
  dataLoading,
  filterOptions,
  filterState,
  onFilterChange,
  onResetFilters,
  metrics,
  selectedComponentId,
  selectedComponent,
  isDashboardDirty,
  pendingAction,
  createOpen,
  createForm,
  librarySearch,
  builderSidebarTab,
  filteredTemplateGroups,
  onBuilderSidebarTabChange,
  onLibrarySearchChange,
  onSelectDashboard,
  onCreateOpenChange,
  onCreateFormChange,
  onCreateDashboard,
  onCreateEmpty,
  onDuplicateDashboard,
  onPublishDashboard,
  onSetActiveDashboard,
  onDeleteDashboard,
  onDiscardChanges,
  onSaveDashboard,
  onSelectComponent,
  onConfigureDashboard,
  onAddComponent,
  onAddComponentAtLayout,
  onDuplicateComponent,
  onMoveComponent,
  onRemoveComponent,
  onToggleComponentVisibility,
  onUpdateComponentLayout,
  onUpdateComponent,
  onUpdateDashboard,
  onUpdateDashboardFilter,
}: {
  screen: DashboardHomeScreen;
  canManageDashboards: boolean;
  pageTitle: string;
  pageSubtitle: string;
  dashboards: DashboardDefinition[];
  selectedDashboard: DashboardDefinition | null;
  activeDashboard: DashboardDefinition | null;
  dashboardInView: DashboardDefinition | null;
  dashboardsLoading: boolean;
  dataLoading: boolean;
  filterOptions: DashboardFilterOptions;
  filterState: DashboardFilterState;
  onFilterChange: (key: DashboardFilterKey, value: string) => void;
  onResetFilters: () => void;
  metrics: DashboardMetric[];
  selectedComponentId: string | null;
  selectedComponent: DashboardComponentConfig | null;
  isDashboardDirty: boolean;
  pendingAction: string;
  createOpen: boolean;
  createForm: CreateDashboardForm;
  librarySearch: string;
  builderSidebarTab: BuilderSidebarTab;
  filteredTemplateGroups: Array<{ id: string; label: string; templates: DashboardComponentTemplate[] }>;
  onBuilderSidebarTabChange: (tab: BuilderSidebarTab) => void;
  onLibrarySearchChange: (value: string) => void;
  onSelectDashboard: (value: string) => void;
  onCreateOpenChange: (open: boolean) => void;
  onCreateFormChange: (patch: Partial<CreateDashboardForm>) => void;
  onCreateDashboard: () => Promise<void>;
  onCreateEmpty: () => void;
  onDuplicateDashboard: () => Promise<void>;
  onPublishDashboard: () => Promise<void>;
  onSetActiveDashboard: () => Promise<void>;
  onDeleteDashboard: () => Promise<void>;
  onDiscardChanges: () => void;
  onSaveDashboard: () => Promise<void>;
  onSelectComponent: (componentId: string) => void;
  onConfigureDashboard: () => void;
  onAddComponent: (type: DashboardComponentConfig["type"]) => void;
  onAddComponentAtLayout: (type: DashboardComponentConfig["type"], layoutRect?: BuilderGridRect) => void;
  onDuplicateComponent: (componentId: string) => void;
  onMoveComponent: (componentId: string, direction: -1 | 1) => void;
  onRemoveComponent: (componentId: string) => void;
  onToggleComponentVisibility: (componentId: string) => void;
  onUpdateComponentLayout: (componentId: string, rect: BuilderGridRect) => void;
  onUpdateComponent: (patch: DashboardComponentPatch) => void;
  onUpdateDashboard: (patch: Partial<DashboardDefinition>) => void;
  onUpdateDashboardFilter: (filterId: string, patch: Partial<DashboardFilterDefinition>) => void;
}) {
  const isEditorScreen = screen === "builder";
  const currentDashboard = dashboardInView || selectedDashboard || activeDashboard;
  const dashboardPickerValue = selectedDashboard?.id || dashboardInView?.id || "";
  return (
    <AppShell>
      {isEditorScreen ? (
        <div className="-m-6 bg-background">
          <div className="relative z-10 border-b border-border bg-surface">
            <div className="flex flex-col gap-2 px-4 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground hover:bg-surface hover:text-foreground">
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <div className="text-[12.5px] text-muted-foreground">Editor</div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                <Select value={dashboardPickerValue} onValueChange={onSelectDashboard}>
                  <SelectTrigger className="h-8 min-w-[220px] flex-1 rounded-md border-0 bg-transparent px-2 text-left text-[13px] font-medium shadow-none hover:bg-surface focus:ring-0 sm:flex-none">
                    <SelectValue placeholder="Selecione um dashboard" />
                  </SelectTrigger>
                  <SelectContent>
                    {dashboards.map((dashboard) => (
                      <SelectItem key={dashboard.id} value={dashboard.id}>
                        {dashboard.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentDashboard ? (
                  <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-warning">
                    {STATUS_LABELS[currentDashboard.status]}
                  </span>
                ) : null}
                {isDashboardDirty ? (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-primary">
                    Alterado
                  </span>
                ) : null}

                <div className="min-[980px]:ml-auto" />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2">
                <Button variant="ghost" className="h-8 gap-1.5 px-2.5 text-[12.5px] text-muted-foreground hover:bg-surface hover:text-foreground" onClick={() => onBuilderSidebarTabChange("history")}>
                  <History className="h-3.5 w-3.5" /> Historico
                </Button>
                <Button variant="ghost" className="h-8 gap-1.5 px-2.5 text-[12.5px] text-muted-foreground hover:bg-surface hover:text-foreground" onClick={onConfigureDashboard}>
                  <Settings2 className="h-3.5 w-3.5" /> Dashboard
                </Button>
                <Button variant="ghost" className="h-8 gap-1.5 px-2.5 text-[12.5px] text-muted-foreground hover:bg-surface hover:text-foreground" onClick={() => onCreateOpenChange(true)}>
                  <Plus className="h-3.5 w-3.5" /> Novo
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 gap-1.5 px-2.5 text-[12.5px] text-muted-foreground hover:bg-surface hover:text-foreground"
                  onClick={() => void onDuplicateDashboard()}
                  disabled={!selectedDashboard || Boolean(pendingAction)}
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicar
                </Button>
                <Button asChild variant="ghost" className="h-8 gap-1.5 px-2.5 text-[12.5px] text-muted-foreground hover:bg-surface hover:text-foreground">
                  <Link to="/">
                    <Eye className="h-3.5 w-3.5" /> Visualizar
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 gap-1.5 px-2.5 text-[12.5px] text-muted-foreground hover:bg-surface hover:text-foreground"
                  onClick={onDiscardChanges}
                  disabled={!isDashboardDirty || Boolean(pendingAction)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  className="h-8 gap-1.5 px-2.5 text-[12.5px]"
                  onClick={() => void onSaveDashboard()}
                  disabled={!isDashboardDirty || Boolean(pendingAction)}
                >
                  {pendingAction === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar rascunho
                </Button>
                <Button
                  variant="outline"
                  className="h-8 gap-1.5 px-2.5 text-[12.5px]"
                  onClick={() => void onSetActiveDashboard()}
                  disabled={!selectedDashboard || Boolean(pendingAction)}
                >
                  <Send className="h-3.5 w-3.5" /> Ativar
                </Button>
                <Button
                  className="h-8 gap-1.5 px-3 text-[12.5px]"
                  onClick={() => void onPublishDashboard()}
                  disabled={!selectedDashboard || Boolean(pendingAction)}
                >
                  {pendingAction === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                  Publicar
                </Button>
                {selectedDashboard ? (
                  <ConfirmDelete
                    trigger={
                      <Button variant="outline" className="h-8 gap-1.5 border-destructive/40 px-2.5 text-[12.5px] text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>
                    }
                    title="Excluir dashboard?"
                    description="A configuracao atual sera removida. Se este dashboard estiver ativo, outro dashboard sera promovido."
                    onConfirm={() => void onDeleteDashboard()}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid min-h-[calc(100vh-3.5rem-3rem)] grid-cols-1 lg:grid-cols-[256px_minmax(0,1fr)] 2xl:grid-cols-[256px_minmax(0,1fr)_300px]">
            <aside className="min-h-0 border-r border-border bg-surface/30">
              <div className="border-b border-border p-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Componentes</div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={librarySearch}
                    onChange={(event) => onLibrarySearchChange(event.target.value)}
                    placeholder="Buscar componente"
                    className="h-8 border-border bg-surface pl-9 text-[12.5px]"
                  />
                </div>
              </div>

              <div className="space-y-4 p-2">
                {filteredTemplateGroups.map((group) => (
                  <div key={group.id}>
                    <div className="mb-1.5 px-1.5 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/80">
                      {group.label}
                    </div>
                    <div className="space-y-1">
                      {group.templates.map((template) => (
                        <button
                          key={template.type}
                          type="button"
                          draggable
                          onDragStart={(event) =>
                            writeBuilderDragPayload(event, {
                              kind: "template",
                              templateType: template.type,
                              ...getTemplateGridSize(template.type),
                            })}
                          onClick={() => onAddComponent(template.type)}
                          className="group flex w-full items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 text-left transition hover:border-border hover:bg-surface"
                        >
                          <div className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface-2 text-muted-foreground transition group-hover:text-foreground">
                            {renderIcon(template.icon, "h-3.5 w-3.5")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12.5px] font-medium leading-tight text-foreground">{template.label}</div>
                            <div className="text-[10.5px] leading-tight text-muted-foreground">
                              {template.description}
                            </div>
                          </div>
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 transition group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {!filteredTemplateGroups.length ? (
                  <div className="rounded-md border border-dashed border-border bg-surface/40 p-4 text-sm text-muted-foreground">
                    Nenhum componente encontrado para essa busca.
                  </div>
                ) : null}
              </div>
            </aside>

            <div className="relative min-h-0 min-w-0 bg-background">
              {dashboardsLoading || (dataLoading && !dashboardInView) ? (
                <div className="p-6">
                  <LoadingState />
                </div>
              ) : dashboardInView ? (
                <>
                  <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle, rgba(148,163,184,0.35) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
                  <div className="relative p-6">
                    <div className="mx-auto w-full">
                      <div className="overflow-hidden rounded-xl border border-border bg-surface/40 shadow-2xl">
                        <div className="flex h-7 items-center gap-1.5 border-b border-border bg-surface/60 px-3">
                          <span className="h-2 w-2 rounded-full bg-destructive/50" />
                          <span className="h-2 w-2 rounded-full bg-warning/50" />
                          <span className="h-2 w-2 rounded-full bg-success/50" />
                          <span className="ml-3 text-[10.5px] text-muted-foreground">{dashboardInView.name}</span>
                        </div>
                        <div className="p-5">
                          <DashboardRuntimeView
                            dashboard={dashboardInView}
                            filterOptions={filterOptions}
                            filterState={filterState}
                            onChangeFilter={onFilterChange}
                            onResetFilters={onResetFilters}
                            metrics={metrics}
                            editing
                            selectedComponentId={selectedComponentId}
                            onSelectComponent={onSelectComponent}
                              onConfigureComponent={onSelectComponent}
                              onAddComponentAtLayout={onAddComponentAtLayout}
                              onDuplicateComponent={onDuplicateComponent}
                              onMoveComponent={onMoveComponent}
                              onToggleComponentVisibility={onToggleComponentVisibility}
                              onDeleteComponent={onRemoveComponent}
                              onUpdateComponentLayout={onUpdateComponentLayout}
                              mode="builder"
                            />
                        </div>
                      </div>
                      <div className="mt-3 text-[11px] text-muted-foreground">
                        Grid 12 colunas · arraste para reposicionar · alças nos cantos para redimensionar
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6">
                  <EmptyDashboardState onCreate={onCreateEmpty} />
                </div>
              )}
            </div>

            <aside className="min-h-0 border-t border-border bg-surface/30 lg:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
              <div className="border-b border-border p-3">
                <div className="grid grid-cols-3 gap-1">
                  {([
                    { id: "inspector", label: "Componente" },
                    { id: "dashboard", label: "Dashboard" },
                    { id: "history", label: "Historico" },
                  ] as Array<{ id: BuilderSidebarTab; label: string }>).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onBuilderSidebarTabChange(tab.id)}
                      className={cn(
                        "rounded-md px-3 py-2 text-[12.5px] transition",
                        builderSidebarTab === tab.id
                          ? "bg-surface-2 text-foreground"
                          : "bg-surface text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {builderSidebarTab === "history" ? (
                  <DashboardVersionHistoryPanel dashboard={selectedDashboard} />
                ) : builderSidebarTab === "dashboard" ? (
                  <DashboardSettingsPanel
                    dashboard={dashboardInView}
                    filterOptions={filterOptions}
                    onDashboardChange={onUpdateDashboard}
                    onFilterChange={onUpdateDashboardFilter}
                  />
                ) : (
                  <ComponentInspectorPanel
                    component={selectedComponent}
                    filterOptions={filterOptions}
                    dirty={isDashboardDirty}
                    saving={pendingAction === "save"}
                    onChange={onUpdateComponent}
                    onDuplicate={() => selectedComponent && onDuplicateComponent(selectedComponent.id)}
                    onDelete={() => selectedComponent && onRemoveComponent(selectedComponent.id)}
                    onToggleVisibility={() => selectedComponent && onToggleComponentVisibility(selectedComponent.id)}
                    onSave={onSaveDashboard}
                  />
                )}
              </div>
            </aside>
          </div>

          <CreateDashboardDialog
            open={createOpen}
            form={createForm}
            pending={pendingAction === "create"}
            onOpenChange={onCreateOpenChange}
            onChange={onCreateFormChange}
            onSubmit={onCreateDashboard}
          />
        </div>
      ) : (
        <div className="-m-6 bg-background">
          <div className="px-6 pb-4 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span>Operacoes</span>
                  <span className="opacity-40">/</span>
                  <span className="text-foreground">{currentDashboard?.name || pageTitle}</span>
                  {currentDashboard?.isActive ? (
                    <span className="ml-2 inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Ao vivo
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[24px] font-semibold tracking-tight">{currentDashboard?.name || pageTitle}</h1>
                  {dashboards.length > 1 ? (
                    <Select value={dashboardPickerValue} onValueChange={onSelectDashboard}>
                      <SelectTrigger className="h-7 min-w-[200px] rounded-md border border-border bg-surface px-2 text-[12px] text-muted-foreground shadow-none hover:border-border-strong">
                        <SelectValue placeholder="Trocar dashboard" />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboards.map((dashboard) => (
                          <SelectItem key={dashboard.id} value={dashboard.id}>
                            {dashboard.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
                <p className="mt-1.5 max-w-2xl text-[13px] text-muted-foreground">
                  {currentDashboard?.description || pageSubtitle}
                </p>
              </div>
              {canManageDashboards ? (
                <Button asChild className="h-8 gap-1.5 rounded-md px-3 text-[12.5px]">
                  <Link to="/dashboard-builder">
                    <PencilLine className="h-3.5 w-3.5" /> Editar dashboard
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          {dashboardsLoading || (dataLoading && !dashboardInView) ? (
            <div className="px-6 py-6">
              <LoadingState />
            </div>
          ) : dashboardInView ? (
            <>
              <DashboardRuntimeView
                dashboard={dashboardInView}
                filterOptions={filterOptions}
                filterState={filterState}
                onChangeFilter={onFilterChange}
                onResetFilters={onResetFilters}
                metrics={metrics}
                editing={false}
                selectedComponentId={null}
                onSelectComponent={() => {}}
                onConfigureComponent={() => {}}
                onAddComponentAtLayout={() => {}}
                onDuplicateComponent={() => {}}
                onMoveComponent={() => {}}
                onToggleComponentVisibility={() => {}}
                onDeleteComponent={() => {}}
                onUpdateComponentLayout={() => {}}
                mode="viewer"
              />
              <div className="px-6 pb-8 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <AvgResolutionTimeKPI />
                  <SlaRateKPI />
                </div>
                <TicketStatusDonut />
              </div>
            </>
          ) : (
            <div className="px-6 py-6">
              <EmptyDashboardState onCreate={canManageDashboards ? onCreateEmpty : undefined} />
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

type RuntimeDashboardSection = {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  badges: string[];
  component: DashboardComponentConfig | null;
  widgets: DashboardMetric[];
};

function DashboardRuntimeView({
  dashboard,
  filterOptions,
  filterState,
  onChangeFilter,
  onResetFilters,
  metrics,
  editing,
  selectedComponentId,
  onSelectComponent,
  onConfigureComponent,
  onAddComponentAtLayout,
  onDuplicateComponent,
  onMoveComponent,
  onToggleComponentVisibility,
  onDeleteComponent,
  onUpdateComponentLayout,
  mode,
}: {
  dashboard: DashboardDefinition;
  filterOptions: DashboardFilterOptions;
  filterState: DashboardFilterState;
  onChangeFilter: (key: DashboardFilterKey, value: string) => void;
  onResetFilters: () => void;
  metrics: DashboardMetric[];
  editing: boolean;
  selectedComponentId: string | null;
  onSelectComponent: (componentId: string) => void;
  onConfigureComponent: (componentId: string) => void;
  onAddComponentAtLayout: (type: DashboardComponentConfig["type"], layoutRect?: BuilderGridRect) => void;
  onDuplicateComponent: (componentId: string) => void;
  onMoveComponent: (componentId: string, direction: -1 | 1) => void;
  onToggleComponentVisibility: (componentId: string) => void;
  onDeleteComponent: (componentId: string) => void;
  onUpdateComponentLayout: (componentId: string, rect: BuilderGridRect) => void;
  mode: "viewer" | "builder";
}) {
  const orderedMetrics = useMemo(
    () => [...metrics].sort((left, right) => left.component.layout.order - right.component.layout.order),
    [metrics],
  );
  const runtimeSections = useMemo(
    () => buildRuntimeSections(dashboard, orderedMetrics),
    [dashboard, orderedMetrics],
  );

  if (mode === "builder") {
    return (
      <div className="space-y-0">
        <DashboardFilterBar
          dashboard={dashboard}
          filterOptions={filterOptions}
          filterState={filterState}
          onChange={onChangeFilter}
          onReset={onResetFilters}
          mode={mode}
        />
        <DashboardBuilderCanvas
          items={orderedMetrics}
          selectedComponentId={selectedComponentId}
          onSelectComponent={onSelectComponent}
          onConfigureComponent={onConfigureComponent}
          onAddComponent={onAddComponentAtLayout}
          onDuplicateComponent={onDuplicateComponent}
          onMoveComponent={onMoveComponent}
          onToggleComponentVisibility={onToggleComponentVisibility}
          onDeleteComponent={onDeleteComponent}
          onUpdateComponentLayout={onUpdateComponentLayout}
        />
      </div>
    );
  }

  return (
    <div>
      <DashboardFilterBar
        dashboard={dashboard}
        filterOptions={filterOptions}
        filterState={filterState}
        onChange={onChangeFilter}
        onReset={onResetFilters}
        mode={mode}
      />

      <div className="space-y-8 px-6 py-6">
        {runtimeSections.map((section, index) => {
          const indicators = section.widgets.filter(({ data }) => data.kind === "kpi" || data.kind === "progress");
          const panels = section.widgets.filter(({ data }) => data.kind !== "kpi" && data.kind !== "progress");
          const sectionComponent = section.component;

          return (
            <section key={section.id}>
              <DashboardSectionHeaderBlock
                section={section}
                editing={editing}
                selected={sectionComponent?.id === selectedComponentId}
                onSelect={sectionComponent ? () => onSelectComponent(sectionComponent.id) : undefined}
                onConfigure={sectionComponent ? () => onConfigureComponent(sectionComponent.id) : undefined}
                onDuplicate={sectionComponent ? () => onDuplicateComponent(sectionComponent.id) : undefined}
                onMoveUp={sectionComponent ? () => onMoveComponent(sectionComponent.id, -1) : undefined}
                onMoveDown={sectionComponent ? () => onMoveComponent(sectionComponent.id, 1) : undefined}
                onToggleVisibility={sectionComponent ? () => onToggleComponentVisibility(sectionComponent.id) : undefined}
                onDelete={sectionComponent ? () => onDeleteComponent(sectionComponent.id) : undefined}
                showTopSpacing={index > 0}
              />

              {indicators.length ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {indicators.map(({ component, data }) => (
                    <DashboardWidgetCard
                      key={component.id}
                      component={component}
                      data={data}
                      editing={editing}
                      isSelected={component.id === selectedComponentId}
                      onSelect={() => onSelectComponent(component.id)}
                      onConfigure={() => onConfigureComponent(component.id)}
                      onDuplicate={() => onDuplicateComponent(component.id)}
                      onMoveUp={() => onMoveComponent(component.id, -1)}
                      onMoveDown={() => onMoveComponent(component.id, 1)}
                      onToggleVisibility={() => onToggleComponentVisibility(component.id)}
                      onDelete={() => onDeleteComponent(component.id)}
                      mode={mode}
                      spanClassName="col-span-1"
                    />
                  ))}
                </div>
              ) : null}

              {panels.length ? (
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {panels.map(({ component, data }) => (
                    <DashboardWidgetCard
                      key={component.id}
                      component={component}
                      data={data}
                      editing={editing}
                      isSelected={component.id === selectedComponentId}
                      onSelect={() => onSelectComponent(component.id)}
                      onConfigure={() => onConfigureComponent(component.id)}
                      onDuplicate={() => onDuplicateComponent(component.id)}
                      onMoveUp={() => onMoveComponent(component.id, -1)}
                      onMoveDown={() => onMoveComponent(component.id, 1)}
                      onToggleVisibility={() => onToggleComponentVisibility(component.id)}
                      onDelete={() => onDeleteComponent(component.id)}
                      mode={mode}
                      spanClassName={resolveViewerSpanClass(component, data)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DashboardBuilderCanvas({
  items,
  selectedComponentId,
  onSelectComponent,
  onConfigureComponent,
  onAddComponent,
  onDuplicateComponent,
  onMoveComponent,
  onToggleComponentVisibility,
  onDeleteComponent,
  onUpdateComponentLayout,
}: {
  items: DashboardMetric[];
  selectedComponentId: string | null;
  onSelectComponent: (componentId: string) => void;
  onConfigureComponent: (componentId: string) => void;
  onAddComponent: (type: DashboardComponentConfig["type"], layoutRect?: BuilderGridRect) => void;
  onDuplicateComponent: (componentId: string) => void;
  onMoveComponent: (componentId: string, direction: -1 | 1) => void;
  onToggleComponentVisibility: (componentId: string) => void;
  onDeleteComponent: (componentId: string) => void;
  onUpdateComponentLayout: (componentId: string, rect: BuilderGridRect) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width || 1200);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width || 1200);
    return () => ro.disconnect();
  }, []);

  // Auto-pack if all items are unpositioned (x=0 for every item — legacy dashboards)
  const packedComponents = items.every(({ component }) => (component.layout.x ?? 0) === 0)
    ? autoPackComponents(items.map(({ component }) => component))
    : items.map(({ component }) => component);

  const layout = items.map(({ component }, idx) => {
    const packed = packedComponents[idx];
    return {
      i: component.id,
      x: packed.layout.x ?? 0,
      y: packed.layout.y ?? 0,
      w: packed.layout.w ?? component.layout.colSpan ?? 12,
      h: packed.layout.h ?? 2,
      minW: isFullWidthBuilderType(component.type) ? BUILDER_GRID_COLUMNS : 2,
      maxW: isFullWidthBuilderType(component.type) ? BUILDER_GRID_COLUMNS : BUILDER_GRID_COLUMNS,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RGL = (ReactGridLayout as any).default ?? ReactGridLayout;

  return (
    <div className="p-5">
      <div
        ref={containerRef}
        className="relative min-h-[300px] rounded-xl border border-border bg-background/20 p-3"
        onDragOver={(e) => {
          const payload = _activeDragPayload;
          if (payload?.kind === "template") e.preventDefault();
        }}
        onDrop={(e) => {
          const payload = _activeDragPayload;
          _activeDragPayload = null;
          if (!payload || payload.kind !== "template") return;
          e.preventDefault();
          const bounds = containerRef.current?.getBoundingClientRect();
          if (!bounds) return;
          const colWidth = containerWidth / BUILDER_GRID_COLUMNS;
          const x = Math.max(0, Math.min(BUILDER_GRID_COLUMNS - payload.w, Math.floor((e.clientX - bounds.left) / colWidth)));
          const y = Math.max(0, Math.floor((e.clientY - bounds.top) / BUILDER_GRID_ROW_HEIGHT));
          onAddComponent(payload.templateType, { x, y, w: payload.w, h: payload.h });
        }}
      >
        <RGL
          layout={layout}
          cols={BUILDER_GRID_COLUMNS}
          rowHeight={BUILDER_GRID_ROW_HEIGHT}
          width={containerWidth - 24}
          margin={[BUILDER_GRID_GAP, BUILDER_GRID_GAP]}
          containerPadding={[0, 0]}
          isDraggable
          isResizable
          resizeHandles={["se", "sw", "ne", "nw"]}
          draggableHandle=".drag-handle"
          onDragStop={(_layout: unknown, _old: unknown, item: { i: string; x: number; y: number; w: number; h: number }) => {
            onUpdateComponentLayout(item.i, { x: item.x, y: item.y, w: item.w, h: item.h });
          }}
          onResizeStop={(_layout: unknown, _old: unknown, item: { i: string; x: number; y: number; w: number; h: number }) => {
            onUpdateComponentLayout(item.i, { x: item.x, y: item.y, w: item.w, h: item.h });
          }}
        >
          {items.map(({ component, data }) => (
            <div
              key={component.id}
              className={cn(
                "group relative",
                component.id === selectedComponentId && "ring-2 ring-primary/60 rounded-xl",
              )}
            >
              {/* drag handle overlay — covers top area so clicks on widget don't start drags */}
              <div
                className="drag-handle absolute inset-x-0 top-0 z-10 flex h-8 cursor-grab items-center justify-center opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
                title="Arraste para mover"
              >
                <div className="flex gap-0.5 rounded-md border border-border bg-background/90 px-2 py-1 shadow-sm">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{component.title}</span>
                </div>
              </div>

              <DashboardWidgetCard
                component={component}
                data={data}
                editing
                isSelected={component.id === selectedComponentId}
                onSelect={() => onSelectComponent(component.id)}
                onConfigure={() => onConfigureComponent(component.id)}
                onDuplicate={() => onDuplicateComponent(component.id)}
                onMoveUp={() => onMoveComponent(component.id, -1)}
                onMoveDown={() => onMoveComponent(component.id, 1)}
                onToggleVisibility={() => onToggleComponentVisibility(component.id)}
                onDelete={() => onDeleteComponent(component.id)}
                mode="builder"
                spanClassName="col-span-12"
              />
            </div>
          ))}
        </RGL>

        {items.length === 0 && (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <LayoutDashboard className="h-10 w-10 opacity-20" />
            <p className="text-sm">Arraste componentes da biblioteca ou clique neles para adicionar</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => onAddComponent("kpi")}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong py-3 text-[12px] text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Adicionar componente
        </button>
      </div>
    </div>
  );
}

function DashboardSectionHeaderBlock({
  section,
  editing,
  selected,
  onSelect,
  onConfigure,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onDelete,
  showTopSpacing,
}: {
  section: RuntimeDashboardSection;
  editing: boolean;
  selected: boolean;
  onSelect?: () => void;
  onConfigure?: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleVisibility?: () => void;
  onDelete?: () => void;
  showTopSpacing?: boolean;
}) {
  const hasActions =
    editing
    && onConfigure
    && onDuplicate
    && onMoveUp
    && onMoveDown
    && onToggleVisibility
    && onDelete;

  return (
    <div
      className={cn(
        "group relative",
        showTopSpacing && "pt-2",
        onSelect && "cursor-pointer",
        selected && "rounded-lg ring-1 ring-primary/50",
      )}
      onClick={onSelect}
    >
      {hasActions ? (
        <div className="absolute right-0 top-0 z-10">
          <WidgetEditActions
            onConfigure={onConfigure}
            onDuplicate={onDuplicate}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onToggleVisibility={onToggleVisibility}
            onDelete={onDelete}
          />
        </div>
      ) : null}
      <div className="flex items-end justify-between gap-4 pb-3">
        <div>
          <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.16em] text-primary/80">{section.eyebrow}</div>
          <h2 className="text-[15px] font-semibold tracking-tight">{section.title}</h2>
          {section.description ? (
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{section.description}</p>
          ) : null}
        </div>
        {section.badges.length ? (
          <div className="hidden items-center gap-2 md:flex">
            {section.badges.map((badge) => (
              <span key={badge} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildRuntimeSections(
  dashboard: DashboardDefinition,
  metrics: DashboardMetric[],
): RuntimeDashboardSection[] {
  const sections: RuntimeDashboardSection[] = [];
  let current = createSyntheticRuntimeSection(dashboard);

  metrics.forEach((metric) => {
    if (metric.data.kind === "section") {
      if (current.widgets.length) {
        sections.push(current);
      }

      current = {
        id: metric.component.id,
        eyebrow: inferSectionEyebrow(dashboard, metric.component.title, sections.length + 1),
        title: metric.component.title,
        description: metric.data.description || metric.component.subtitle || "",
        badges: metric.data.badges || [],
        component: metric.component,
        widgets: [],
      };
      return;
    }

    current.widgets.push(metric);
  });

  if (current.widgets.length) {
    sections.push(current);
  }

  return sections;
}

function createSyntheticRuntimeSection(dashboard: DashboardDefinition): RuntimeDashboardSection {
  return {
    id: "__root__",
    eyebrow: dashboard.type === "operational" ? "Operacao" : VIEW_TYPE_LABELS[dashboard.type],
    title: dashboard.type === "operational" ? "Saude da operacao" : dashboard.name,
    description:
      dashboard.type === "operational"
        ? "Sinais imediatos da fila com chamados, gargalos e indicadores operacionais em tempo real."
        : dashboard.description || "",
    badges: [],
    component: null,
    widgets: [],
  };
}

function inferSectionEyebrow(dashboard: DashboardDefinition, title: string, index: number): string {
  const normalizedTitle = title.trim().toLowerCase();

  if (normalizedTitle.includes("sprint")) {
    return "Sprint atual";
  }

  if (normalizedTitle.includes("projeto")) {
    return "Projetos";
  }

  if (normalizedTitle.includes("capacidade")) {
    return "Capacidade";
  }

  if (index === 0 && dashboard.type === "operational") {
    return "Operacao";
  }

  return "Secao";
}

function resolveViewerSpanClass(component: DashboardComponentConfig, data: DashboardResolvedData): string {
  if (data.kind === "separator") {
    return "lg:col-span-3";
  }

  if (component.layout.colSpan >= 10) {
    return "lg:col-span-3";
  }

  if (component.layout.colSpan >= 7 || (data.kind === "table" && component.layout.colSpan >= 6)) {
    return "lg:col-span-2";
  }

  return "lg:col-span-1";
}

function DashboardSettingsPanel({
  dashboard,
  filterOptions,
  onDashboardChange,
  onFilterChange,
}: {
  dashboard: DashboardDefinition | null;
  filterOptions: DashboardFilterOptions;
  onDashboardChange: (patch: Partial<DashboardDefinition>) => void;
  onFilterChange: (filterId: string, patch: Partial<DashboardFilterDefinition>) => void;
}) {
  return (
    <div className="space-y-4 p-3">
      <div>
        <div className="text-[13.5px] font-semibold tracking-tight">Configuracao do dashboard</div>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Ajuste identidade, tipo de visao e filtros globais disponiveis.
        </p>
      </div>

      {dashboard ? (
        <>
          <div className="rounded-lg border border-border bg-surface/40 p-4">
            <div className="grid gap-4">
              <Field label="Nome">
                <Input
                  value={dashboard.name}
                  onChange={(event) => onDashboardChange({ name: event.target.value })}
                />
              </Field>
              <Field label="Tipo de visao">
                <Select
                  value={dashboard.type}
                  onValueChange={(value) => onDashboardChange({ type: value as DashboardViewType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VIEW_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Descricao">
                <Textarea
                  rows={4}
                  value={dashboard.description || ""}
                  onChange={(event) => onDashboardChange({ description: event.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface/40 p-4">
            <div className="text-sm font-medium text-foreground">Filtros globais</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada dashboard decide quais filtros ficam disponiveis e quais valores padrao sao aplicados.
            </p>
            <div className="mt-4 space-y-3">
              {sortFilters(dashboard.filters).map((filter) => (
                <div
                  key={filter.id}
                  className="grid gap-3 rounded-md border border-border bg-surface p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{filter.label}</div>
                      <div className="text-xs text-muted-foreground">Chave: {filter.field}</div>
                    </div>
                    <Switch
                      checked={filter.enabled}
                      onCheckedChange={(checked) => onFilterChange(filter.id, { enabled: checked })}
                    />
                  </div>
                  <FilterSelect
                    value={filter.defaultValue || ""}
                    options={filterOptions[filter.type] || []}
                    placeholder="Sem padrao"
                    disabled={!filter.enabled}
                    onChange={(value) => onFilterChange(filter.id, { defaultValue: value || "" })}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface/40 p-5 text-sm text-muted-foreground">
          Nenhum dashboard selecionado.
        </div>
      )}
    </div>
  );
}

function ComponentInspectorPanel({
  component,
  filterOptions,
  dirty,
  saving,
  onChange,
  onDuplicate,
  onDelete,
  onToggleVisibility,
  onSave,
}: {
  component: DashboardComponentConfig | null;
  filterOptions: DashboardFilterOptions;
  dirty: boolean;
  saving: boolean;
  onChange: (patch: DashboardComponentPatch) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  onSave: () => Promise<void> | void;
}) {
  if (!component) {
    return (
      <div className="p-6 text-center text-[12.5px] text-muted-foreground">
        <div className="text-[13.5px] font-semibold tracking-tight text-foreground">Selecione um componente</div>
        <p className="mt-2 leading-relaxed">
          Clique em um widget no canvas para editar titulo, dados, layout, filtros e comportamento sem sair da tela.
        </p>
      </div>
    );
  }

  const source = resolveSource(component.dataSource);
  const supportedTypes = Array.from(
    new Set([
      component.type,
      ...(source?.supportedTypes || DASHBOARD_COMPONENT_TEMPLATES.map((item) => item.type)),
    ]),
  ) as DashboardComponentConfig["type"][];
  const isLayoutOnlyComponent =
    component.type === "text" || component.type === "section" || component.type === "separator";

  return (
    <div className="space-y-4 p-3">
      <div className="rounded-lg border border-border bg-surface/40 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13.5px] font-semibold tracking-tight">Configurar componente</div>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Ajuste titulo, dados, layout e comportamento deste bloco.
            </p>
          </div>
          <Badge className={cn("border", TONE_CLASSES[component.tone || "primary"])}>
            {COMPONENT_LABELS[component.type]}
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={onDuplicate}>
            <Copy className="h-4 w-4" /> Duplicar
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={onToggleVisibility}>
            {component.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {component.isVisible ? "Ocultar" : "Mostrar"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" /> Remover
          </Button>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-surface/40 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Titulo">
            <Input value={component.title} onChange={(event) => onChange({ title: event.target.value })} />
          </Field>
          <Field label="Tipo">
            <Select
              value={component.type}
              onValueChange={(value) => onChange({ type: value as DashboardComponentConfig["type"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {COMPONENT_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Subtitulo">
          <Input
            value={component.subtitle || ""}
            onChange={(event) => onChange({ subtitle: event.target.value })}
          />
        </Field>

        {!isLayoutOnlyComponent ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Fonte de dados">
                <Select
                  value={component.dataSource}
                  onValueChange={(value) => {
                    const nextSource = resolveSource(value as DashboardComponentConfig["dataSource"]);
                    const nextType = nextSource?.supportedTypes.includes(component.type)
                      ? component.type
                      : nextSource?.defaultComponentType || component.type;

                    onChange({
                      dataSource: value as DashboardComponentConfig["dataSource"],
                      type: nextType,
                      tone: nextSource?.tone || component.tone,
                      icon: nextSource?.icon || component.icon,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DASHBOARD_SOURCE_CATALOG.map((item) => (
                      <SelectItem key={item.key} value={item.key}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tom visual">
                <Select
                  value={component.tone || "primary"}
                  onValueChange={(value) => onChange({ tone: value as DashboardTone })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DASHBOARD_TONE_OPTIONS.map((tone) => (
                      <SelectItem key={tone} value={tone}>
                        {TONE_LABELS[tone]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Metrica">
                <Input
                  value={component.valueField || ""}
                  placeholder="Ex: chamados"
                  onChange={(event) => onChange({ valueField: event.target.value })}
                />
              </Field>
              <Field label="Agrupamento">
                <Input
                  value={component.groupBy || ""}
                  placeholder="Ex: responsavel"
                  onChange={(event) => onChange({ groupBy: event.target.value })}
                />
              </Field>
              <Field label="Ordenacao">
                <Input
                  value={component.sortBy || ""}
                  placeholder="Ex: desc"
                  onChange={(event) => onChange({ sortBy: event.target.value })}
                />
              </Field>
            </div>
          </>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Icone">
            <Select value={component.icon || "layout-dashboard"} onValueChange={(value) => onChange({ icon: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Posicao">
            <Input
              type="number"
              min={1}
              value={component.layout.order + 1}
              onChange={(event) =>
                onChange({
                  layout: {
                    ...component.layout,
                    order: Math.max(0, Number(event.target.value) - 1 || 0),
                  },
                })
              }
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Largura">
            <Select
              value={String(component.layout.colSpan)}
              onValueChange={(value) =>
                onChange({
                  layout: { ...component.layout, colSpan: Number(value) },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 6, 7, 8, 12].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} colunas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Altura minima">
            <Input
              type="number"
              min={32}
              step={10}
              value={component.layout.minHeight}
              onChange={(event) =>
                onChange({
                  layout: {
                    ...component.layout,
                    minHeight: Math.max(32, Number(event.target.value) || 32),
                  },
                })
              }
            />
          </Field>
          <Field label="Limite de registros">
            <Input
              type="number"
              min={1}
              max={50}
              value={component.limit || 8}
              onChange={(event) => onChange({ limit: Math.max(1, Number(event.target.value) || 1) })}
            />
          </Field>
        </div>

        <div className="grid gap-4 rounded-md border border-border bg-surface p-4">
          <div>
            <div className="font-medium">Comportamento</div>
            <p className="text-xs text-muted-foreground">
              Controle se o bloco responde aos filtros globais e se fica visivel na publicacao.
            </p>
          </div>
          <ToggleRow
            label="Usar filtros globais"
            checked={component.useGlobalFilters}
            onCheckedChange={(checked) => onChange({ useGlobalFilters: checked })}
          />
          <ToggleRow
            label="Componente visivel"
            checked={component.isVisible}
            onCheckedChange={(checked) => onChange({ isVisible: checked })}
          />
        </div>

        {component.type === "text" ? (
          <Field label="Conteudo do texto">
            <Textarea
              rows={8}
              value={String(component.configJson?.body || component.subtitle || "")}
              onChange={(event) =>
                onChange({
                  configJson: {
                    ...(component.configJson || {}),
                    body: event.target.value,
                  },
                })
              }
            />
          </Field>
        ) : null}

        {component.type === "section" ? (
          <Field label="Descricao da secao">
            <Textarea
              rows={5}
              value={String(component.configJson?.description || component.subtitle || "")}
              onChange={(event) =>
                onChange({
                  configJson: {
                    ...(component.configJson || {}),
                    description: event.target.value,
                  },
                })
              }
            />
          </Field>
        ) : null}

        {component.type === "separator" ? (
          <Field label="Legenda opcional">
            <Input
              value={String(component.configJson?.label || component.subtitle || "")}
              onChange={(event) =>
                onChange({
                  configJson: {
                    ...(component.configJson || {}),
                    label: event.target.value,
                  },
                  subtitle: event.target.value,
                })
              }
            />
          </Field>
        ) : null}

        {component.type === "formula" ? (
          <div className="space-y-3">
            <Field label="Fórmula">
              <Textarea
                rows={3}
                value={String(component.configJson?.formula || "")}
                onChange={(event) =>
                  onChange({
                    configJson: {
                      ...(component.configJson || {}),
                      formula: event.target.value,
                    },
                  })
                }
                placeholder="{tickets_open} / {clients} * 100"
              />
            </Field>
            <Field label="Sufixo">
              <Input
                value={String(component.configJson?.suffix || "")}
                onChange={(event) =>
                  onChange({
                    configJson: {
                      ...(component.configJson || {}),
                      suffix: event.target.value,
                    },
                  })
                }
                placeholder="% ou pts"
              />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              Use {"{tickets_open}"}, {"{tickets_total}"}, {"{clients}"}, {"{projects}"}, {"{activities}"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-surface/40 p-4">
        <div className="font-medium">Overrides de filtro</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Use quando este bloco precisar fugir do contexto global do dashboard.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {DASHBOARD_FILTER_DEFINITIONS.map((filter) => (
            <Field key={filter.id} label={filter.label}>
              <FilterSelect
                value={component.filters?.[filter.type] || ""}
                options={filterOptions[filter.type] || []}
                placeholder="Seguir global"
                onChange={(value) =>
                  onChange({
                    filters: {
                      ...(component.filters || {}),
                      [filter.type]: value || "",
                    },
                  })
                }
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          As alteracoes deste bloco entram no rascunho. Salve para persistir a configuracao.
        </p>
        <Button className="gap-2" onClick={() => void onSave()} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar dashboard
        </Button>
      </div>
    </div>
  );
}

function DashboardVersionHistoryPanel({ dashboard }: { dashboard: DashboardDefinition | null }) {
  return (
    <div className="space-y-4 p-3">
      <div>
        <div className="text-[13.5px] font-semibold tracking-tight">Historico de versoes</div>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Rastreie publicacoes, snapshots e o volume de iteracoes deste dashboard.
        </p>
      </div>

      {dashboard?.versions.length ? (
        <div className="space-y-3">
          {[...dashboard.versions]
            .sort((left, right) => right.versionNumber - left.versionNumber)
            .map((version) => (
              <div key={version.id} className="rounded-lg border border-border bg-surface/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">Versao {version.versionNumber}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {version.createdBy || "Sistema"} • {new Date(version.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  {version.isPublished ? (
                    <Badge className="border-success/30 bg-success/12 text-success">Publicada</Badge>
                  ) : (
                    <Badge className="border-border/60 bg-background/40 text-muted-foreground">Snapshot</Badge>
                  )}
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  {version.configSnapshot.name} • {version.configSnapshot.components.length} componentes
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface/40 p-5 text-sm text-muted-foreground">
          Este dashboard ainda nao tem versoes salvas no historico.
        </div>
      )}
    </div>
  );
}

function DashboardFilterBar({
  dashboard,
  filterOptions,
  filterState,
  onChange,
  onReset,
  mode = "viewer",
}: {
  dashboard: DashboardDefinition | null | undefined;
  filterOptions: DashboardFilterOptions;
  filterState: DashboardFilterState;
  onChange: (key: DashboardFilterKey, value: string) => void;
  onReset: () => void;
  mode?: "viewer" | "builder";
}) {
  const enabledFilters = sortFilters(dashboard?.filters || []).filter((filter) => filter.enabled);
  const usesCompactSprintFilters =
    enabledFilters.length > 0
    && enabledFilters.length <= OPERATIONAL_FILTER_TYPES.length
    && enabledFilters.every((filter) => OPERATIONAL_FILTER_TYPES.includes(filter.type));

  if (!enabledFilters.length) {
    return null;
  }

  if (usesCompactSprintFilters) {
    return (
      <div className={cn("border-y border-border bg-surface/40 py-3", mode === "viewer" ? "px-6" : "px-4")}>
        <div className="flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Sprint selecionada
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {enabledFilters.map((filter) => (
            <LineFilterControl
              key={filter.id}
              label={filter.label}
              value={filterState[filter.type] || ""}
              options={filterOptions[filter.type] || []}
              placeholder="Todos"
              onChange={(value) => onChange(filter.type, value)}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-end">
          <button type="button" className="text-[11.5px] text-muted-foreground hover:text-foreground" onClick={onReset}>
            Limpar filtros
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 border-y border-border bg-surface/40 py-2.5", mode === "viewer" ? "px-6" : "px-4")}>
      <div className="mr-1 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        Filtros
      </div>
      {enabledFilters.map((filter) => (
        <CompactFilterControl
          key={filter.id}
          label={filter.label}
          value={filterState[filter.type] || ""}
          options={filterOptions[filter.type] || []}
          placeholder={usesCompactSprintFilters ? "Todos" : `Todos os valores de ${filter.label.toLowerCase()}`}
          onChange={(value) => onChange(filter.type, value)}
        />
      ))}
      <div className="ml-auto flex items-center gap-2">
        <button type="button" className="text-[11.5px] text-muted-foreground hover:text-foreground" onClick={onReset}>
          Limpar filtros
        </button>
      </div>
    </div>
  );
}

function LineFilterControl({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label || placeholder;

  return (
    <Select
      value={value || EMPTY_OPTION_VALUE}
      onValueChange={(nextValue) => onChange(nextValue === EMPTY_OPTION_VALUE ? "" : nextValue)}
    >
      <SelectTrigger className="h-9 w-full rounded-lg border border-border bg-background/20 px-3 text-[12.5px] shadow-none hover:border-border-strong">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">{label}</span>
          <span className="truncate font-medium text-foreground">{selectedLabel}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_OPTION_VALUE}>{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CompactFilterControl({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label || placeholder;

  return (
    <Select
      value={value || EMPTY_OPTION_VALUE}
      onValueChange={(nextValue) => onChange(nextValue === EMPTY_OPTION_VALUE ? "" : nextValue)}
    >
      <SelectTrigger className="h-8 min-w-[160px] gap-2 rounded-md border border-border bg-surface px-2.5 text-[12.5px] shadow-none hover:border-border-strong">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">{label}</span>
          <span className="truncate font-medium text-foreground">{selectedLabel}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_OPTION_VALUE}>{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function getBuilderSpanClass(component: DashboardComponentConfig, data: DashboardResolvedData): string {
  if (data.kind === "section" || data.kind === "separator") {
    return "col-span-12";
  }

  const span = Math.max(1, Math.min(12, component.layout.colSpan || 12));

  if (span <= 3) {
    return `col-span-12 sm:col-span-6 xl:col-span-${span}`;
  }

  if (span <= 6) {
    return `col-span-12 lg:col-span-6 xl:col-span-${span}`;
  }

  return `col-span-12 xl:col-span-${span}`;
}

function DashboardWidgetCard({
  component,
  data,
  editing,
  isSelected,
  onSelect,
  onConfigure,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onDelete,
  mode = "viewer",
  spanClassName,
}: {
  component: DashboardComponentConfig;
  data: DashboardResolvedData;
  editing: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onConfigure: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  mode?: "viewer" | "builder";
  spanClassName?: string;
}) {
  const navigate = useNavigate();
  const tone = component.tone || inferToneFromData(data);
  const colSpanClass =
    spanClassName
    || (mode === "builder"
      ? getBuilderSpanClass(component, data)
      : COL_SPAN_CLASS[component.layout.colSpan] || COL_SPAN_CLASS[12]);
  const isCompactMetric = mode === "viewer" && (data.kind === "kpi" || data.kind === "progress");
  const resolvedMinHeight =
    data.kind === "kpi" && isCompactMetric
      ? Math.min(component.layout.minHeight, 152)
      : data.kind === "progress" && isCompactMetric
        ? Math.min(component.layout.minHeight, 166)
        : component.layout.minHeight;

  function handleDrillDown(_row: Record<string, string | number>) {
    if (mode !== "viewer") return;
    const ds = component.dataSource || "";
    if (ds.startsWith("ticket")) {
      void navigate({ to: "/tickets" });
    } else if (ds.startsWith("project")) {
      void navigate({ to: "/projects" });
    } else if (ds.startsWith("activit")) {
      void navigate({ to: "/activities" });
    } else if (ds.startsWith("client")) {
      void navigate({ to: "/clients" });
    }
  }

  if (data.kind === "section") {
    return (
      <div
        className={cn(
        "group relative pb-1 pt-3",
        colSpanClass,
        editing && "cursor-pointer",
        isSelected && "ring-1 ring-primary/50",
      )}
        onClick={onSelect}
      >
        {editing ? (
          <WidgetEditActions
            onConfigure={onConfigure}
            onDuplicate={onDuplicate}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onToggleVisibility={onToggleVisibility}
            onDelete={onDelete}
          />
        ) : null}
        <div className="flex items-center gap-3">
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-primary/80">Secao</div>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="mt-1.5">
          <div className="text-[15px] font-semibold tracking-tight">{component.title}</div>
          {data.description ? (
            <div className="text-[12px] text-muted-foreground">{data.description}</div>
          ) : null}
        </div>
      </div>
    );
  }

  if (data.kind === "separator") {
    return (
      <div
        className={cn(
          "group relative rounded-lg p-1",
          colSpanClass,
          editing && "cursor-pointer",
          isSelected && "ring-1 ring-primary/50",
        )}
        onClick={onSelect}
      >
        {editing ? (
          <WidgetEditActions
            onConfigure={onConfigure}
            onDuplicate={onDuplicate}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onToggleVisibility={onToggleVisibility}
            onDelete={onDelete}
          />
        ) : null}
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="h-px flex-1 bg-border/70" />
          {data.label ? (
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {data.label}
            </span>
          ) : null}
          <div className="h-px flex-1 bg-border/70" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-surface/60 transition-colors",
        colSpanClass,
        editing && "cursor-pointer hover:border-border-strong",
        mode === "builder" && "bg-surface/70",
        isSelected && "ring-1 ring-primary/50",
      )}
      style={{ minHeight: resolvedMinHeight }}
      onClick={onSelect}
    >
      {editing ? (
        <WidgetEditActions
          onConfigure={onConfigure}
          onDuplicate={onDuplicate}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onToggleVisibility={onToggleVisibility}
          onDelete={onDelete}
        />
      ) : null}
      <div className={cn("relative flex h-full flex-col", data.kind === "kpi" || data.kind === "progress" ? (isCompactMetric ? "p-3.5" : "p-4") : "p-0")}>
        {data.kind === "kpi" || data.kind === "progress" ? (
          <>
            <div className="flex items-center gap-3">
              <span className={cn("uppercase tracking-[0.12em] text-muted-foreground", isCompactMetric ? "text-[10.5px]" : "text-[11px]")}>
                {component.title}
              </span>
            </div>
            <div className="mt-2.5 flex-1">
              <WidgetBody component={component} data={data} tone={tone} compact={isCompactMetric} onChartRowClick={mode === "viewer" ? handleDrillDown : undefined} />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between px-4 pb-2 pt-3.5">
              <div>
                <div className="text-[13px] font-semibold tracking-tight">{component.title}</div>
                {component.subtitle ? (
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">{component.subtitle}</div>
                ) : null}
              </div>
            </div>

            <div className="flex-1 px-4 pb-4">
              <WidgetBody component={component} data={data} tone={tone} compact={false} onChartRowClick={mode === "viewer" ? handleDrillDown : undefined} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WidgetBody({
  component,
  data,
  tone,
  compact = false,
  onChartRowClick,
}: {
  component: DashboardComponentConfig;
  data: DashboardResolvedData;
  tone: DashboardTone;
  compact?: boolean;
  onChartRowClick?: (row: Record<string, string | number>) => void;
}) {
  switch (data.kind) {
    case "kpi":
      return (
        <div className="flex h-full flex-col justify-between">
          <div className={cn("font-semibold leading-none tracking-tight tabular-nums", compact ? "text-[26px] md:text-[30px]" : "text-[30px] md:text-[34px]")}>
            {data.value}
          </div>
          <div className="space-y-1.5">
            <div className={cn("text-muted-foreground", compact ? "text-[11px]" : "text-[11.5px]")}>
              {component.subtitle || data.helper || "Indicador atualizado com dados reais"}
            </div>
            {data.helper && component.subtitle && data.helper !== component.subtitle ? (
              <div className="text-[11px] text-muted-foreground/80">{data.helper}</div>
            ) : null}
          </div>
        </div>
      );
    case "progress":
      return (
        <div className={cn("flex h-full flex-col justify-between", compact ? "gap-4" : "gap-5")}>
          <div className="space-y-2">
            <div className={cn("font-semibold leading-none tracking-tight tabular-nums", compact ? "text-[26px] md:text-[30px]" : "text-[30px] md:text-[34px]")}>
              {data.value}%
            </div>
            <p className={cn("text-muted-foreground", compact ? "text-[11px]" : "text-[11.5px]")}>
              {component.subtitle || data.label}
            </p>
          </div>
          <div className="space-y-2">
            <Progress value={data.value} className="h-2" />
            {data.helper ? <p className="text-[11px] text-muted-foreground">{data.helper}</p> : null}
          </div>
        </div>
      );
    case "series":
      return (
        <div className="h-full min-h-[220px]">
          <GenericChart data={data.data} chartType={data.chartType} tone={data.tone || tone} onClickRow={onChartRowClick} />
          {data.helper ? <p className="mt-3 text-xs text-muted-foreground">{data.helper}</p> : null}
        </div>
      );
    case "table":
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-border bg-background/30">
            <div className="overflow-x-auto overflow-y-hidden">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    {data.columns.map((column) => (
                      <TableHead
                        key={column.key}
                        className={cn(column.align === "right" && "text-right")}
                      >
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.length ? (
                    data.rows.map((row, index) => (
                      <TableRow key={`${index}-${String(row[data.columns[0]?.key || index])}`}>
                        {data.columns.map((column) => (
                          <TableCell
                            key={column.key}
                            className={cn(column.align === "right" && "text-right")}
                          >
                            {String(row[column.key] ?? "-")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={data.columns.length} className="py-8 text-center text-muted-foreground">
                        Nenhum dado encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          {data.helper ? <p className="text-xs text-muted-foreground">{data.helper}</p> : null}
        </div>
      );
    case "list":
      return (
        <div className="space-y-3">
          {data.items.length ? (
            <div className="overflow-hidden rounded-lg border border-border bg-background/30">
              <div className="divide-y divide-border">
                {data.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.title}</div>
                      {item.subtitle ? (
                        <div className="mt-0.5 text-sm text-muted-foreground">{item.subtitle}</div>
                      ) : null}
                      {item.meta ? <div className="mt-2 text-xs text-muted-foreground">{item.meta}</div> : null}
                    </div>
                    {item.badges?.length ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {item.badges.map((badge) => (
                          <Badge
                            key={`${item.id}-${badge.label}`}
                            className={cn("border", TONE_CLASSES[badge.tone])}
                          >
                            {badge.label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              Nenhum item disponivel.
            </div>
          )}
          {data.helper ? <p className="text-xs text-muted-foreground">{data.helper}</p> : null}
        </div>
      );
    case "funnel":
      return (
        <div className="space-y-4">
          <FunnelView steps={data.steps} tone={data.helper ? tone : tone} />
          {data.helper ? <p className="text-xs text-muted-foreground">{data.helper}</p> : null}
        </div>
      );
    case "text":
      return (
        <div className="rounded-lg border border-border bg-background/30 p-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {data.body}
        </div>
      );
    default:
      return null;
  }
}

function WidgetEditActions({
  onConfigure,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onDelete,
}: {
  onConfigure: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-wrap gap-1 rounded-2xl border border-border/60 bg-background/90 p-1 opacity-0 shadow-lg backdrop-blur transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
      <IconActionButton label="Configurar" onClick={onConfigure}>
        <Settings2 className="h-4 w-4" />
      </IconActionButton>
      <IconActionButton label="Duplicar" onClick={onDuplicate}>
        <Copy className="h-4 w-4" />
      </IconActionButton>
      <IconActionButton label="Subir" onClick={onMoveUp}>
        <ArrowUp className="h-4 w-4" />
      </IconActionButton>
      <IconActionButton label="Descer" onClick={onMoveDown}>
        <ArrowDown className="h-4 w-4" />
      </IconActionButton>
      <IconActionButton label="Mostrar ou ocultar" onClick={onToggleVisibility}>
        <EyeOff className="h-4 w-4" />
      </IconActionButton>
      <IconActionButton label="Excluir" onClick={onDelete} destructive>
        <Trash2 className="h-4 w-4" />
      </IconActionButton>
    </div>
  );
}

function DashboardSettingsDialog({
  open,
  dashboard,
  filterOptions,
  onOpenChange,
  onDashboardChange,
  onFilterChange,
}: {
  open: boolean;
  dashboard: DashboardDefinition | null;
  filterOptions: DashboardFilterOptions;
  onOpenChange: (open: boolean) => void;
  onDashboardChange: (patch: Partial<DashboardDefinition>) => void;
  onFilterChange: (filterId: string, patch: Partial<DashboardFilterDefinition>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-3xl border-border/60 bg-background/95 shadow-card">
        <DialogHeader>
          <DialogTitle>Configurar dashboard</DialogTitle>
          <DialogDescription>
            Ajuste nome, descricao, tipo e os filtros globais que ficarao disponiveis nesta visao.
          </DialogDescription>
        </DialogHeader>

        {dashboard ? (
          <div className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome">
                <Input
                  value={dashboard.name}
                  onChange={(event) => onDashboardChange({ name: event.target.value })}
                />
              </Field>
              <Field label="Tipo de visao">
                <Select
                  value={dashboard.type}
                  onValueChange={(value) => onDashboardChange({ type: value as DashboardViewType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VIEW_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Descricao">
              <Textarea
                rows={3}
                value={dashboard.description || ""}
                onChange={(event) => onDashboardChange({ description: event.target.value })}
              />
            </Field>

            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <div className="text-sm font-medium">Filtros globais</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cada dashboard escolhe quais filtros aparecem e quais valores padrao serao aplicados.
              </p>
              <div className="mt-4 space-y-3">
                {sortFilters(dashboard.filters).map((filter) => (
                  <div
                    key={filter.id}
                    className="grid gap-3 rounded-2xl border border-border/50 bg-background/45 p-3 md:grid-cols-[minmax(0,1fr)_180px_auto]"
                  >
                    <div>
                      <div className="font-medium">{filter.label}</div>
                      <div className="text-xs text-muted-foreground">
                        Chave: {filter.field}
                      </div>
                    </div>
                    <FilterSelect
                      value={filter.defaultValue || ""}
                      options={filterOptions[filter.type] || []}
                      placeholder="Sem padrao"
                      disabled={!filter.enabled}
                      onChange={(value) => onFilterChange(filter.id, { defaultValue: value || "" })}
                    />
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/60 px-3 py-2">
                      <div className="text-sm text-muted-foreground">Habilitado</div>
                      <Switch
                        checked={filter.enabled}
                        onCheckedChange={(checked) => onFilterChange(filter.id, { enabled: checked })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComponentConfigDialog({
  open,
  component,
  filterOptions,
  dirty,
  saving,
  onOpenChange,
  onChange,
  onSave,
}: {
  open: boolean;
  component: DashboardComponentConfig | null;
  filterOptions: DashboardFilterOptions;
  dirty: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: DashboardComponentPatch) => void;
  onSave: () => Promise<void> | void;
}) {
  const source = component ? resolveSource(component.dataSource) : null;
  const supportedTypes = source?.supportedTypes || DASHBOARD_COMPONENT_TEMPLATES.map((item) => item.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 flex h-[100dvh] w-full max-w-xl translate-x-0 translate-y-0 overflow-hidden rounded-none border-l border-border/60 bg-background/95 p-0 shadow-2xl sm:rounded-none">
        <div className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <DialogTitle>Configurar componente</DialogTitle>
            <DialogDescription>
              Ajuste tipo, dados, layout, visibilidade e overrides locais deste bloco.
            </DialogDescription>
          </DialogHeader>

          {component ? (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Titulo">
                  <Input
                    value={component.title}
                    onChange={(event) => onChange({ title: event.target.value })}
                  />
                </Field>
                <Field label="Tipo">
                  <Select
                    value={component.type}
                    onValueChange={(value) => onChange({ type: value as DashboardComponentConfig["type"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {COMPONENT_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Subtitulo">
                <Input
                  value={component.subtitle || ""}
                  onChange={(event) => onChange({ subtitle: event.target.value })}
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fonte de dados">
                  <Select
                    value={component.dataSource}
                    onValueChange={(value) => {
                      const nextSource = resolveSource(value as DashboardComponentConfig["dataSource"]);
                      const nextType = nextSource?.supportedTypes.includes(component.type)
                        ? component.type
                        : nextSource?.defaultComponentType || component.type;

                      onChange({
                        dataSource: value as DashboardComponentConfig["dataSource"],
                        type: nextType,
                        tone: nextSource?.tone || component.tone,
                        icon: nextSource?.icon || component.icon,
                        subtitle: component.subtitle || nextSource?.defaultSubtitle,
                        title: component.title || nextSource?.defaultTitle,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DASHBOARD_SOURCE_CATALOG.map((item) => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tom visual">
                  <Select
                    value={component.tone || "primary"}
                    onValueChange={(value) => onChange({ tone: value as DashboardTone })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DASHBOARD_TONE_OPTIONS.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {TONE_LABELS[tone]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Largura">
                  <Select
                    value={String(component.layout.colSpan)}
                    onValueChange={(value) =>
                      onChange({
                        layout: { ...component.layout, colSpan: Number(value) },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 4, 5, 6, 7, 8, 12].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value} colunas
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Altura minima">
                  <Input
                    type="number"
                    min={120}
                    step={10}
                    value={component.layout.minHeight}
                    onChange={(event) =>
                      onChange({
                        layout: {
                          ...component.layout,
                          minHeight: Math.max(120, Number(event.target.value) || 120),
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Limite de itens">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={component.limit || 8}
                    onChange={(event) => onChange({ limit: Math.max(1, Number(event.target.value) || 1) })}
                  />
                </Field>
              </div>

              <div className="grid gap-4 rounded-2xl border border-border/60 bg-background/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Comportamento</div>
                    <p className="text-xs text-muted-foreground">
                      Controle se o bloco responde aos filtros globais e se permanece visivel.
                    </p>
                  </div>
                </div>
                <ToggleRow
                  label="Usar filtros globais"
                  checked={component.useGlobalFilters}
                  onCheckedChange={(checked) => onChange({ useGlobalFilters: checked })}
                />
                <ToggleRow
                  label="Componente visivel"
                  checked={component.isVisible}
                  onCheckedChange={(checked) => onChange({ isVisible: checked })}
                />
              </div>

              {component.type === "text" ? (
                <Field label="Conteudo do texto">
                  <Textarea
                    rows={8}
                    value={String(component.configJson?.body || component.subtitle || "")}
                    onChange={(event) =>
                      onChange({
                        configJson: {
                          ...(component.configJson || {}),
                          body: event.target.value,
                        },
                      })
                    }
                  />
                </Field>
              ) : null}

              {component.type === "section" ? (
                <Field label="Descricao da secao">
                  <Textarea
                    rows={5}
                    value={String(component.configJson?.description || component.subtitle || "")}
                    onChange={(event) =>
                      onChange({
                        configJson: {
                          ...(component.configJson || {}),
                          description: event.target.value,
                        },
                      })
                    }
                  />
                </Field>
              ) : null}

              <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                <div className="font-medium">Overrides de filtro</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Preencha apenas quando este componente precisar fugir do contexto global.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {DASHBOARD_FILTER_DEFINITIONS.map((filter) => (
                    <Field key={filter.id} label={filter.label}>
                      <FilterSelect
                        value={component.filters?.[filter.type] || ""}
                        options={filterOptions[filter.type] || []}
                        placeholder="Seguir global"
                        onChange={(value) =>
                          onChange({
                            filters: {
                              ...(component.filters || {}),
                              [filter.type]: value || "",
                            },
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="border-t border-border/60 bg-background/90 px-6 py-4 sm:justify-between">
            <div className="text-sm text-muted-foreground">
              As alteracoes deste bloco entram no rascunho. Use salvar para persistir o dashboard.
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button className="gap-2" onClick={() => void onSave()} disabled={!dirty || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar dashboard
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateDashboardDialog({
  open,
  form,
  pending,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  open: boolean;
  form: CreateDashboardForm;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<CreateDashboardForm>) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl border-border/60 bg-background/95 shadow-card">
        <DialogHeader>
          <DialogTitle>Novo dashboard</DialogTitle>
          <DialogDescription>
            Crie um dashboard em rascunho para montar uma nova visao operacional, de sprint, projetos ou uma combinacao personalizada.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Nome">
            <Input value={form.name} onChange={(event) => onChange({ name: event.target.value })} />
          </Field>
          <Field label="Descricao">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </Field>
          <Field label="Tipo de visao">
            <Select value={form.type} onValueChange={(value) => onChange({ type: value as DashboardViewType })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VIEW_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenericChart({
  chartType,
  data,
  tone,
  onClickRow,
}: {
  chartType: "line" | "bar" | "donut";
  data: Array<Record<string, string | number>>;
  tone: DashboardTone;
  onClickRow?: (row: Record<string, string | number>) => void;
}) {
  if (!data.length) {
    return (
      <div className="grid h-full min-h-[220px] place-items-center rounded-2xl border border-dashed border-border/60 text-sm text-muted-foreground">
        Nenhum dado encontrado.
      </div>
    );
  }

  const keys = Object.keys(data[0]);
  const stringKeys = keys.filter((key) => typeof data[0][key] === "string");
  const numericKeys = keys.filter((key) => typeof data[0][key] === "number");
  const labelKey = stringKeys.find((key) => ["day", "name", "label", "role"].includes(key)) || stringKeys[0];
  const colors = TONE_CHART_COLORS[tone];

  if (chartType === "donut") {
    const nameKey = labelKey || "name";
    const valueKey = numericKeys.find((key) => key === "value") || numericKeys[0];

    return (
      <ResponsiveContainer width="100%" height={250}>
        <RePieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius={56}
            outerRadius={88}
            paddingAngle={4}
            stroke="none"
          >
            {data.map((row, index) => (
              <Cell
                key={`${nameKey}-${index}`}
                fill={typeof row.color === "string" ? row.color : colors[index % colors.length]}
                onClick={() => onClickRow?.(data[index])}
                cursor={onClickRow ? "pointer" : undefined}
              />
            ))}
          </Pie>
        </RePieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <ReLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.02 265 / 0.4)" />
          <XAxis dataKey={labelKey} stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          {numericKeys.slice(0, 2).map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index % colors.length]}
              strokeWidth={index === 0 ? 2.5 : 2}
              strokeDasharray={index === 1 ? "4 4" : undefined}
              dot={index === 0 ? { r: 3, fill: colors[index % colors.length] } : false}
            />
          ))}
        </ReLineChart>
      </ResponsiveContainer>
    );
  }

  const verticalLayout = numericKeys.some((key) => ["capacidade", "utilizado", "capacity", "used", "occupancy"].includes(key));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ReBarChart
        data={data}
        layout={verticalLayout ? "vertical" : "horizontal"}
        margin={verticalLayout ? { left: 8, right: 12 } : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.02 265 / 0.4)" />
        {verticalLayout ? (
          <>
            <XAxis type="number" stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              dataKey={labelKey}
              type="category"
              width={92}
              stroke="oklch(0.68 0.025 260)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={labelKey} stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.27 0.03 265 / 0.3)" }} />
        {numericKeys.slice(0, 2).map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[index % colors.length]}
            radius={verticalLayout ? [0, 8, 8, 0] : [8, 8, 0, 0]}
            onClick={(barData) => onClickRow?.(barData.payload as Record<string, string | number>)}
            cursor={onClickRow ? "pointer" : undefined}
          />
        ))}
      </ReBarChart>
    </ResponsiveContainer>
  );
}

function FunnelView({
  steps,
}: {
  steps: Array<{ label: string; value: number; tone?: DashboardTone }>;
  tone: DashboardTone;
}) {
  const max = Math.max(...steps.map((step) => step.value), 1);

  return (
    <div className="space-y-3">
      {steps.length ? (
        steps.map((step) => {
          const stepTone = step.tone || "primary";
          const width = Math.max(18, Math.round((step.value / max) * 100));

          return (
            <div key={step.label} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{step.label}</span>
                <span className="font-medium">{step.value}</span>
              </div>
              <div className="h-3 rounded-full bg-muted/60">
                <div
                  className={cn("h-3 rounded-full bg-gradient-to-r", TONE_ACCENTS[stepTone])}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          Nenhuma etapa disponivel.
        </div>
      )}
    </div>
  );
}

function AvgResolutionTimeKPI() {
  const query = useQuery({
    queryKey: ["dashboard-ticket-status-donut"],
    queryFn: () => getTicketsReport(),
  });

  if (query.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface/60 p-5">
        <div className="h-3 w-32 animate-pulse rounded bg-muted/60" />
        <div className="mt-4 h-10 w-24 animate-pulse rounded bg-muted/40" />
      </div>
    );
  }

  const raw = query.data?.avg_resolution_time_hours;
  const value = raw != null ? `${Number(raw).toFixed(1)}h` : "N/A";

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-5">
      <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        Tempo médio de resolução
      </div>
      <div className="mt-3 text-[32px] font-semibold leading-none tabular-nums tracking-tight">
        {value}
      </div>
      <div className="mt-2 text-[11.5px] text-muted-foreground">
        Média de horas até resolução dos chamados
      </div>
    </div>
  );
}

function SlaRateKPI() {
  const query = useQuery({
    queryKey: ["dashboard-ticket-status-donut"],
    queryFn: () => getTicketsReport(),
  });

  if (query.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface/60 p-5">
        <div className="h-3 w-32 animate-pulse rounded bg-muted/60" />
        <div className="mt-4 h-10 w-24 animate-pulse rounded bg-muted/40" />
      </div>
    );
  }

  const raw = query.data?.sla_met_rate;
  const hasValue = raw != null;
  const pct = hasValue ? Number(raw) : null;
  const display = hasValue ? `${Math.round(pct!)}%` : "N/A";
  const colorClass =
    pct == null
      ? "text-muted-foreground"
      : pct >= 80
        ? "text-success"
        : pct >= 60
          ? "text-warning"
          : "text-destructive";

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-5">
      <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" />
        Taxa de SLA
      </div>
      <div className={cn("mt-3 text-[32px] font-semibold leading-none tabular-nums tracking-tight", colorClass)}>
        {display}
      </div>
      <div className="mt-2 text-[11.5px] text-muted-foreground">
        Chamados finalizados dentro do prazo de SLA
      </div>
    </div>
  );
}

const STATUS_DONUT_COLORS = [
  "oklch(0.72 0.20 260)",
  "oklch(0.74 0.18 155)",
  "oklch(0.78 0.16 75)",
  "oklch(0.68 0.22 28)",
  "oklch(0.64 0.03 260)",
  "oklch(0.80 0.16 85)",
];

function TicketStatusDonut() {
  const query = useQuery({
    queryKey: ["dashboard-ticket-status-donut"],
    queryFn: () => getTicketsReport(),
  });

  if (query.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface/60 p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-4 h-[200px] animate-pulse rounded-lg bg-muted/40" />
      </div>
    );
  }

  const byStatus = query.data?.by_status ?? [];
  if (!byStatus.length) return null;

  const pieData = byStatus.map((item) => ({ name: item.status, value: item.count }));
  const total = pieData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-5">
      <div className="text-[13px] font-semibold tracking-tight">Chamados por Status</div>
      <div className="mt-1 text-[11.5px] text-muted-foreground">Distribuição atual dos chamados por status</div>
      <div className="mt-4 flex flex-wrap items-center gap-8">
        <div className="flex-shrink-0">
          <ResponsiveContainer width={220} height={220}>
            <RePieChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={3}
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={STATUS_DONUT_COLORS[index % STATUS_DONUT_COLORS.length]} />
                ))}
              </Pie>
            </RePieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2 min-w-[160px]">
          {pieData.map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                  style={{ background: STATUS_DONUT_COLORS[index % STATUS_DONUT_COLORS.length] }}
                />
                <span className="text-[13px] capitalize">{entry.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold tabular-nums">{entry.value}</span>
                <span className="text-[11px] text-muted-foreground">({total > 0 ? Math.round((entry.value / total) * 100) : 0}%)</span>
              </div>
            </div>
          ))}
          <div className="mt-3 border-t border-border pt-3 flex justify-between text-[12px]">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-[188px] animate-pulse rounded-[28px] border border-border/50 bg-background/45",
            index < 4 ? "xl:col-span-3" : "xl:col-span-6",
          )}
        />
      ))}
    </div>
  );
}

function EmptyDashboardState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="rounded-[28px] border border-dashed border-border/60 bg-background/55 p-10 text-center shadow-card">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-primary/30 bg-primary/10 text-primary">
        <LayoutDashboard className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">Nenhum dashboard disponivel</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Crie um dashboard para publicar a visao operacional do sistema.
      </p>
      {onCreate ? (
        <div className="mt-5">
          <Button onClick={onCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Criar dashboard
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function FilterField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <FilterSelect
        value={value}
        options={options}
        placeholder={`Todos os valores de ${label.toLowerCase()}`}
        onChange={onChange}
      />
    </Field>
  );
}

function FilterSelect({
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || EMPTY_OPTION_VALUE}
      disabled={disabled}
      onValueChange={(nextValue) => onChange(nextValue === EMPTY_OPTION_VALUE ? "" : nextValue)}
    >
      <SelectTrigger className="glass">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_OPTION_VALUE}>{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/60 px-3 py-2">
      <div className="text-sm">{label}</div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function IconActionButton({
  children,
  destructive,
  label,
  onClick,
}: {
  children: ReactNode;
  destructive?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded-xl border border-border/60 bg-background/70 p-2 text-muted-foreground transition hover:border-primary/40 hover:text-foreground",
        destructive && "hover:border-destructive/50 hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

function applyDashboardComponentPatch(
  component: DashboardComponentConfig,
  patch: DashboardComponentPatch,
): DashboardComponentConfig {
  if (!patch.layout) {
    const { layout: _layout, ...restPatch } = patch;
    return {
      ...component,
      ...restPatch,
    };
  }

  const nextType = patch.type ?? component.type;
  const nextLayout: DashboardGridLayout = {
    ...component.layout,
    ...patch.layout,
  };

  if (
    patch.layout.colSpan !== undefined
    && (patch.layout.w === undefined || patch.layout.w === component.layout.w)
  ) {
    nextLayout.w = patch.layout.colSpan;
  }

  if (
    patch.layout.minHeight !== undefined
    && (patch.layout.h === undefined || patch.layout.h === component.layout.h)
  ) {
    nextLayout.h = getDefaultGridHeight(nextType, patch.layout.minHeight);
  }

  if (patch.layout.w !== undefined && patch.layout.colSpan === undefined) {
    nextLayout.colSpan = patch.layout.w;
  }

  if (patch.layout.h !== undefined && patch.layout.minHeight === undefined) {
    nextLayout.minHeight = Math.max(
      nextLayout.minHeight || 120,
      patch.layout.h * BUILDER_GRID_ROW_HEIGHT,
    );
  }

  const merged: DashboardComponentConfig = {
    ...component,
    ...patch,
    type: nextType,
    layout: nextLayout,
  };

  return {
    ...merged,
    layout: normalizeComponentGridLayout(merged, component.layout.order),
  };
}

function resolveSource(key: DashboardComponentConfig["dataSource"]) {
  return DASHBOARD_SOURCE_CATALOG.find((item) => item.key === key) || null;
}

function renderIcon(name: string, className = "h-4 w-4") {
  const Icon = resolveIcon(name);
  return <Icon className={className} />;
}

function resolveIcon(name: string) {
  return ICON_MAP[name] || LayoutDashboard;
}

function inferToneFromData(data: DashboardResolvedData): DashboardTone {
  if ("tone" in data && data.tone) {
    return data.tone;
  }

  return "primary";
}

function isFullWidthBuilderType(type: DashboardComponentConfig["type"]) {
  return type === "section" || type === "separator";
}

function getDefaultGridHeight(
  type: DashboardComponentConfig["type"],
  minHeight: number,
) {
  if (type === "section" || type === "separator") {
    return 1;
  }

  if (type === "kpi" || type === "progress") {
    return 2;
  }

  return Math.max(2, Math.ceil(minHeight / BUILDER_GRID_ROW_HEIGHT));
}

function normalizeComponentGridLayout(
  component: DashboardComponentConfig,
  fallbackOrder: number,
): DashboardGridLayout {
  const width = isFullWidthBuilderType(component.type)
    ? BUILDER_GRID_COLUMNS
    : Math.max(
      1,
      Math.min(
        BUILDER_GRID_COLUMNS,
        Number(component.layout.w ?? component.layout.colSpan ?? 3) || 3,
      ),
    );
  const height = Math.max(
    1,
    Number(component.layout.h ?? getDefaultGridHeight(component.type, component.layout.minHeight)) || 1,
  );

  return {
    ...component.layout,
    order: Number(component.layout.order ?? fallbackOrder) || fallbackOrder,
    colSpan: width,
    minHeight: Math.max(component.layout.minHeight || 120, height * BUILDER_GRID_ROW_HEIGHT),
    x: isFullWidthBuilderType(component.type)
      ? 0
      : Math.max(0, Math.min(BUILDER_GRID_COLUMNS - width, Number(component.layout.x ?? 0) || 0)),
    y: Math.max(0, Number(component.layout.y ?? fallbackOrder) || fallbackOrder),
    w: width,
    h: height,
  };
}

function rectsOverlap(left: BuilderGridRect, right: BuilderGridRect) {
  return !(
    left.x + left.w <= right.x
    || right.x + right.w <= left.x
    || left.y + left.h <= right.y
    || right.y + right.h <= left.y
  );
}

function canPlaceRect(
  rect: BuilderGridRect,
  placed: Array<{ id: string; rect: BuilderGridRect }>,
  ignoreId?: string,
) {
  return placed.every((item) => item.id === ignoreId || !rectsOverlap(rect, item.rect));
}

function compactDashboardComponents(components: DashboardComponentConfig[]) {
  let normalized = components.map((component, index) => ({
    ...component,
    layout: normalizeComponentGridLayout(component, index),
  }));

  const shouldHydrateLegacyLayout = normalized.every((component) =>
    component.layout.x === 0 && component.layout.y === component.layout.order,
  );

  if (shouldHydrateLegacyLayout) {
    let cursorX = 0;
    let cursorY = 0;
    let rowHeight = 0;

    normalized = normalized.map((component) => {
      const width = isFullWidthBuilderType(component.type) ? BUILDER_GRID_COLUMNS : component.layout.w;
      const height = component.layout.h;

      if (width === BUILDER_GRID_COLUMNS) {
        if (cursorX > 0) {
          cursorY += rowHeight;
          cursorX = 0;
          rowHeight = 0;
        }

        const next = {
          ...component,
          layout: {
            ...component.layout,
            x: 0,
            y: cursorY,
            w: BUILDER_GRID_COLUMNS,
            colSpan: BUILDER_GRID_COLUMNS,
          },
        };

        cursorY += height;
        return next;
      }

      if (cursorX + width > BUILDER_GRID_COLUMNS) {
        cursorY += rowHeight;
        cursorX = 0;
        rowHeight = 0;
      }

      const next = {
        ...component,
        layout: {
          ...component.layout,
          x: cursorX,
          y: cursorY,
          w: width,
          colSpan: width,
        },
      };

      cursorX += width;
      rowHeight = Math.max(rowHeight, height);
      return next;
    });
  }

  const sorted = [...normalized].sort((left, right) => {
    if (left.layout.y !== right.layout.y) {
      return left.layout.y - right.layout.y;
    }

    if (left.layout.x !== right.layout.x) {
      return left.layout.x - right.layout.x;
    }

    return left.layout.order - right.layout.order;
  });

  const placed: Array<{ id: string; rect: BuilderGridRect }> = [];

  const packed = sorted.map((component) => {
    const width = isFullWidthBuilderType(component.type) ? BUILDER_GRID_COLUMNS : component.layout.w;
    let nextX = isFullWidthBuilderType(component.type) ? 0 : component.layout.x;
    let nextY = component.layout.y;
    const rect = { x: nextX, y: nextY, w: width, h: component.layout.h };

    while (!canPlaceRect(rect, placed, component.id)) {
      nextY += 1;
      rect.y = nextY;
      rect.x = nextX;
    }

    while (rect.y > 0) {
      const candidate = { ...rect, y: rect.y - 1 };
      if (!canPlaceRect(candidate, placed, component.id)) {
        break;
      }
      rect.y = candidate.y;
    }

    placed.push({ id: component.id, rect: { ...rect } });

    return {
      ...component,
      layout: {
        ...component.layout,
        order: 0,
        colSpan: width,
        minHeight: Math.max(component.layout.minHeight || 120, rect.h * BUILDER_GRID_ROW_HEIGHT),
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
      },
    };
  });

  return packed
    .sort((left, right) => {
      if (left.layout.y !== right.layout.y) {
        return left.layout.y - right.layout.y;
      }

      if (left.layout.x !== right.layout.x) {
        return left.layout.x - right.layout.x;
      }

      return left.layout.order - right.layout.order;
    })
    .map((component, index) => ({
      ...component,
      layout: {
        ...component.layout,
        order: index,
      },
    }));
}

function buildComponentLayoutPatch(
  component: DashboardComponentConfig,
  rect: BuilderGridRect,
): DashboardGridLayout {
  const width = isFullWidthBuilderType(component.type)
    ? BUILDER_GRID_COLUMNS
    : Math.max(1, Math.min(BUILDER_GRID_COLUMNS, rect.w));
  const height = Math.max(1, rect.h);

  return {
    ...component.layout,
    colSpan: width,
    minHeight: Math.max(component.layout.minHeight || 120, height * BUILDER_GRID_ROW_HEIGHT),
    x: isFullWidthBuilderType(component.type) ? 0 : Math.max(0, Math.min(BUILDER_GRID_COLUMNS - width, rect.x)),
    y: Math.max(0, rect.y),
    w: width,
    h: height,
    order: component.layout.order,
  };
}

function getTemplateGridSize(templateType: DashboardComponentConfig["type"]) {
  const template = DASHBOARD_COMPONENT_TEMPLATES.find((item) => item.type === templateType);

  if (!template) {
    return { w: 3, h: 2 };
  }

  return {
    w: isFullWidthBuilderType(template.type)
      ? BUILDER_GRID_COLUMNS
      : Math.max(1, Math.min(BUILDER_GRID_COLUMNS, template.defaultColSpan)),
    h: getDefaultGridHeight(template.type, template.defaultHeight),
  };
}

// browsers block dataTransfer.getData() during dragover for security — use a module var instead
let _activeDragPayload: BuilderDragDescriptor | null = null;

function writeBuilderDragPayload(event: ReactDragEvent, payload: BuilderDragDescriptor) {
  _activeDragPayload = payload;
  const serialized = JSON.stringify(payload);
  event.dataTransfer.effectAllowed = payload.kind === "component" ? "move" : "copyMove";
  event.dataTransfer.setData("application/x-stratos-dashboard-builder", serialized);
  event.dataTransfer.setData("text/plain", serialized);
}

function readBuilderDragPayload(event: Pick<ReactDragEvent, "dataTransfer">): BuilderDragDescriptor | null {
  const rawValue =
    event.dataTransfer.getData("application/x-stratos-dashboard-builder")
    || event.dataTransfer.getData("text/plain");

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as BuilderDragDescriptor;
  } catch {
    return null;
  }
}

function sortDashboards(dashboards: DashboardDefinition[]) {
  return [...dashboards].sort((left, right) => {
    if (Number(right.isActive) !== Number(left.isActive)) {
      return Number(right.isActive) - Number(left.isActive);
    }

    const leftUpdated = new Date(left.updatedAt || left.createdAt).getTime();
    const rightUpdated = new Date(right.updatedAt || right.createdAt).getTime();
    return rightUpdated - leftUpdated;
  });
}

function sortComponents(components: DashboardComponentConfig[]) {
  return compactDashboardComponents(components);
}

function normalizeDashboard(dashboard: DashboardDefinition) {
  return {
    ...dashboard,
    components: sortComponents(dashboard.components),
  };
}

function stripLegacyGlobalSection(dashboard: DashboardDefinition) {
  const nextComponents = dashboard.components.filter(
    (component) => !isLegacyGlobalSection(component),
  );

  if (nextComponents.length === dashboard.components.length) {
    return dashboard;
  }

  return normalizeDashboard({
    ...dashboard,
    components: nextComponents,
  });
}

function sanitizeOperationalDashboard(dashboard: DashboardDefinition) {
  const withoutLegacySection = stripLegacyGlobalSection(dashboard);
  const nextFilters = harmonizeOperationalFilters(withoutLegacySection);

  if (nextFilters === withoutLegacySection.filters) {
    return withoutLegacySection;
  }

  return {
    ...withoutLegacySection,
    filters: nextFilters,
  };
}

function isLegacyGlobalSection(component: DashboardComponentConfig) {
  return component.type === "section" && component.title.trim() === LEGACY_GLOBAL_SECTION_TITLE;
}

function harmonizeOperationalFilters(dashboard: DashboardDefinition) {
  if (dashboard.type !== "operational") {
    return dashboard.filters;
  }

  const baseFilters = dashboard.filters.length
    ? dashboard.filters
    : DASHBOARD_FILTER_DEFINITIONS;

  const nextFilters = baseFilters.filter((filter) =>
    OPERATIONAL_FILTER_TYPES.includes(filter.type),
  );

  const unchanged =
    nextFilters.length === dashboard.filters.length
    && nextFilters.every((filter, index) => filter === dashboard.filters[index]);

  return unchanged ? dashboard.filters : nextFilters.map((filter) => ({ ...filter, enabled: true }));
}

function sortFilters(filters: DashboardFilterDefinition[]) {
  const order = DASHBOARD_FILTER_DEFINITIONS.map((filter) => filter.type);
  return [...filters].sort(
    (left, right) => order.indexOf(left.type) - order.indexOf(right.type),
  );
}

function cloneDashboard(dashboard: DashboardDefinition) {
  return JSON.parse(JSON.stringify(dashboard)) as DashboardDefinition;
}

function cloneComponent(component: DashboardComponentConfig) {
  return JSON.parse(JSON.stringify(component)) as DashboardComponentConfig;
}

function serializeDashboard(dashboard: DashboardDefinition) {
  return JSON.stringify({
    name: dashboard.name,
    description: dashboard.description || "",
    type: dashboard.type,
    status: dashboard.status,
    isActive: dashboard.isActive,
    filters: sortFilters(dashboard.filters).map((filter) => ({
      id: filter.id,
      type: filter.type,
      label: filter.label,
      enabled: filter.enabled,
      defaultValue: filter.defaultValue || "",
    })),
    components: normalizeDashboard(dashboard).components.map((component) => ({
      id: component.id,
      type: component.type,
      title: component.title,
      subtitle: component.subtitle || "",
      icon: component.icon || "",
      tone: component.tone || "primary",
      dataSource: component.dataSource,
      limit: component.limit || 8,
      useGlobalFilters: component.useGlobalFilters,
      filters: component.filters || {},
      configJson: component.configJson || {},
      isVisible: component.isVisible,
      layout: component.layout,
    })),
  });
}

function mergeFilterState(
  current: DashboardFilterState,
  dashboard: DashboardDefinition,
  filterOptions: DashboardFilterOptions,
) {
  const next = getDefaultFilterState(dashboard);

  sortFilters(dashboard.filters)
    .filter((filter) => filter.enabled)
    .forEach((filter) => {
      const currentValue = current[filter.type];
      const availableOptions = filterOptions[filter.type] || [];

      if (currentValue && optionExists(currentValue, availableOptions)) {
        next[filter.type] = currentValue;
        return;
      }

      if (next[filter.type] && !optionExists(next[filter.type] || "", availableOptions)) {
        delete next[filter.type];
      }
    });

  return next;
}

function areFilterStatesEqual(left: DashboardFilterState, right: DashboardFilterState) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key, index) => {
    if (key !== rightKeys[index]) {
      return false;
    }

    return left[key as DashboardFilterKey] === right[key as DashboardFilterKey];
  });
}

function optionExists(
  value: string,
  options: Array<{ value: string; label: string }>,
) {
  if (!value) {
    return true;
  }

  return options.some((option) => option.value === value || option.label === value);
}
