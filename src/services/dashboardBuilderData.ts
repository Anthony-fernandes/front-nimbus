import { formatActivityStatusLabel, formatPriorityLabel, formatSprintStatusLabel, formatTicketStatusLabel } from "@/lib/labels";
import {
  DASHBOARD_SOURCE_CATALOG,
  type DashboardComponentConfig,
  type DashboardDataSourceKey,
  type DashboardDefinition,
  type DashboardFilterKey,
  type DashboardFilterState,
  type DashboardTone,
} from "@/lib/dashboardBuilder";
import { formatHoursLabel } from "@/lib/activityFlow";
import type {
  Activity,
  ActivityTimeEntry,
  Organization,
  Project,
  Sprint,
  SprintActivityPlan,
  Ticket,
  User,
} from "@/lib/types";
import {
  buildSprintBacklogItems,
  getTicketPriorityClass,
  getTicketStatusClass,
  isFinalTicketStatus,
} from "@/lib/tickets";
import {
  buildDailyTicketTrend,
  buildStatusDistribution,
} from "@/services/analytics";
import { formatDate, toNumber } from "@/services/utils";

export type DashboardOption = {
  value: string;
  label: string;
};

export type DashboardFilterOptions = Record<DashboardFilterKey, DashboardOption[]>;

export type DashboardDataContext = {
  tickets: Ticket[];
  users: User[];
  sprints: Sprint[];
  activities: Activity[];
  sprintPlans: SprintActivityPlan[];
  timeEntries: ActivityTimeEntry[];
  projects: Project[];
  clients: Organization[];
};

export type DashboardResolvedData =
  | {
      kind: "kpi";
      value: string;
      numericValue: number;
      helper?: string;
      tone?: DashboardTone;
    }
  | {
      kind: "series";
      chartType: "line" | "bar" | "donut";
      data: Array<Record<string, string | number>>;
      tone?: DashboardTone;
      helper?: string;
    }
  | {
      kind: "table";
      columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
      rows: Array<Record<string, string | number>>;
      helper?: string;
    }
  | {
      kind: "list";
      items: Array<{
        id: string;
        title: string;
        subtitle?: string;
        meta?: string;
        badges?: Array<{ label: string; tone: DashboardTone }>;
      }>;
      helper?: string;
    }
  | {
      kind: "progress";
      value: number;
      label: string;
      helper?: string;
      tone?: DashboardTone;
    }
  | {
      kind: "funnel";
      steps: Array<{ label: string; value: number; tone?: DashboardTone }>;
      helper?: string;
    }
  | {
      kind: "text";
      body: string;
    }
  | {
      kind: "section";
      description?: string;
      badges?: string[];
    }
  | {
      kind: "separator";
      label?: string;
    };

type SprintDashboardItem = {
  key: string;
  id: string;
  type: "ticket" | "activity";
  code: string;
  title: string;
  status: string;
  statusLabel: string;
  ownerIds: string[];
  ownerNames: string[];
  ownerName: string;
  ownerRole: string;
  teamLabel: string;
  dueAt?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  plannedHours: number;
  realizedHours: number;
  storyPoints: number;
  completed: boolean;
  blocked: boolean;
  late: boolean;
  phase: "completed" | "blocked" | "not_started" | "in_progress";
};

type SprintCapacityRow = {
  key: string;
  name: string;
  role: string;
  capacity: number;
  utilized: number;
  realized: number;
  occupancy: number;
  status: "overloaded" | "attention" | "balanced" | "available";
  itemCount: number;
  blockedCount: number;
  lateCount: number;
};

type RoleBottleneck = {
  role: string;
  capacity: number;
  utilized: number;
  occupancy: number;
  people: number;
  blockedCount: number;
  lateCount: number;
};

type SprintDashboardContext = {
  sprint: Sprint;
  team: string;
  isActive: boolean;
  items: SprintDashboardItem[];
  metrics: {
    totalItems: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    blocked: number;
    late: number;
    progress: number;
    daysRemaining: number | null;
    daysRemainingLabel: string;
  };
  statusData: Array<{ name: string; value: number; color: string }>;
  ownerDistribution: Array<{ name: string; chamados: number }>;
  progressData: Array<{ day: string; ideal: number; real: number }>;
  capacityRows: SprintCapacityRow[];
  bottlenecks: RoleBottleneck[];
  attentionItems: SprintDashboardItem[];
};

export function getDefaultFilterState(dashboard?: DashboardDefinition | null): DashboardFilterState {
  const state: DashboardFilterState = {};
  (dashboard?.filters || []).forEach((filter) => {
    if (filter.enabled && filter.defaultValue) {
      state[filter.type] = filter.defaultValue;
    }
  });
  return state;
}

export function buildFilterOptions(context: DashboardDataContext): DashboardFilterOptions {
  const sprintContexts = buildSprintDashboardContexts(context);

  return {
    period: [
      { value: "today", label: "Hoje" },
      { value: "7d", label: "Ultimos 7 dias" },
      { value: "30d", label: "Ultimos 30 dias" },
      { value: "90d", label: "Ultimos 90 dias" },
      { value: "all", label: "Tudo" },
    ],
    team: uniqueOptions(
      context.tickets.map((ticket) => ticket.team || ""),
      context.users.map((user) => user.technical_group || user.specialty || ""),
      sprintContexts.map((sprint) => sprint.team || ""),
    ),
    sprint: context.sprints
      .map((sprint) => ({ value: sprint.id, label: sprint.name }))
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    project: context.projects
      .map((project) => ({ value: project.id, label: project.name }))
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    responsible: context.users
      .filter((user) => user.is_active !== false)
      .map((user) => ({ value: user.id, label: getUserDisplayName(user) }))
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    client: uniqueOptions(
      context.clients.map((client) => client.name || ""),
      context.tickets.map((ticket) => ticket.client_name || ticket.organization_name || ""),
      context.projects.map((project) => project.client_name || project.organization_name || ""),
    ),
    status: uniqueOptions(
      context.tickets.map((ticket) => formatTicketStatusLabel(ticket.status || "")),
      context.activities.map((activity) => formatActivityStatusLabel(activity.status || "")),
      context.projects.map((project) => project.status || ""),
    ),
    priority: uniqueOptions(context.tickets.map((ticket) => formatPriorityLabel(ticket.priority || ""))),
  };
}

export function resolveComponentData(
  component: DashboardComponentConfig,
  context: DashboardDataContext,
  filters: DashboardFilterState,
): DashboardResolvedData {
  if (component.type === "section") {
    return {
      kind: "section",
      description:
        typeof component.configJson?.description === "string"
          ? component.configJson.description
          : component.subtitle || "",
      badges: component.useGlobalFilters ? resolveSectionBadges(filters, component) : [],
    };
  }

  if (component.type === "separator") {
    return {
      kind: "separator",
      label:
        typeof component.configJson?.label === "string"
          ? component.configJson.label
          : component.subtitle || "",
    };
  }

  if (component.type === "text") {
    return {
      kind: "text",
      body:
        typeof component.configJson?.body === "string"
          ? component.configJson.body
          : component.subtitle || "Bloco textual sem conteudo configurado.",
    };
  }

  const effectiveFilters = component.useGlobalFilters
    ? { ...filters, ...(component.filters || {}) }
    : { ...(component.filters || {}) };
  const sprintContexts = buildSprintDashboardContexts(context);
  const selectedSprint = resolveSelectedSprint(sprintContexts, effectiveFilters);
  const ticketRows = applyTicketFilters(context.tickets, effectiveFilters);
  const projectRows = applyProjectFilters(context.projects, effectiveFilters);
  const userRows = applyUserFilters(context.users, effectiveFilters);

  switch (component.dataSource) {
    case "tickets_open":
      return createKpi(
        ticketRows.filter(isOperationalTicketOpen).length,
        "Fila operacional atual",
        component.tone || "primary",
      );
    case "tickets_critical":
      return createKpi(ticketRows.filter(isCriticalTicket).length, "Demandas de maior urgencia", component.tone || "destructive");
    case "tickets_late":
      return createKpi(ticketRows.filter(isOperationalTicketLate).length, "Chamados com prazo vencido", component.tone || "warning");
    case "tickets_due_today":
      return createKpi(ticketRows.filter(isTicketDueToday).length, "Demandas que vencem hoje", component.tone || "accent");
    case "tickets_in_progress":
      return createKpi(ticketRows.filter(isTicketInProgress).length, "Chamados em atendimento", component.tone || "primary");
    case "tickets_waiting_customer":
      return createKpi(ticketRows.filter(isTicketWaitingCustomer).length, "Dependencias aguardando cliente", component.tone || "warning");
    case "tickets_unassigned":
      return createKpi(ticketRows.filter(isTicketUnassigned).length, "Chamados sem responsavel definido", component.tone || "destructive");
    case "tickets_closed_today":
      return createKpi(ticketRows.filter(isTicketClosedToday).length, "Fechamentos no dia", component.tone || "success");
    case "tickets_by_status":
      return createStatusDataset(component.type, buildStatusDistribution(ticketRows));
    case "tickets_by_owner":
      return createSimpleBarOrTable(
        component.type,
        countByLabel(ticketRows.map((ticket) => ticket.responsible_technician_name || ticket.technician_names?.[0] || "Sem responsavel")),
        "chamados",
      );
    case "tickets_by_priority":
      return createSimpleBarOrTable(
        component.type,
        countByLabel(ticketRows.map((ticket) => formatPriorityLabel(ticket.priority || "Sem prioridade"))),
        "chamados",
      );
    case "tickets_by_client":
      return createSimpleBarOrTable(
        component.type,
        countByLabel(ticketRows.map((ticket) => ticket.client_name || ticket.organization_name || "Sem cliente")),
        "chamados",
      );
    case "tickets_trend":
      return createLineDataset(component.type, buildDailyTicketTrend(ticketRows));
    case "tickets_attention_list":
      return createAttentionList(ticketRows, component.limit || 6);
    case "sprints_active":
      return createKpi(sprintContexts.filter((item) => item.isActive).length, "Ciclos em andamento", component.tone || "primary");
    case "sprint_items_total":
      return createKpi(selectedSprint?.metrics.totalItems ?? 0, selectedSprint?.sprint.name || "Sem sprint selecionada", component.tone || "primary");
    case "sprint_items_completed":
      return createKpi(selectedSprint?.metrics.completed ?? 0, "Itens concluidos na sprint", component.tone || "success");
    case "sprint_items_in_progress":
      return createKpi(selectedSprint?.metrics.inProgress ?? 0, "Itens em execucao no ciclo", component.tone || "primary");
    case "sprint_items_not_started":
      return createKpi(selectedSprint?.metrics.notStarted ?? 0, "Itens ainda nao iniciados", component.tone || "accent");
    case "sprint_items_blocked":
      return createKpi(selectedSprint?.metrics.blocked ?? 0, "Impedimentos ativos na sprint", component.tone || "destructive");
    case "sprint_items_late":
      return createKpi(selectedSprint?.metrics.late ?? 0, "Itens com prazo vencido", component.tone || "warning");
    case "sprint_days_remaining":
      return createKpiLabel(selectedSprint?.metrics.daysRemainingLabel || "Sem sprint", "Relogio do ciclo", component.tone || "accent");
    case "sprint_progress":
      return {
        kind: "progress",
        value: selectedSprint?.metrics.progress ?? 0,
        label: `${selectedSprint?.metrics.progress ?? 0}% concluido`,
        helper: selectedSprint?.metrics.daysRemainingLabel || "Sem sprint selecionada",
        tone: component.tone || "success",
      };
    case "sprint_status_distribution":
      return createStatusDataset(component.type, selectedSprint?.statusData || []);
    case "sprint_owner_distribution":
      return createOwnerDistribution(component.type, selectedSprint?.ownerDistribution || []);
    case "sprint_burndown":
      return createBurndownDataset(component.type, selectedSprint?.progressData || []);
    case "sprint_capacity_people":
      return createCapacityDataset(component.type, selectedSprint?.capacityRows || []);
    case "sprint_attention_items":
      return createSprintAttentionList(selectedSprint?.attentionItems || [], component.limit || 6);
    case "projects_active":
      return createKpi(projectRows.filter((project) => normalizeComparisonValue(project.status) !== "concluido").length, "Projetos em andamento", component.tone || "accent");
    case "projects_late":
      return createKpi(projectRows.filter((project) => isDateBeforeToday(project.due_at) && normalizeComparisonValue(project.status) !== "concluido").length, "Projetos com prazo vencido", component.tone || "warning");
    case "projects_by_status":
      return createSimpleBarOrTable(component.type, countByLabel(projectRows.map((project) => project.status || "Sem status")), "projetos");
    case "projects_deliveries_week":
      return createProjectDeliveries(component.type, projectRows, component.limit || 6);
    case "project_activity_distribution":
      return createActivityByProject(component.type, context.activities, effectiveFilters, component.limit || 8);
    case "users_active":
      return createKpi(userRows.filter((user) => user.is_active !== false).length, "Equipe interna disponivel", component.tone || "success");
    case "users_capacity_people":
      return createUserCapacityDataset(component.type, userRows, "capacity", component.limit || 8);
    case "users_occupancy_people":
      return createUserCapacityDataset(component.type, userRows, "occupancy", component.limit || 8);
    case "users_hours_used_people":
      return createUserCapacityDataset(component.type, userRows, "used", component.limit || 8);
    case "users_bottlenecks_role":
      return createRoleBottleneckDataset(component.type, selectedSprint?.bottlenecks || []);
    default:
      return {
        kind: "text",
        body: "Fonte de dados nao suportada para este componente.",
      };
  }
}

function resolveSectionBadges(filters: DashboardFilterState, component: DashboardComponentConfig) {
  return (Object.entries(filters) as Array<[DashboardFilterKey, string]>)
    .filter(([, value]) => Boolean(value))
    .slice(0, 3)
    .map(([key, value]) => `${getFilterLabel(key)}: ${value}`);
}

function getFilterLabel(key: DashboardFilterKey) {
  switch (key) {
    case "period":
      return "Periodo";
    case "team":
      return "Equipe";
    case "sprint":
      return "Sprint";
    case "project":
      return "Projeto";
    case "responsible":
      return "Responsavel";
    case "client":
      return "Cliente";
    case "status":
      return "Status";
    case "priority":
      return "Prioridade";
    default:
      return key;
  }
}

function createKpi(value: number, helper: string, tone: DashboardTone): DashboardResolvedData {
  return {
    kind: "kpi",
    value: String(value),
    numericValue: value,
    helper,
    tone,
  };
}

function createKpiLabel(value: string, helper: string, tone: DashboardTone): DashboardResolvedData {
  return {
    kind: "kpi",
    value,
    numericValue: 0,
    helper,
    tone,
  };
}

function createStatusDataset(
  componentType: DashboardComponentConfig["type"],
  rows: Array<{ name: string; value: number; color: string }>,
): DashboardResolvedData {
  if (componentType === "table") {
    return {
      kind: "table",
      columns: [
        { key: "name", label: "Status" },
        { key: "value", label: "Volume", align: "right" },
      ],
      rows: rows.map((row) => ({ name: row.name, value: row.value })),
      helper: "Distribuicao por status",
    };
  }

  if (componentType === "funnel") {
    return {
      kind: "funnel",
      steps: rows.map((row) => ({
        label: row.name,
        value: row.value,
        tone: resolveToneFromColor(row.color),
      })),
      helper: "Funil resumido por status",
    };
  }

  return {
    kind: "series",
    chartType: componentType === "bar" ? "bar" : "donut",
    data: rows,
    helper: "Distribuicao atual",
  };
}

function createLineDataset(
  componentType: DashboardComponentConfig["type"],
  rows: Array<{ day: string; sla: number }>,
): DashboardResolvedData {
  if (componentType === "table") {
    return {
      kind: "table",
      columns: [
        { key: "day", label: "Dia" },
        { key: "sla", label: "Chamados", align: "right" },
      ],
      rows,
      helper: "Historico da serie temporal",
    };
  }

  return {
    kind: "series",
    chartType: componentType === "bar" ? "bar" : "line",
    data: rows,
    helper: "Tendencia temporal",
  };
}

function createSimpleBarOrTable(
  componentType: DashboardComponentConfig["type"],
  rows: Array<{ name: string; value: number }>,
  valueLabel: string,
): DashboardResolvedData {
  if (componentType === "table") {
    return {
      kind: "table",
      columns: [
        { key: "name", label: "Grupo" },
        { key: "value", label: valueLabel, align: "right" },
      ],
      rows,
      helper: "Resumo tabular",
    };
  }

  if (componentType === "list") {
    return {
      kind: "list",
      items: rows.slice(0, 8).map((row) => ({
        id: row.name,
        title: row.name,
        meta: `${row.value} ${valueLabel}`,
      })),
      helper: "Resumo por agrupamento",
    };
  }

  return {
    kind: "series",
    chartType: "bar",
    data: rows.map((row) => ({ name: shortenLabel(row.name), chamados: row.value })),
    helper: "Comparativo por grupo",
  };
}

function createAttentionList(rows: Ticket[], limit: number): DashboardResolvedData {
  return {
    kind: "list",
    items: rows
      .filter((ticket) => isOperationalTicketOpen(ticket) && (isCriticalTicket(ticket) || isOperationalTicketLate(ticket) || isTicketDueToday(ticket)))
      .sort((left, right) => {
        const leftScore = Number(isCriticalTicket(left)) * 3 + Number(isOperationalTicketLate(left)) * 2 + Number(isTicketDueToday(left));
        const rightScore = Number(isCriticalTicket(right)) * 3 + Number(isOperationalTicketLate(right)) * 2 + Number(isTicketDueToday(right));
        return rightScore - leftScore;
      })
      .slice(0, limit)
      .map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        subtitle: `${ticket.code || ticket.id.slice(0, 8)} · ${formatTicketStatusLabel(ticket.status || "")}`,
        meta: `Prazo ${ticket.due_at ? formatDate(ticket.due_at) : "nao informado"}`,
        badges: [
          ...(isCriticalTicket(ticket) ? [{ label: "Critico", tone: "destructive" as const }] : []),
          ...(isOperationalTicketLate(ticket) ? [{ label: "Atrasado", tone: "warning" as const }] : []),
          ...(isTicketDueToday(ticket) ? [{ label: "Vence hoje", tone: "accent" as const }] : []),
        ],
      })),
    helper: "Prioridades imediatas da operacao",
  };
}

function createOwnerDistribution(
  componentType: DashboardComponentConfig["type"],
  rows: Array<{ name: string; chamados: number }>,
): DashboardResolvedData {
  if (componentType === "table") {
    return {
      kind: "table",
      columns: [
        { key: "name", label: "Responsavel" },
        { key: "chamados", label: "Itens", align: "right" },
      ],
      rows: rows.map((row) => ({ name: row.name, chamados: row.chamados })),
      helper: "Distribuicao por responsavel",
    };
  }

  if (componentType === "list") {
    return {
      kind: "list",
      items: rows.map((row) => ({
        id: row.name,
        title: row.name,
        meta: `${row.chamados} itens`,
      })),
      helper: "Carga por responsavel",
    };
  }

  return {
    kind: "series",
    chartType: "bar",
    data: rows,
    helper: "Distribuicao da carga",
  };
}

function createBurndownDataset(
  componentType: DashboardComponentConfig["type"],
  rows: Array<{ day: string; ideal: number; real: number }>,
): DashboardResolvedData {
  if (componentType === "table") {
    return {
      kind: "table",
      columns: [
        { key: "day", label: "Dia" },
        { key: "ideal", label: "Planejado", align: "right" },
        { key: "real", label: "Realizado", align: "right" },
      ],
      rows,
      helper: "Curva acumulada da sprint",
    };
  }

  return {
    kind: "series",
    chartType: "line",
    data: rows,
    helper: "Planejado x realizado",
  };
}

function createCapacityDataset(
  componentType: DashboardComponentConfig["type"],
  rows: SprintCapacityRow[],
): DashboardResolvedData {
  if (componentType === "table") {
    return {
      kind: "table",
      columns: [
        { key: "name", label: "Pessoa" },
        { key: "role", label: "Funcao" },
        { key: "capacity", label: "Capacidade", align: "right" },
        { key: "utilized", label: "Utilizado", align: "right" },
        { key: "occupancy", label: "Ocupacao", align: "right" },
      ],
      rows: rows.map((row) => ({
        name: row.name,
        role: row.role,
        capacity: formatHoursLabel(row.capacity),
        utilized: formatHoursLabel(row.utilized),
        occupancy: `${row.occupancy}%`,
      })),
      helper: "Carga individual da sprint",
    };
  }

  if (componentType === "list") {
    return {
      kind: "list",
      items: rows.slice(0, 8).map((row) => ({
        id: row.key,
        title: row.name,
        subtitle: row.role,
        meta: `${formatHoursLabel(row.utilized)} de ${formatHoursLabel(row.capacity)} · ${row.occupancy}%`,
        badges: [{ label: resolveCapacityStatusLabel(row.status), tone: resolveCapacityTone(row.status) }],
      })),
      helper: "Capacidade por pessoa",
    };
  }

  return {
    kind: "series",
    chartType: "bar",
    data: rows.slice(0, 8).map((row) => ({
      name: shortenLabel(row.name),
      capacidade: row.capacity,
      utilizado: row.utilized,
    })),
    helper: "Capacidade e utilizacao",
  };
}

function createSprintAttentionList(rows: SprintDashboardItem[], limit: number): DashboardResolvedData {
  return {
    kind: "list",
    items: rows.slice(0, limit).map((item) => ({
      id: item.key,
      title: item.title,
      subtitle: `${item.code} · ${item.ownerName}`,
      meta: `Prazo ${item.dueAt ? formatDate(item.dueAt) : "nao informado"}`,
      badges: [
        ...(item.blocked ? [{ label: "Bloqueado", tone: "destructive" as const }] : []),
        ...(item.late ? [{ label: "Atrasado", tone: "warning" as const }] : []),
      ],
    })),
    helper: "Itens que pedem acompanhamento imediato",
  };
}

function createProjectDeliveries(
  componentType: DashboardComponentConfig["type"],
  rows: Project[],
  limit: number,
): DashboardResolvedData {
  const currentWeekRows = rows
    .filter((project) => isWithinCurrentWeek(project.due_at))
    .slice(0, limit);

  if (componentType === "kpi") {
    return createKpi(currentWeekRows.length, "Projetos com entrega nesta semana", "accent");
  }

  if (componentType === "table") {
    return {
      kind: "table",
      columns: [
        { key: "name", label: "Projeto" },
        { key: "due", label: "Entrega" },
        { key: "status", label: "Status" },
      ],
      rows: currentWeekRows.map((project) => ({
        name: project.name,
        due: formatDate(project.due_at),
        status: project.status || "Sem status",
      })),
      helper: "Entregas proximas",
    };
  }

  return {
    kind: "list",
    items: currentWeekRows.map((project) => ({
      id: project.id,
      title: project.name,
      subtitle: project.status || "Sem status",
      meta: `Entrega ${formatDate(project.due_at)}`,
    })),
    helper: "Compromissos da semana",
  };
}

function createActivityByProject(
  componentType: DashboardComponentConfig["type"],
  activities: Activity[],
  filters: DashboardFilterState,
  limit: number,
): DashboardResolvedData {
  const filtered = activities.filter((activity) => {
    if (filters.project && activity.project !== filters.project && activity.project_name !== filters.project) {
      return false;
    }
    return true;
  });

  const rows = countByLabel(filtered.map((activity) => activity.project_name || "Sem projeto")).slice(0, limit);

  return createSimpleBarOrTable(componentType, rows, "atividades");
}

function createUserCapacityDataset(
  componentType: DashboardComponentConfig["type"],
  users: User[],
  mode: "capacity" | "occupancy" | "used",
  limit: number,
): DashboardResolvedData {
  const rows = users
    .filter((user) => user.is_active !== false)
    .map((user) => {
      const capacity = Math.max(0, toNumber(user.total_hours, 40));
      const used = Math.max(0, toNumber(user.used_hours, 0));
      const occupancy = capacity > 0 ? Math.round((used / capacity) * 100) : 0;

      return {
        id: user.id,
        name: getUserDisplayName(user),
        role: user.technical_group || user.specialty || user.job_title || "Sem funcao",
        capacity,
        used,
        occupancy,
      };
    })
    .sort((left, right) => {
      if (mode === "capacity") return right.capacity - left.capacity;
      if (mode === "used") return right.used - left.used;
      return right.occupancy - left.occupancy;
    })
    .slice(0, limit);

  if (componentType === "table") {
    return {
      kind: "table",
      columns: [
        { key: "name", label: "Pessoa" },
        { key: "role", label: "Funcao" },
        { key: mode === "capacity" ? "capacity" : mode === "used" ? "used" : "occupancy", label: mode === "capacity" ? "Capacidade" : mode === "used" ? "Horas usadas" : "Ocupacao", align: "right" },
      ],
      rows: rows.map((row) => ({
        name: row.name,
        role: row.role,
        capacity: formatHoursLabel(row.capacity),
        used: formatHoursLabel(row.used),
        occupancy: `${row.occupancy}%`,
      })),
      helper: "Resumo da equipe",
    };
  }

  if (componentType === "list") {
    return {
      kind: "list",
      items: rows.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: row.role,
        meta:
          mode === "capacity"
            ? formatHoursLabel(row.capacity)
            : mode === "used"
              ? formatHoursLabel(row.used)
              : `${row.occupancy}%`,
      })),
      helper: "Resumo individual",
    };
  }

  return {
    kind: "series",
    chartType: "bar",
    data: rows.map((row) => ({
      name: shortenLabel(row.name),
      chamados: mode === "capacity" ? row.capacity : mode === "used" ? row.used : row.occupancy,
    })),
    helper: "Comparativo da equipe",
  };
}

function createRoleBottleneckDataset(
  componentType: DashboardComponentConfig["type"],
  rows: RoleBottleneck[],
): DashboardResolvedData {
  if (componentType === "table") {
    return {
      kind: "table",
      columns: [
        { key: "role", label: "Funcao" },
        { key: "occupancy", label: "Ocupacao", align: "right" },
        { key: "blockedCount", label: "Bloqueados", align: "right" },
        { key: "lateCount", label: "Atrasados", align: "right" },
      ],
      rows: rows.map((row) => ({
        role: row.role,
        occupancy: `${row.occupancy}%`,
        blockedCount: row.blockedCount,
        lateCount: row.lateCount,
      })),
      helper: "Restricoes por funcao",
    };
  }

  if (componentType === "list") {
    return {
      kind: "list",
      items: rows.map((row) => ({
        id: row.role,
        title: row.role,
        subtitle: `${row.people} pessoa(s)`,
        meta: `${row.occupancy}% · ${row.blockedCount} bloqueados · ${row.lateCount} atrasados`,
      })),
      helper: "Gargalos por funcao",
    };
  }

  if (componentType === "bar") {
    return {
      kind: "series",
      chartType: "bar",
      data: rows.map((row) => ({ name: row.role, chamados: row.occupancy })),
      helper: "Ocupacao por funcao",
    };
  }

  return {
    kind: "funnel",
    steps: rows.map((row) => ({
      label: row.role,
      value: row.occupancy,
      tone: row.occupancy >= 100 || row.lateCount > 0 ? "destructive" : row.occupancy >= 85 ? "warning" : "success",
    })),
    helper: "Funcoes em gargalo",
  };
}

function resolveSelectedSprint(sprints: SprintDashboardContext[], filters: DashboardFilterState) {
  const filteredByTeam = filters.team
    ? sprints.filter((sprint) => normalizeComparisonValue(sprint.team) === normalizeComparisonValue(filters.team))
    : sprints;

  if (filters.sprint) {
    return filteredByTeam.find((sprint) => sprint.sprint.id === filters.sprint || sprint.sprint.name === filters.sprint) || filteredByTeam[0] || null;
  }

  return filteredByTeam[0] || null;
}

function applyTicketFilters(rows: Ticket[], filters: DashboardFilterState) {
  return rows.filter((ticket) => {
    if (filters.team && normalizeComparisonValue(ticket.team) !== normalizeComparisonValue(filters.team)) {
      return false;
    }

    if (filters.sprint && ticket.sprint !== filters.sprint && ticket.sprint_name !== filters.sprint) {
      return false;
    }

    if (filters.project && ticket.project !== filters.project && ticket.project_name !== filters.project) {
      return false;
    }

    if (filters.responsible) {
      const matchesResponsible =
        ticket.responsible_technician === filters.responsible
        || normalizeComparisonValue(ticket.responsible_technician_name) === normalizeComparisonValue(filters.responsible)
        || (ticket.technicians || []).includes(filters.responsible)
        || (ticket.technician_names || []).some((name) => normalizeComparisonValue(name) === normalizeComparisonValue(filters.responsible));

      if (!matchesResponsible) {
        return false;
      }
    }

    if (filters.client) {
      const clientName = ticket.client_name || ticket.organization_name || "";
      if (
        normalizeComparisonValue(clientName) !== normalizeComparisonValue(filters.client)
        && ticket.client !== filters.client
        && ticket.organization_id !== filters.client
      ) {
        return false;
      }
    }

    if (filters.status && normalizeComparisonValue(formatTicketStatusLabel(ticket.status || "")) !== normalizeComparisonValue(filters.status)) {
      return false;
    }

    if (filters.priority && normalizeComparisonValue(formatPriorityLabel(ticket.priority || "")) !== normalizeComparisonValue(filters.priority)) {
      return false;
    }

    if (!matchesPeriod(filters.period, ticket.updated_at || ticket.opened_at || ticket.created_at)) {
      return false;
    }

    return true;
  });
}

function applyProjectFilters(rows: Project[], filters: DashboardFilterState) {
  return rows.filter((project) => {
    if (filters.project && project.id !== filters.project && project.name !== filters.project) {
      return false;
    }

    if (filters.client) {
      const clientName = project.client_name || project.organization_name || "";
      if (
        normalizeComparisonValue(clientName) !== normalizeComparisonValue(filters.client)
        && project.client !== filters.client
        && project.organization_id !== filters.client
      ) {
        return false;
      }
    }

    if (filters.status && normalizeComparisonValue(project.status) !== normalizeComparisonValue(filters.status)) {
      return false;
    }

    if (!matchesPeriod(filters.period, project.due_at || project.updated_at || project.created_at)) {
      return false;
    }

    return true;
  });
}

function applyUserFilters(rows: User[], filters: DashboardFilterState) {
  return rows.filter((user) => {
    if (filters.team) {
      const role = user.technical_group || user.specialty || user.job_title || "";
      if (normalizeComparisonValue(role) !== normalizeComparisonValue(filters.team)) {
        return false;
      }
    }

    if (filters.responsible && user.id !== filters.responsible && normalizeComparisonValue(getUserDisplayName(user)) !== normalizeComparisonValue(filters.responsible)) {
      return false;
    }

    return true;
  });
}

function matchesPeriod(period: string | undefined, value?: string | null) {
  if (!period || period === "all") {
    return true;
  }

  const date = getDateValue(value);
  if (!date) {
    return false;
  }

  const now = Date.now();
  const diffMs = now - date.getTime();

  if (period === "today") {
    return isSameLocalDay(date, new Date());
  }

  if (period === "7d") {
    return diffMs <= 7 * 86400000;
  }

  if (period === "30d") {
    return diffMs <= 30 * 86400000;
  }

  if (period === "90d") {
    return diffMs <= 90 * 86400000;
  }

  return true;
}

function uniqueOptions(...sources: string[][]): DashboardOption[] {
  const values = sources
    .flat()
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return Array.from(new Set(values))
    .sort((left, right) => left.localeCompare(right, "pt-BR"))
    .map((value) => ({ value, label: value }));
}

function countByLabel(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const label = value || "Sem informacao";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, "pt-BR"));
}

function resolveToneFromColor(color: string): DashboardTone {
  if (color.includes("155")) return "success";
  if (color.includes("85")) return "warning";
  if (color.includes("25")) return "destructive";
  if (color.includes("210")) return "accent";
  return "primary";
}

function resolveCapacityStatusLabel(status: SprintCapacityRow["status"]) {
  if (status === "overloaded") return "Sobrecarregado";
  if (status === "attention") return "Atencao";
  if (status === "balanced") return "Saudavel";
  return "Disponivel";
}

function resolveCapacityTone(status: SprintCapacityRow["status"]): DashboardTone {
  if (status === "overloaded") return "destructive";
  if (status === "attention") return "warning";
  if (status === "balanced") return "success";
  return "accent";
}

function getUserDisplayName(user?: Partial<User> | null, fallback = "Colaborador") {
  return (
    user?.name
    || [user?.first_name, user?.last_name].filter(Boolean).join(" ")
    || user?.username
    || user?.email
    || fallback
  );
}

function resolveUserRole(user?: User | null) {
  return user?.technical_group || user?.specialty || user?.job_title || "";
}

function shortenLabel(value: string) {
  const parts = value.split(" ").filter(Boolean);
  if (parts.length <= 1) {
    return value;
  }

  return `${parts[0]} ${parts[1][0]}.`;
}

function isOperationalTicketOpen(ticket: Ticket) {
  const normalizedStatus = normalizeComparisonValue(ticket.status);
  return !isFinalTicketStatus(ticket.status) && normalizedStatus !== "cancelado";
}

function isCriticalTicket(ticket: Ticket) {
  return normalizeComparisonValue(ticket.priority) === "critica";
}

function isOperationalTicketLate(ticket: Ticket) {
  return isOperationalTicketOpen(ticket) && isDateBeforeNow(ticket.due_at);
}

function isTicketDueToday(ticket: Ticket) {
  return isOperationalTicketOpen(ticket) && isSameLocalDay(ticket.due_at, new Date());
}

function isTicketInProgress(ticket: Ticket) {
  return normalizeComparisonValue(ticket.status) === "em atendimento";
}

function isTicketWaitingCustomer(ticket: Ticket) {
  return normalizeComparisonValue(ticket.status) === "aguardando cliente";
}

function isTicketUnassigned(ticket: Ticket) {
  if (!isOperationalTicketOpen(ticket)) {
    return false;
  }

  const hasPrimaryOwner = Boolean(String(ticket.responsible_technician || "").trim());
  const hasTechnicians = Array.isArray(ticket.technicians) && ticket.technicians.some((value) => Boolean(String(value || "").trim()));
  const hasOwnerName = Boolean(String(ticket.responsible_technician_name || "").trim());
  const hasTechnicianNames = Array.isArray(ticket.technician_names) && ticket.technician_names.some((value) => Boolean(String(value || "").trim()));

  return !(hasPrimaryOwner || hasTechnicians || hasOwnerName || hasTechnicianNames);
}

function isTicketClosedToday(ticket: Ticket) {
  const closedAt = ticket.finished_at || (isFinalTicketStatus(ticket.status) ? ticket.updated_at : "");
  return isFinalTicketStatus(ticket.status) && isSameLocalDay(closedAt, new Date());
}

function isWithinCurrentWeek(value?: string | null) {
  const date = getDateValue(value);
  if (!date) {
    return false;
  }

  const today = startOfLocalDay(new Date());
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const normalizedDate = startOfLocalDay(date);

  return normalizedDate.getTime() >= start.getTime() && normalizedDate.getTime() <= end.getTime();
}

function normalizeComparisonValue(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s/_-]+/g, " ");
}

function getDateValue(value?: string | number | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getLocalDayKey(value?: string | number | Date | null) {
  const date = getDateValue(value);
  if (!date) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameLocalDay(value?: string | number | Date | null, reference?: string | number | Date | null) {
  const left = getLocalDayKey(value);
  const right = getLocalDayKey(reference);
  return Boolean(left && right && left === right);
}

function isDateBeforeNow(value?: string | number | Date | null) {
  const date = getDateValue(value);
  return Boolean(date && date.getTime() < Date.now());
}

function isDateBeforeToday(value?: string | number | Date | null) {
  const date = getDateValue(value);
  if (!date) {
    return false;
  }

  return startOfLocalDay(date).getTime() < startOfLocalDay(new Date()).getTime();
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function uniqueValues(...values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function pickSoonerDate(current?: string | null, next?: string | null) {
  const currentDate = getDateValue(current);
  const nextDate = getDateValue(next);

  if (!currentDate) {
    return next || current || "";
  }

  if (!nextDate) {
    return current || "";
  }

  return currentDate.getTime() <= nextDate.getTime() ? current || "" : next || "";
}

function buildSprintDashboardContexts(context: DashboardDataContext): SprintDashboardContext[] {
  const usersById = new Map(context.users.map((user) => [user.id, user]));
  const activitiesById = new Map(context.activities.map((activity) => [activity.id, activity]));
  const ticketsById = new Map(context.tickets.map((ticket) => [ticket.id, ticket]));
  const ticketsByCode = new Map(
    context.tickets
      .filter((ticket) => ticket.code)
      .map((ticket) => [ticket.code as string, ticket]),
  );
  const plansBySprintId = groupBy(context.sprintPlans, (plan) => plan.sprintId);
  const timeEntriesBySprintId = groupBy(context.timeEntries, (entry) => entry.sprintId || "");

  return context.sprints
    .slice()
    .sort(compareSprintsForDashboard)
    .map((sprint) => {
      const relatedPlans = plansBySprintId.get(sprint.id) || [];
      const sprintTimeEntries = timeEntriesBySprintId.get(sprint.id) || [];
      const realizedHoursByActivityId = new Map<string, number>();

      sprintTimeEntries.forEach((entry) => {
        realizedHoursByActivityId.set(
          entry.activityId,
          roundNumber((realizedHoursByActivityId.get(entry.activityId) ?? 0) + toNumber(entry.hours, 0)),
        );
      });

      const itemsMap = new Map<string, SprintDashboardItem>();

      context.tickets
        .filter((ticket) => matchesSprint(ticket.sprint, ticket.sprint_name, sprint))
        .forEach((ticket) => {
          mergeTicketIntoSprintItems(itemsMap, ticket);
        });

      context.activities
        .filter((activity) => matchesSprint(activity.sprint, activity.sprint_name, sprint))
        .forEach((activity) => {
          mergeActivityIntoSprintItems(itemsMap, activity, usersById, realizedHoursByActivityId);
        });

      buildSprintBacklogItems(sprint.backlog, context.tickets, context.activities).forEach((backlogItem) => {
        if (backlogItem.item_type === "ticket") {
          const ticket = ticketsById.get(backlogItem.item_id) || ticketsByCode.get(backlogItem.item_id);
          if (ticket) {
            mergeTicketIntoSprintItems(itemsMap, ticket);
            return;
          }

          mergeUnknownBacklogItem(itemsMap, backlogItem);
          return;
        }

        const activity = activitiesById.get(backlogItem.item_id);
        if (activity) {
          mergeActivityIntoSprintItems(itemsMap, activity, usersById, realizedHoursByActivityId);
          return;
        }

        mergeUnknownBacklogItem(itemsMap, backlogItem);
      });

      relatedPlans.forEach((plan) => {
        const activity = activitiesById.get(plan.activityId);
        mergePlanIntoSprintItems(itemsMap, plan, activity, usersById, realizedHoursByActivityId);
      });

      const draftItems = [...itemsMap.values()];
      const team = resolveSprintTeamLabel({
        sprint,
        items: draftItems,
        plans: relatedPlans,
        usersById,
      });
      const items = draftItems
        .map((item) => finalizeSprintItem(item, sprint, team))
        .sort((left, right) => {
          const leftScore = Number(left.blocked) * 3 + Number(left.late) * 2 + Number(!left.completed);
          const rightScore = Number(right.blocked) * 3 + Number(right.late) * 2 + Number(!right.completed);

          if (rightScore !== leftScore) {
            return rightScore - leftScore;
          }

          return left.title.localeCompare(right.title, "pt-BR");
        });

      const capacityRows = buildSprintCapacityRows({
        sprint,
        items,
        plans: relatedPlans,
        timeEntries: sprintTimeEntries,
        usersById,
        activitiesById,
      });
      const bottlenecks = buildRoleBottlenecks(capacityRows);
      const attentionItems = items.filter((item) => item.blocked || item.late).slice(0, 6);
      const totalItems = items.length;
      const completed = items.filter((item) => item.completed).length;
      const blocked = items.filter((item) => item.blocked).length;
      const late = items.filter((item) => item.late).length;
      const notStarted = items.filter((item) => item.phase === "not_started").length;
      const inProgress = items.filter((item) => item.phase === "in_progress").length;
      const progress = totalItems ? Math.round((completed / totalItems) * 100) : 0;

      return {
        sprint,
        team,
        isActive: isSprintActive(sprint),
        items,
        metrics: {
          totalItems,
          completed,
          inProgress,
          notStarted,
          blocked,
          late,
          progress,
          daysRemaining: getSprintDaysRemaining(sprint),
          daysRemainingLabel: formatDaysRemainingLabel(getSprintDaysRemaining(sprint)),
        },
        statusData: buildStatusDistribution(items.map((item) => ({ status: item.statusLabel }))),
        ownerDistribution: buildOwnerDistribution(items),
        progressData: buildSprintProgressData(sprint, relatedPlans, sprintTimeEntries),
        capacityRows,
        bottlenecks,
        attentionItems,
      };
    });
}

function mergeTicketIntoSprintItems(map: Map<string, SprintDashboardItem>, ticket: Ticket) {
  const key = `ticket:${ticket.id}`;
  const item = map.get(key) || createBaseSprintItem(key, ticket.id, "ticket");

  const ownerNames = uniqueValues(
    ticket.responsible_technician_name,
    ...(ticket.technician_names || []),
  );
  const ownerIds = uniqueValues(
    ticket.responsible_technician || undefined,
    ...(ticket.technicians || []),
  );

  item.code = ticket.code || item.code;
  item.title = ticket.title || item.title;
  item.status = ticket.status || item.status;
  item.statusLabel = formatTicketStatusLabel(ticket.status || item.status);
  item.ownerIds = uniqueValues(...item.ownerIds, ...ownerIds);
  item.ownerNames = uniqueValues(...item.ownerNames, ...ownerNames);
  item.ownerName = item.ownerNames[0] || "Sem responsavel";
  item.teamLabel = ticket.team || item.teamLabel;
  item.dueAt = ticket.due_at || item.dueAt;

  map.set(key, item);
}

function mergeActivityIntoSprintItems(
  map: Map<string, SprintDashboardItem>,
  activity: Activity,
  usersById: Map<string, User>,
  realizedHoursByActivityId: Map<string, number>,
) {
  const key = `activity:${activity.id}`;
  const item = map.get(key) || createBaseSprintItem(key, activity.id, "activity");
  const ownerIds = uniqueValues(activity.assignee || undefined);
  const ownerNames = uniqueValues(
    activity.assignee_name || undefined,
    ...ownerIds.map((id) => getUserDisplayName(usersById.get(id), "")),
  );
  const ownerRole = ownerIds.length
    ? resolveUserRole(usersById.get(ownerIds[0]))
    : item.ownerRole;

  item.code = activity.id.slice(0, 8);
  item.title = activity.title || item.title;
  item.status = activity.status || item.status;
  item.statusLabel = formatActivityStatusLabel(activity.status || item.status);
  item.ownerIds = uniqueValues(...item.ownerIds, ...ownerIds);
  item.ownerNames = uniqueValues(...item.ownerNames, ...ownerNames);
  item.ownerName = item.ownerNames[0] || "Sem responsavel";
  item.ownerRole = ownerRole || item.ownerRole;
  item.teamLabel = item.teamLabel || ownerRole;
  item.dueAt = activity.due_at || item.dueAt;
  item.storyPoints = Math.max(item.storyPoints, toNumber(activity.story_points, 0));
  item.realizedHours = Math.max(item.realizedHours, realizedHoursByActivityId.get(activity.id) ?? 0);

  map.set(key, item);
}

function mergeUnknownBacklogItem(
  map: Map<string, SprintDashboardItem>,
  backlogItem: ReturnType<typeof buildSprintBacklogItems>[number],
) {
  const key = `${backlogItem.item_type}:${backlogItem.item_id}`;
  const item = map.get(key) || createBaseSprintItem(key, backlogItem.item_id, backlogItem.item_type);

  item.code = backlogItem.code || item.code;
  item.title = backlogItem.title || item.title;
  item.status = backlogItem.status || item.status;
  item.statusLabel = formatActivityStatusLabel(backlogItem.status || item.status);

  map.set(key, item);
}

function mergePlanIntoSprintItems(
  map: Map<string, SprintDashboardItem>,
  plan: SprintActivityPlan,
  activity: Activity | undefined,
  usersById: Map<string, User>,
  realizedHoursByActivityId: Map<string, number>,
) {
  const key = `activity:${plan.activityId}`;
  const item = map.get(key) || createBaseSprintItem(key, plan.activityId, "activity");
  const ownerIds = plan.responsibleIds || [];
  const ownerNames = ownerIds.map((id) => getUserDisplayName(usersById.get(id), ""));

  item.code = activity?.id.slice(0, 8) || item.code;
  item.title = activity?.title || item.title;
  item.status = activity?.status || item.status;
  item.statusLabel = formatActivityStatusLabel(activity?.status || item.status);
  item.ownerIds = uniqueValues(...item.ownerIds, ...ownerIds);
  item.ownerNames = uniqueValues(...item.ownerNames, ...ownerNames);
  item.ownerName = item.ownerNames[0] || item.ownerName;
  item.ownerRole = item.ownerRole || (ownerIds[0] ? resolveUserRole(usersById.get(ownerIds[0])) : item.ownerRole);
  item.teamLabel = item.teamLabel || item.ownerRole;
  item.dueAt = activity?.due_at || item.dueAt;
  item.plannedStartDate = pickSoonerDate(item.plannedStartDate, plan.plannedStartDate || "");
  item.plannedEndDate = pickSoonerDate(item.plannedEndDate, plan.plannedEndDate || "");
  item.plannedHours = roundNumber(item.plannedHours + Math.max(0, toNumber(plan.plannedHours, 0)));
  item.realizedHours = Math.max(item.realizedHours, realizedHoursByActivityId.get(plan.activityId) ?? 0);
  item.storyPoints = roundNumber(item.storyPoints + Math.max(0, toNumber(plan.storyPoints, 0)));

  map.set(key, item);
}

function finalizeSprintItem(item: SprintDashboardItem, sprint: Sprint, team: string): SprintDashboardItem {
  const statusLabel = formatActivityStatusLabel(item.status);
  const completed = isWorkItemCompleted(item.status);
  const blocked = isBlockedStatus(item.status);
  const phase = completed
    ? "completed"
    : blocked
      ? "blocked"
      : isNotStartedStatus(item.status)
        ? "not_started"
        : "in_progress";
  const deadline = resolveSprintItemDeadline(item, sprint);
  const late = !completed && isDateBeforeToday(deadline);

  return {
    ...item,
    statusLabel,
    ownerName: item.ownerNames[0] || item.ownerName || "Sem responsavel",
    ownerRole: item.ownerRole || "Sem funcao",
    teamLabel: item.teamLabel || team,
    completed,
    blocked,
    late,
    phase,
  };
}

function buildOwnerDistribution(items: SprintDashboardItem[]) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const owner = item.ownerName || "Sem responsavel";
    counts.set(owner, (counts.get(owner) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"))
    .slice(0, 8)
    .map(([name, chamados]) => ({
      name: shortenLabel(name),
      chamados,
    }));
}

function buildSprintProgressData(
  sprint: Sprint,
  plans: SprintActivityPlan[],
  timeEntries: ActivityTimeEntry[],
) {
  const plannedHoursByDay = new Map<string, number>();
  const realizedHoursByDay = new Map<string, number>();
  const dayKeys = buildSprintDayRange(sprint, plans, timeEntries);

  plans.forEach((plan) => {
    const key =
      getLocalDayKey(plan.plannedEndDate) ||
      getLocalDayKey(sprint.end_at) ||
      dayKeys[dayKeys.length - 1] ||
      getLocalDayKey(new Date());

    if (!key) return;

    plannedHoursByDay.set(
      key,
      roundNumber((plannedHoursByDay.get(key) ?? 0) + Math.max(0, toNumber(plan.plannedHours, 0))),
    );
  });

  timeEntries.forEach((entry) => {
    const key = getLocalDayKey(entry.date);
    if (!key) return;

    realizedHoursByDay.set(
      key,
      roundNumber((realizedHoursByDay.get(key) ?? 0) + Math.max(0, toNumber(entry.hours, 0))),
    );
  });

  let accumulatedPlanned = 0;
  let accumulatedReal = 0;

  return dayKeys.map((key) => {
    accumulatedPlanned = roundNumber(accumulatedPlanned + (plannedHoursByDay.get(key) ?? 0));
    accumulatedReal = roundNumber(accumulatedReal + (realizedHoursByDay.get(key) ?? 0));

    return {
      day: formatChartDay(key),
      ideal: accumulatedPlanned,
      real: accumulatedReal,
    };
  });
}

function buildSprintCapacityRows(args: {
  sprint: Sprint;
  items: SprintDashboardItem[];
  plans: SprintActivityPlan[];
  timeEntries: ActivityTimeEntry[];
  usersById: Map<string, User>;
  activitiesById: Map<string, Activity>;
}) {
  const rows = new Map<string, SprintCapacityRow>();
  const itemsByActivityId = new Map(
    args.items
      .filter((item) => item.type === "activity")
      .map((item) => [item.id, item]),
  );

  args.plans.forEach((plan) => {
    const linkedItem = itemsByActivityId.get(plan.activityId);
    const ownerIds = plan.responsibleIds?.length
      ? plan.responsibleIds
      : linkedItem?.ownerIds?.length
        ? linkedItem.ownerIds
        : [];

    if (!ownerIds.length) {
      return;
    }

    const plannedShare = Math.max(0, toNumber(plan.plannedHours, 0)) / ownerIds.length;

    ownerIds.forEach((ownerId) => {
      const row = ensureCapacityRow(rows, args.usersById, ownerId, undefined, linkedItem?.ownerRole);
      row.utilized = roundNumber(row.utilized + plannedShare);
      row.itemCount += 1;
      row.blockedCount += linkedItem?.blocked ? 1 : 0;
      row.lateCount += linkedItem?.late ? 1 : 0;
    });
  });

  args.items
    .filter((item) => item.type === "activity" && item.ownerIds.length)
    .forEach((item) => {
      const hasPlan = args.plans.some((plan) => plan.activityId === item.id);
      if (hasPlan) {
        return;
      }

      item.ownerIds.forEach((ownerId) => {
        const row = ensureCapacityRow(rows, args.usersById, ownerId, item.ownerName, item.ownerRole);
        row.itemCount += 1;
        row.blockedCount += item.blocked ? 1 : 0;
        row.lateCount += item.late ? 1 : 0;
      });
    });

  args.timeEntries.forEach((entry) => {
    const activity = args.activitiesById.get(entry.activityId);
    const linkedItem = activity ? itemsByActivityId.get(activity.id) : null;
    const row = ensureCapacityRow(
      rows,
      args.usersById,
      entry.collaboratorId,
      entry.collaboratorName,
      linkedItem?.ownerRole,
    );

    row.realized = roundNumber(row.realized + Math.max(0, toNumber(entry.hours, 0)));
  });

  return [...rows.values()]
    .map((row) => ({
      ...row,
      occupancy: row.capacity > 0 ? Math.round((row.utilized / row.capacity) * 100) : 0,
      status: resolveCapacityStatus(row.capacity, row.utilized, row.blockedCount, row.lateCount),
    }))
    .sort((left, right) => {
      if (right.occupancy !== left.occupancy) {
        return right.occupancy - left.occupancy;
      }

      return right.itemCount - left.itemCount || left.name.localeCompare(right.name, "pt-BR");
    });
}

function buildRoleBottlenecks(rows: SprintCapacityRow[]) {
  const roles = new Map<string, RoleBottleneck>();

  rows.forEach((row) => {
    const role = row.role || "Sem funcao";
    const current = roles.get(role) || {
      role,
      capacity: 0,
      utilized: 0,
      occupancy: 0,
      people: 0,
      blockedCount: 0,
      lateCount: 0,
    };

    current.capacity = roundNumber(current.capacity + row.capacity);
    current.utilized = roundNumber(current.utilized + row.utilized);
    current.people += 1;
    current.blockedCount += row.blockedCount;
    current.lateCount += row.lateCount;
    current.occupancy = current.capacity > 0 ? Math.round((current.utilized / current.capacity) * 100) : 0;

    roles.set(role, current);
  });

  return [...roles.values()]
    .filter((role) => role.capacity > 0 || role.utilized > 0)
    .sort((left, right) => {
      const leftScore = left.occupancy + left.blockedCount * 12 + left.lateCount * 16;
      const rightScore = right.occupancy + right.blockedCount * 12 + right.lateCount * 16;
      return rightScore - leftScore;
    })
    .slice(0, 4);
}

function ensureCapacityRow(
  map: Map<string, SprintCapacityRow>,
  usersById: Map<string, User>,
  ownerId?: string | null,
  fallbackName?: string,
  fallbackRole?: string,
) {
  const safeOwnerId = String(ownerId || "").trim();
  const user = safeOwnerId ? usersById.get(safeOwnerId) : undefined;
  const displayName = fallbackName || getUserDisplayName(user);
  const key = safeOwnerId ? `user:${safeOwnerId}` : `name:${normalizeComparisonValue(displayName)}`;
  const existing = map.get(key);

  if (existing) {
    return existing;
  }

  const row: SprintCapacityRow = {
    key,
    name: displayName || "Colaborador",
    role: fallbackRole || resolveUserRole(user) || "Sem funcao",
    capacity: Math.max(0, toNumber(user?.total_hours, 40)),
    utilized: 0,
    realized: 0,
    occupancy: 0,
    status: "available",
    itemCount: 0,
    blockedCount: 0,
    lateCount: 0,
  };

  map.set(key, row);
  return row;
}

function createBaseSprintItem(key: string, id: string, type: "ticket" | "activity"): SprintDashboardItem {
  return {
    key,
    id,
    type,
    code: id.slice(0, 8),
    title: id,
    status: type === "ticket" ? "Aberto" : "Backlog",
    statusLabel: type === "ticket" ? "Aberto" : "Backlog",
    ownerIds: [],
    ownerNames: [],
    ownerName: "Sem responsavel",
    ownerRole: "",
    teamLabel: "",
    plannedHours: 0,
    realizedHours: 0,
    storyPoints: 0,
    completed: false,
    blocked: false,
    late: false,
    phase: "not_started",
  };
}

function resolveSprintTeamLabel(args: {
  sprint: Sprint;
  items: SprintDashboardItem[];
  plans: SprintActivityPlan[];
  usersById: Map<string, User>;
}) {
  const candidates = new Map<string, number>();

  function addCandidate(label?: string | null, weight = 1) {
    const cleaned = String(label || "").trim();
    if (!cleaned) return;
    candidates.set(cleaned, (candidates.get(cleaned) ?? 0) + weight);
  }

  const sprintLeadRole = resolveUserRole(args.usersById.get(args.sprint.lead || ""));
  addCandidate(sprintLeadRole, 3);

  args.items.forEach((item) => {
    addCandidate(item.teamLabel, item.type === "ticket" && item.teamLabel ? 2 : 1);
    addCandidate(item.ownerRole, 1);
  });

  args.plans.forEach((plan) => {
    (plan.responsibleIds || []).forEach((ownerId) => {
      addCandidate(resolveUserRole(args.usersById.get(ownerId)), 2);
    });
  });

  if (!candidates.size) {
    return args.sprint.project_name || "Sem equipe definida";
  }

  return [...candidates.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"))[0][0];
}

function compareSprintsForDashboard(left: Sprint, right: Sprint) {
  const leftActive = Number(isSprintActive(left));
  const rightActive = Number(isSprintActive(right));

  if (rightActive !== leftActive) {
    return rightActive - leftActive;
  }

  const leftEnd = getDateValue(left.end_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightEnd = getDateValue(right.end_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;

  if (leftEnd !== rightEnd) {
    return leftEnd - rightEnd;
  }

  const leftStart = getDateValue(left.start_at || left.created_at)?.getTime() ?? 0;
  const rightStart = getDateValue(right.start_at || right.created_at)?.getTime() ?? 0;

  return rightStart - leftStart;
}

function isSprintActive(sprint: Sprint) {
  const normalizedStatus = normalizeComparisonValue(sprint.status);
  if (["ativa", "em andamento", "aberta"].includes(normalizedStatus)) {
    return true;
  }

  const now = Date.now();
  const start = getDateValue(sprint.start_at)?.getTime();
  const end = getDateValue(sprint.end_at)?.getTime();

  if (start == null || end == null) {
    return false;
  }

  return now >= start && now <= end;
}

function getSprintDaysRemaining(sprint: Sprint) {
  const endDate = getDateValue(sprint.end_at);
  if (!endDate) {
    return null;
  }

  const today = startOfLocalDay(new Date());
  const end = startOfLocalDay(endDate);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

function formatDaysRemainingLabel(daysRemaining: number | null) {
  if (daysRemaining == null) {
    return "Sem prazo";
  }

  if (daysRemaining < 0) {
    return `Encerrada ha ${Math.abs(daysRemaining)}d`;
  }

  if (daysRemaining === 0) {
    return "Encerra hoje";
  }

  return `${daysRemaining}d restantes`;
}

function resolveSprintItemDeadline(item: SprintDashboardItem, sprint: Sprint) {
  return item.plannedEndDate || item.dueAt || sprint.end_at || "";
}

function resolveCapacityStatus(capacity: number, utilized: number, blockedCount: number, lateCount: number) {
  const occupancy = capacity > 0 ? (utilized / capacity) * 100 : 0;

  if (occupancy >= 100 || lateCount > 0 || blockedCount >= 2) {
    return "overloaded" as const;
  }

  if (occupancy >= 85 || blockedCount > 0) {
    return "attention" as const;
  }

  if (occupancy >= 45 || utilized > 0) {
    return "balanced" as const;
  }

  return "available" as const;
}

function matchesSprint(itemSprintId?: string | null, itemSprintName?: string | null, sprint?: Sprint) {
  if (!sprint) return false;

  return itemSprintId === sprint.id || itemSprintName === sprint.name;
}

function groupBy<T>(rows: T[], resolveKey: (row: T) => string) {
  const grouped = new Map<string, T[]>();

  rows.forEach((row) => {
    const key = resolveKey(row);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)!.push(row);
  });

  return grouped;
}

function isWorkItemCompleted(status?: string | null) {
  const normalized = normalizeComparisonValue(status);
  return ["finalizado", "concluido", "done", "completed"].includes(normalized);
}

function isBlockedStatus(status?: string | null) {
  const normalized = normalizeComparisonValue(status);
  return ["bloqueado", "pausado", "impedido"].includes(normalized);
}

function isNotStartedStatus(status?: string | null) {
  const normalized = normalizeComparisonValue(status);
  return ["aberto", "backlog", "a fazer", "aguardando atendimento", "triagem", "planejada", "planejado", "nao iniciado"].includes(normalized);
}

function buildSprintDayRange(
  sprint: Sprint,
  plans: SprintActivityPlan[],
  timeEntries: ActivityTimeEntry[],
) {
  const dayKeys = new Set<string>();
  const startKey = getLocalDayKey(sprint.start_at);
  const endKey = getLocalDayKey(sprint.end_at);

  if (startKey && endKey) {
    let current = parseLocalDayKey(startKey);
    const finish = parseLocalDayKey(endKey);

    while (current && finish && current.getTime() <= finish.getTime()) {
      dayKeys.add(getLocalDayKey(current));
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
    }
  }

  plans.forEach((plan) => {
    const start = getLocalDayKey(plan.plannedStartDate);
    const end = getLocalDayKey(plan.plannedEndDate);
    if (start) dayKeys.add(start);
    if (end) dayKeys.add(end);
  });

  timeEntries.forEach((entry) => {
    const key = getLocalDayKey(entry.date);
    if (key) dayKeys.add(key);
  });

  if (!dayKeys.size) {
    dayKeys.add(getLocalDayKey(new Date()));
  }

  return [...dayKeys].sort((left, right) => left.localeCompare(right));
}

function parseLocalDayKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatChartDay(dayKey: string) {
  const date = parseLocalDayKey(dayKey);
  if (!date) {
    return dayKey;
  }

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
