export const DASHBOARD_VIEW_TYPES = [
  "operational",
  "sprint",
  "projects",
  "financial",
  "custom",
] as const;

export const DASHBOARD_STATUS_OPTIONS = ["draft", "active", "inactive"] as const;

export const DASHBOARD_COMPONENT_TYPES = [
  "kpi",
  "line",
  "bar",
  "donut",
  "table",
  "list",
  "funnel",
  "progress",
  "text",
  "section",
  "separator",
  "formula",
] as const;

export const DASHBOARD_FILTER_KEYS = [
  "period",
  "team",
  "sprint",
  "project",
  "responsible",
  "client",
  "status",
  "priority",
] as const;

export const DASHBOARD_TONE_OPTIONS = [
  "primary",
  "accent",
  "success",
  "warning",
  "destructive",
  "neutral",
] as const;

export const DASHBOARD_DATA_SOURCES = [
  "tickets_open",
  "tickets_critical",
  "tickets_late",
  "tickets_due_today",
  "tickets_in_progress",
  "tickets_waiting_customer",
  "tickets_unassigned",
  "tickets_closed_today",
  "tickets_by_status",
  "tickets_by_owner",
  "tickets_by_priority",
  "tickets_by_client",
  "tickets_trend",
  "tickets_attention_list",
  "sprints_active",
  "sprint_items_total",
  "sprint_items_completed",
  "sprint_items_in_progress",
  "sprint_items_not_started",
  "sprint_items_blocked",
  "sprint_items_late",
  "sprint_days_remaining",
  "sprint_progress",
  "sprint_status_distribution",
  "sprint_owner_distribution",
  "sprint_burndown",
  "sprint_capacity_people",
  "sprint_attention_items",
  "projects_active",
  "projects_late",
  "projects_by_status",
  "projects_deliveries_week",
  "project_activity_distribution",
  "users_active",
  "users_capacity_people",
  "users_occupancy_people",
  "users_hours_used_people",
  "users_bottlenecks_role",
] as const;

export type DashboardViewType = (typeof DASHBOARD_VIEW_TYPES)[number];
export type DashboardStatus = (typeof DASHBOARD_STATUS_OPTIONS)[number];
export type DashboardComponentType = (typeof DASHBOARD_COMPONENT_TYPES)[number];
export type DashboardFilterKey = (typeof DASHBOARD_FILTER_KEYS)[number];
export type DashboardTone = (typeof DASHBOARD_TONE_OPTIONS)[number];
export type DashboardDataSourceKey = (typeof DASHBOARD_DATA_SOURCES)[number];

export type DashboardLayout = {
  order: number;
  colSpan: number;
  minHeight: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DashboardComponentConfig = {
  id: string;
  type: DashboardComponentType;
  title: string;
  subtitle?: string;
  icon?: string;
  tone?: DashboardTone;
  dataSource: DashboardDataSourceKey;
  valueField?: string;
  groupBy?: string;
  dateField?: string;
  limit?: number;
  sortBy?: string;
  layout: DashboardLayout;
  useGlobalFilters: boolean;
  filters?: Partial<Record<DashboardFilterKey, string>>;
  configJson?: Record<string, unknown>;
  isVisible: boolean;
};

export type DashboardFilterDefinition = {
  id: string;
  type: DashboardFilterKey;
  label: string;
  field: string;
  defaultValue?: string;
  configJson?: Record<string, unknown>;
  enabled: boolean;
};

export type DashboardVersion = {
  id: string;
  dashboardId: string;
  versionNumber: number;
  configSnapshot: {
    components: DashboardComponentConfig[];
    filters: DashboardFilterDefinition[];
    name: string;
    description?: string;
  };
  createdBy?: string;
  createdAt: string;
  isPublished: boolean;
};

export type DashboardDefinition = {
  id: string;
  name: string;
  description?: string;
  type: DashboardViewType;
  status: DashboardStatus;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  components: DashboardComponentConfig[];
  filters: DashboardFilterDefinition[];
  versions: DashboardVersion[];
};

export type DashboardComponentTemplate = {
  type: DashboardComponentType;
  label: string;
  description: string;
  icon: string;
  defaultDataSource: DashboardDataSourceKey;
  defaultTitle: string;
  defaultSubtitle?: string;
  defaultColSpan: number;
  defaultHeight: number;
};

export type DashboardSourceCatalogItem = {
  key: DashboardDataSourceKey;
  label: string;
  description: string;
  category: "tickets" | "sprint" | "projects" | "users";
  defaultComponentType: DashboardComponentType;
  supportedTypes: DashboardComponentType[];
  defaultTitle: string;
  defaultSubtitle?: string;
  icon: string;
  tone: DashboardTone;
};

export type DashboardFilterState = Partial<Record<DashboardFilterKey, string>>;

export const DASHBOARD_COMPONENT_TEMPLATES: DashboardComponentTemplate[] = [
  {
    type: "kpi",
    label: "Card / KPI",
    description: "Mostra um numero principal com contexto rapido.",
    icon: "gauge",
    defaultDataSource: "tickets_open",
    defaultTitle: "Novo KPI",
    defaultSubtitle: "Acompanhe um indicador-chave",
    defaultColSpan: 3,
    defaultHeight: 188,
  },
  {
    type: "line",
    label: "Grafico de linha",
    description: "Ideal para tendencia temporal e comparacoes acumuladas.",
    icon: "line-chart",
    defaultDataSource: "tickets_trend",
    defaultTitle: "Tendencia",
    defaultSubtitle: "Serie temporal",
    defaultColSpan: 6,
    defaultHeight: 330,
  },
  {
    type: "bar",
    label: "Grafico de barra",
    description: "Compara volumes por categoria ou responsavel.",
    icon: "bar-chart-3",
    defaultDataSource: "tickets_by_owner",
    defaultTitle: "Comparativo",
    defaultSubtitle: "Distribuicao por categoria",
    defaultColSpan: 6,
    defaultHeight: 330,
  },
  {
    type: "donut",
    label: "Grafico de pizza / donut",
    description: "Distribui participacao percentual por grupo.",
    icon: "pie-chart",
    defaultDataSource: "tickets_by_status",
    defaultTitle: "Distribuicao",
    defaultSubtitle: "Participacao atual",
    defaultColSpan: 5,
    defaultHeight: 330,
  },
  {
    type: "table",
    label: "Tabela",
    description: "Lista estruturada com multiplas colunas e detalhes.",
    icon: "table",
    defaultDataSource: "sprint_capacity_people",
    defaultTitle: "Tabela",
    defaultSubtitle: "Dados tabulares",
    defaultColSpan: 8,
    defaultHeight: 360,
  },
  {
    type: "list",
    label: "Lista",
    description: "Itens com badges, prazos e resumo textual.",
    icon: "list",
    defaultDataSource: "tickets_attention_list",
    defaultTitle: "Lista",
    defaultSubtitle: "Itens recentes ou prioritarios",
    defaultColSpan: 4,
    defaultHeight: 360,
  },
  {
    type: "funnel",
    label: "Funil",
    description: "Mostra queda de volume entre estagios.",
    icon: "funnel",
    defaultDataSource: "tickets_by_status",
    defaultTitle: "Funil",
    defaultSubtitle: "Fluxo entre etapas",
    defaultColSpan: 5,
    defaultHeight: 320,
  },
  {
    type: "progress",
    label: "Indicador de progresso",
    description: "Resume percentual consumido ou concluido.",
    icon: "progress",
    defaultDataSource: "sprint_progress",
    defaultTitle: "Progresso",
    defaultSubtitle: "Percentual consolidado",
    defaultColSpan: 4,
    defaultHeight: 230,
  },
  {
    type: "text",
    label: "Bloco de texto / titulo",
    description: "Insere titulos, descricoes ou contexto narrativo.",
    icon: "type",
    defaultDataSource: "tickets_open",
    defaultTitle: "Texto",
    defaultSubtitle: "Contexto livre",
    defaultColSpan: 12,
    defaultHeight: 140,
  },
  {
    type: "section",
    label: "Separador / secao",
    description: "Cria uma cabecalho visual para agrupar widgets.",
    icon: "section",
    defaultDataSource: "tickets_open",
    defaultTitle: "Nova secao",
    defaultSubtitle: "Agrupe blocos relacionados",
    defaultColSpan: 12,
    defaultHeight: 120,
  },
  {
    type: "separator",
    label: "Separador",
    description: "Insere uma linha de divisao entre grupos de widgets.",
    icon: "minus",
    defaultDataSource: "tickets_open",
    defaultTitle: "Separador",
    defaultSubtitle: "Divisao visual",
    defaultColSpan: 12,
    defaultHeight: 32,
  },
  {
    type: "formula",
    label: "Métrica calculada",
    description: "Fórmula com variáveis de dados",
    icon: "sigma",
    defaultDataSource: "tickets_open",
    defaultTitle: "Métrica",
    defaultColSpan: 3,
    defaultHeight: 188,
  },
];

export const DASHBOARD_SOURCE_CATALOG: DashboardSourceCatalogItem[] = [
  {
    key: "tickets_open",
    label: "Chamados abertos",
    description: "Total de chamados em operacao.",
    category: "tickets",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "progress", "text"],
    defaultTitle: "Chamados abertos",
    defaultSubtitle: "Fila operacional atual",
    icon: "ticket",
    tone: "primary",
  },
  {
    key: "tickets_critical",
    label: "Chamados criticos",
    description: "Chamados com prioridade critica.",
    category: "tickets",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "list"],
    defaultTitle: "Criticos",
    defaultSubtitle: "Demandas de maior urgencia",
    icon: "alert-triangle",
    tone: "destructive",
  },
  {
    key: "tickets_late",
    label: "Chamados atrasados",
    description: "Chamados com prazo vencido.",
    category: "tickets",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "list"],
    defaultTitle: "Atrasados",
    defaultSubtitle: "Prazos vencidos",
    icon: "clock-3",
    tone: "warning",
  },
  {
    key: "tickets_due_today",
    label: "Chamados vencendo hoje",
    description: "Demandas com prazo no dia atual.",
    category: "tickets",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "list"],
    defaultTitle: "Vencem hoje",
    defaultSubtitle: "Prioridade imediata",
    icon: "calendar-days",
    tone: "accent",
  },
  {
    key: "tickets_in_progress",
    label: "Chamados em atendimento",
    description: "Chamados que ja estao em execucao.",
    category: "tickets",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "list"],
    defaultTitle: "Em atendimento",
    defaultSubtitle: "Atendimento em curso",
    icon: "play-circle",
    tone: "primary",
  },
  {
    key: "tickets_waiting_customer",
    label: "Aguardando cliente",
    description: "Chamados parados aguardando retorno do cliente.",
    category: "tickets",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "list"],
    defaultTitle: "Aguardando cliente",
    defaultSubtitle: "Dependencias externas",
    icon: "messages-square",
    tone: "warning",
  },
  {
    key: "tickets_unassigned",
    label: "Chamados sem responsavel",
    description: "Chamados ainda nao assumidos.",
    category: "tickets",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "list"],
    defaultTitle: "Sem responsavel",
    defaultSubtitle: "Fila sem dono",
    icon: "user-x",
    tone: "destructive",
  },
  {
    key: "tickets_closed_today",
    label: "Chamados finalizados hoje",
    description: "Total encerrado hoje.",
    category: "tickets",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi"],
    defaultTitle: "Finalizados hoje",
    defaultSubtitle: "Fechamentos do dia",
    icon: "check-circle-2",
    tone: "success",
  },
  {
    key: "tickets_by_status",
    label: "Chamados por status",
    description: "Distribuicao da fila por status.",
    category: "tickets",
    defaultComponentType: "donut",
    supportedTypes: ["donut", "bar", "table", "funnel"],
    defaultTitle: "Status dos chamados",
    defaultSubtitle: "Distribuicao atual",
    icon: "pie-chart",
    tone: "primary",
  },
  {
    key: "tickets_by_owner",
    label: "Chamados por responsavel",
    description: "Volume de chamados por pessoa.",
    category: "tickets",
    defaultComponentType: "bar",
    supportedTypes: ["bar", "table", "list"],
    defaultTitle: "Chamados por responsavel",
    defaultSubtitle: "Carga operacional",
    icon: "users",
    tone: "primary",
  },
  {
    key: "tickets_by_priority",
    label: "Chamados por prioridade",
    description: "Distribuicao por prioridade.",
    category: "tickets",
    defaultComponentType: "bar",
    supportedTypes: ["bar", "donut", "table"],
    defaultTitle: "Chamados por prioridade",
    defaultSubtitle: "Criticidade da fila",
    icon: "flag",
    tone: "warning",
  },
  {
    key: "tickets_by_client",
    label: "Chamados por cliente",
    description: "Volume por cliente atendido.",
    category: "tickets",
    defaultComponentType: "bar",
    supportedTypes: ["bar", "table", "list"],
    defaultTitle: "Chamados por cliente",
    defaultSubtitle: "Carteira atendida",
    icon: "building-2",
    tone: "accent",
  },
  {
    key: "tickets_trend",
    label: "Chamados por periodo",
    description: "Tendencia diaria de abertura.",
    category: "tickets",
    defaultComponentType: "line",
    supportedTypes: ["line", "bar", "table"],
    defaultTitle: "Chamados por dia",
    defaultSubtitle: "Tendencia recente",
    icon: "line-chart",
    tone: "primary",
  },
  {
    key: "tickets_attention_list",
    label: "Fila de atencao",
    description: "Criticos, atrasados ou vencendo hoje.",
    category: "tickets",
    defaultComponentType: "list",
    supportedTypes: ["list", "table"],
    defaultTitle: "Fila que exige atencao",
    defaultSubtitle: "Prioridades do momento",
    icon: "siren",
    tone: "destructive",
  },
  {
    key: "sprints_active",
    label: "Sprints ativas",
    description: "Quantidade de sprints em andamento.",
    category: "sprint",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "list"],
    defaultTitle: "Sprints ativas",
    defaultSubtitle: "Ciclos em andamento",
    icon: "rocket",
    tone: "primary",
  },
  {
    key: "sprint_items_total",
    label: "Itens da sprint",
    description: "Total de itens da sprint selecionada.",
    category: "sprint",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "table"],
    defaultTitle: "Itens da sprint",
    defaultSubtitle: "Escopo do ciclo",
    icon: "list-todo",
    tone: "primary",
  },
  {
    key: "sprint_items_completed",
    label: "Itens concluidos",
    description: "Itens concluidos na sprint atual.",
    category: "sprint",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi"],
    defaultTitle: "Concluidos",
    defaultSubtitle: "Entregas finalizadas",
    icon: "check-circle-2",
    tone: "success",
  },
  {
    key: "sprint_items_in_progress",
    label: "Itens em andamento",
    description: "Itens em execucao na sprint.",
    category: "sprint",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "table"],
    defaultTitle: "Em andamento",
    defaultSubtitle: "Execucao atual",
    icon: "activity",
    tone: "primary",
  },
  {
    key: "sprint_items_not_started",
    label: "Itens nao iniciados",
    description: "Itens que ainda nao comecaram na sprint.",
    category: "sprint",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "table"],
    defaultTitle: "Nao iniciados",
    defaultSubtitle: "Escopo parado no backlog",
    icon: "circle-dot",
    tone: "accent",
  },
  {
    key: "sprint_items_blocked",
    label: "Itens bloqueados",
    description: "Itens bloqueados na sprint.",
    category: "sprint",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "list", "table"],
    defaultTitle: "Bloqueados",
    defaultSubtitle: "Impedimentos ativos",
    icon: "ban",
    tone: "destructive",
  },
  {
    key: "sprint_items_late",
    label: "Itens atrasados",
    description: "Itens com prazo vencido no ciclo.",
    category: "sprint",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "list", "table"],
    defaultTitle: "Atrasados na sprint",
    defaultSubtitle: "Risco de entrega",
    icon: "triangle-alert",
    tone: "warning",
  },
  {
    key: "sprint_days_remaining",
    label: "Dias restantes",
    description: "Dias ate o fim da sprint.",
    category: "sprint",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "progress", "text"],
    defaultTitle: "Dias restantes",
    defaultSubtitle: "Relogio do ciclo",
    icon: "calendar-range",
    tone: "accent",
  },
  {
    key: "sprint_progress",
    label: "Progresso da sprint",
    description: "Percentual de itens concluidos.",
    category: "sprint",
    defaultComponentType: "progress",
    supportedTypes: ["progress", "kpi"],
    defaultTitle: "Progresso da sprint",
    defaultSubtitle: "Percentual concluido",
    icon: "gauge",
    tone: "success",
  },
  {
    key: "sprint_status_distribution",
    label: "Status dos itens da sprint",
    description: "Distribuicao de status do ciclo.",
    category: "sprint",
    defaultComponentType: "donut",
    supportedTypes: ["donut", "bar", "table", "funnel"],
    defaultTitle: "Status dos itens da sprint",
    defaultSubtitle: "Distribuicao atual",
    icon: "pie-chart",
    tone: "primary",
  },
  {
    key: "sprint_owner_distribution",
    label: "Distribuicao por responsavel",
    description: "Quantidade de itens por responsavel.",
    category: "sprint",
    defaultComponentType: "bar",
    supportedTypes: ["bar", "table", "list"],
    defaultTitle: "Distribuicao por responsavel",
    defaultSubtitle: "Carga do ciclo",
    icon: "users",
    tone: "primary",
  },
  {
    key: "sprint_burndown",
    label: "Burndown da sprint",
    description: "Planejado x realizado ao longo da sprint.",
    category: "sprint",
    defaultComponentType: "line",
    supportedTypes: ["line", "table"],
    defaultTitle: "Planejado x realizado",
    defaultSubtitle: "Curva da sprint",
    icon: "line-chart",
    tone: "success",
  },
  {
    key: "sprint_capacity_people",
    label: "Capacidade por pessoa",
    description: "Capacidade, utilizado e ocupacao por pessoa.",
    category: "sprint",
    defaultComponentType: "table",
    supportedTypes: ["table", "bar", "list"],
    defaultTitle: "Capacidade por pessoa",
    defaultSubtitle: "Carga individual",
    icon: "user-round",
    tone: "accent",
  },
  {
    key: "sprint_attention_items",
    label: "Itens bloqueados ou atrasados",
    description: "Lista de gargalos do ciclo.",
    category: "sprint",
    defaultComponentType: "list",
    supportedTypes: ["list", "table"],
    defaultTitle: "Itens bloqueados ou atrasados",
    defaultSubtitle: "Acompanhamento imediato",
    icon: "alert-triangle",
    tone: "destructive",
  },
  {
    key: "projects_active",
    label: "Projetos ativos",
    description: "Projetos nao concluidos.",
    category: "projects",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "table"],
    defaultTitle: "Projetos ativos",
    defaultSubtitle: "Portifolio em andamento",
    icon: "folder-kanban",
    tone: "accent",
  },
  {
    key: "projects_late",
    label: "Projetos atrasados",
    description: "Projetos com prazo vencido.",
    category: "projects",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi", "list", "table"],
    defaultTitle: "Projetos atrasados",
    defaultSubtitle: "Atencao no cronograma",
    icon: "clock-3",
    tone: "warning",
  },
  {
    key: "projects_by_status",
    label: "Projetos por status",
    description: "Distribuicao do portifolio por status.",
    category: "projects",
    defaultComponentType: "bar",
    supportedTypes: ["bar", "donut", "table"],
    defaultTitle: "Projetos por status",
    defaultSubtitle: "Panorama do portifolio",
    icon: "kanban-square",
    tone: "accent",
  },
  {
    key: "projects_deliveries_week",
    label: "Entregas da semana",
    description: "Projetos com entrega na semana corrente.",
    category: "projects",
    defaultComponentType: "list",
    supportedTypes: ["list", "table", "kpi"],
    defaultTitle: "Entregas da semana",
    defaultSubtitle: "Compromissos proximos",
    icon: "calendar-days",
    tone: "accent",
  },
  {
    key: "project_activity_distribution",
    label: "Atividades por projeto",
    description: "Volume de atividades por projeto.",
    category: "projects",
    defaultComponentType: "bar",
    supportedTypes: ["bar", "table"],
    defaultTitle: "Atividades por projeto",
    defaultSubtitle: "Distribuicao do backlog",
    icon: "layers-3",
    tone: "primary",
  },
  {
    key: "users_active",
    label: "Pessoas ativas",
    description: "Usuarios internos ativos.",
    category: "users",
    defaultComponentType: "kpi",
    supportedTypes: ["kpi"],
    defaultTitle: "Pessoas ativas",
    defaultSubtitle: "Equipe disponivel",
    icon: "users",
    tone: "success",
  },
  {
    key: "users_capacity_people",
    label: "Capacidade por pessoa",
    description: "Horas de capacidade disponiveis por pessoa.",
    category: "users",
    defaultComponentType: "bar",
    supportedTypes: ["bar", "table"],
    defaultTitle: "Capacidade por pessoa",
    defaultSubtitle: "Disponibilidade total",
    icon: "user-round",
    tone: "accent",
  },
  {
    key: "users_occupancy_people",
    label: "Ocupacao por pessoa",
    description: "Percentual de ocupacao por colaborador.",
    category: "users",
    defaultComponentType: "bar",
    supportedTypes: ["bar", "table", "list"],
    defaultTitle: "Ocupacao por pessoa",
    defaultSubtitle: "Pressao da equipe",
    icon: "gauge",
    tone: "warning",
  },
  {
    key: "users_hours_used_people",
    label: "Horas utilizadas por pessoa",
    description: "Horas usadas no planejamento atual.",
    category: "users",
    defaultComponentType: "bar",
    supportedTypes: ["bar", "table"],
    defaultTitle: "Horas utilizadas",
    defaultSubtitle: "Consumo da capacidade",
    icon: "timer-reset",
    tone: "primary",
  },
  {
    key: "users_bottlenecks_role",
    label: "Gargalos por funcao",
    description: "Funcoes mais pressionadas.",
    category: "users",
    defaultComponentType: "funnel",
    supportedTypes: ["funnel", "bar", "table", "list"],
    defaultTitle: "Gargalos por funcao",
    defaultSubtitle: "Restricoes da operacao",
    icon: "shield-alert",
    tone: "destructive",
  },
];

export const DASHBOARD_FILTER_DEFINITIONS: DashboardFilterDefinition[] = [
  { id: "period", type: "period", label: "Periodo", field: "period", defaultValue: "30d", enabled: true },
  { id: "team", type: "team", label: "Equipe", field: "team", enabled: true },
  { id: "sprint", type: "sprint", label: "Sprint", field: "sprint", enabled: true },
  { id: "project", type: "project", label: "Projeto", field: "project", enabled: true },
  { id: "responsible", type: "responsible", label: "Responsavel", field: "responsible", enabled: true },
  { id: "client", type: "client", label: "Cliente", field: "client", enabled: true },
  { id: "status", type: "status", label: "Status", field: "status", enabled: true },
  { id: "priority", type: "priority", label: "Prioridade", field: "priority", enabled: true },
];

export const VIEW_TYPE_LABELS: Record<DashboardViewType, string> = {
  operational: "Operacional",
  sprint: "Sprint",
  projects: "Projetos",
  financial: "Financeiro",
  custom: "Personalizado",
};

export const STATUS_LABELS: Record<DashboardStatus, string> = {
  active: "Ativo",
  draft: "Rascunho",
  inactive: "Inativo",
};

const OPERATIONAL_FILTER_TYPES: DashboardFilterDefinition["type"][] = ["team", "sprint"];

export function createDashboardId(prefix = "dashboard") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function createDashboardVersionId() {
  return createDashboardId("version");
}

export function createDashboardComponent(
  template: DashboardComponentTemplate,
  order: number,
): DashboardComponentConfig {
  const width = Math.max(1, Math.min(12, template.defaultColSpan));
  return {
    id: createDashboardId("component"),
    type: template.type,
    title: template.defaultTitle,
    subtitle: template.defaultSubtitle,
    icon: template.icon,
    tone: "primary",
    dataSource: template.defaultDataSource,
    limit: template.type === "list" || template.type === "table" ? 6 : 8,
    layout: {
      order,
      colSpan: width,
      minHeight: template.defaultHeight,
      x: 0,
      y: order,
      w: width,
      h: template.type === "kpi" || template.type === "progress" ? 2 : Math.max(2, Math.ceil(template.defaultHeight / 120)),
    },
    useGlobalFilters: true,
    filters: {},
    configJson: {},
    isVisible: true,
  };
}

function createSection(title: string, subtitle: string, order: number): DashboardComponentConfig {
  return {
    id: createDashboardId("section"),
    type: "section",
    title,
    subtitle,
    icon: "layout-dashboard",
    tone: "neutral",
    dataSource: "tickets_open",
    layout: {
      order,
      colSpan: 12,
      minHeight: 120,
      x: 0,
      y: order,
      w: 12,
      h: 1,
    },
    useGlobalFilters: false,
    filters: {},
    configJson: {
      description: subtitle,
    },
    isVisible: true,
  };
}

function createWidget(
  overrides: Omit<Partial<DashboardComponentConfig>, "layout">
    & { layout?: Partial<DashboardLayout> }
    & Pick<DashboardComponentConfig, "type" | "dataSource" | "title">,
  order: number,
): DashboardComponentConfig {
  const source = DASHBOARD_SOURCE_CATALOG.find((item) => item.key === overrides.dataSource);
  const defaultMinHeight =
    overrides.type === "section" || overrides.type === "separator"
      ? 120
      : overrides.type === "kpi" || overrides.type === "progress"
        ? 188
        : 330;
  const resolvedLayout = {
    order,
    colSpan: overrides.layout?.colSpan ?? 3,
    minHeight: overrides.layout?.minHeight ?? defaultMinHeight,
    x: overrides.layout?.x ?? 0,
    y: overrides.layout?.y ?? order,
    w: overrides.layout?.w ?? overrides.layout?.colSpan ?? 3,
    h:
      overrides.layout?.h
      ?? (overrides.type === "section" || overrides.type === "separator"
        ? 1
        : overrides.type === "kpi" || overrides.type === "progress"
          ? 2
          : Math.max(2, Math.ceil((overrides.layout?.minHeight ?? defaultMinHeight) / 120))),
  };
  const baseComponent = {
    id: createDashboardId("component"),
    subtitle: source?.defaultSubtitle,
    icon: source?.icon || "layout-dashboard",
    tone: source?.tone || "primary",
    limit: overrides.type === "list" || overrides.type === "table" ? 6 : 8,
    useGlobalFilters: true,
    filters: {},
    configJson: {},
    isVisible: true,
  };

  return {
    ...baseComponent,
    ...overrides,
    layout: resolvedLayout,
  };
}

export function createDefaultDashboard(userName = "Sistema"): DashboardDefinition {
  const createdAt = new Date().toISOString();
  const operationalFilters = DASHBOARD_FILTER_DEFINITIONS
    .filter((filter) => OPERATIONAL_FILTER_TYPES.includes(filter.type))
    .map((filter) => ({ ...filter, enabled: true }));
  const components: DashboardComponentConfig[] = [
    createWidget({ type: "kpi", dataSource: "tickets_open", title: "Chamados abertos", layout: { order: 1, colSpan: 3, minHeight: 188 }, useGlobalFilters: false }, 1),
    createWidget({ type: "kpi", dataSource: "tickets_critical", title: "Criticos", layout: { order: 2, colSpan: 3, minHeight: 188 }, useGlobalFilters: false }, 2),
    createWidget({ type: "kpi", dataSource: "tickets_late", title: "Atrasados", layout: { order: 3, colSpan: 3, minHeight: 188 }, useGlobalFilters: false }, 3),
    createWidget({ type: "kpi", dataSource: "tickets_due_today", title: "Vencem hoje", layout: { order: 4, colSpan: 3, minHeight: 188 }, useGlobalFilters: false }, 4),
    createWidget({ type: "kpi", dataSource: "tickets_in_progress", title: "Em atendimento", layout: { order: 5, colSpan: 3, minHeight: 188 }, useGlobalFilters: false }, 5),
    createWidget({ type: "kpi", dataSource: "tickets_waiting_customer", title: "Aguardando cliente", layout: { order: 6, colSpan: 3, minHeight: 188 }, useGlobalFilters: false }, 6),
    createWidget({ type: "kpi", dataSource: "tickets_unassigned", title: "Sem responsavel", layout: { order: 7, colSpan: 3, minHeight: 188 }, useGlobalFilters: false }, 7),
    createWidget({ type: "kpi", dataSource: "tickets_closed_today", title: "Finalizados hoje", layout: { order: 8, colSpan: 3, minHeight: 188 }, useGlobalFilters: false }, 8),
    createWidget({ type: "line", dataSource: "tickets_trend", title: "Chamados por dia", subtitle: "Tendencia recente da operacao", layout: { order: 9, colSpan: 7, minHeight: 330 }, useGlobalFilters: false }, 9),
    createWidget({ type: "donut", dataSource: "tickets_by_status", title: "Status dos chamados", subtitle: "Distribuicao atual", layout: { order: 10, colSpan: 5, minHeight: 330 }, useGlobalFilters: false }, 10),
    createWidget({ type: "list", dataSource: "tickets_attention_list", title: "Fila que exige atencao", subtitle: "Criticos, atrasados ou vencendo hoje", layout: { order: 11, colSpan: 12, minHeight: 340 }, useGlobalFilters: false }, 11),
    createSection(
      "Sprint selecionada",
      "Indicadores do ciclo respondendo aos filtros globais de sprint, equipe e responsavel.",
      12,
    ),
    createWidget({ type: "kpi", dataSource: "sprint_items_total", title: "Itens da sprint", layout: { order: 13, colSpan: 3, minHeight: 188 } }, 13),
    createWidget({ type: "kpi", dataSource: "sprint_items_completed", title: "Concluidos", layout: { order: 14, colSpan: 3, minHeight: 188 } }, 14),
    createWidget({ type: "kpi", dataSource: "sprint_items_in_progress", title: "Em andamento", layout: { order: 15, colSpan: 3, minHeight: 188 } }, 15),
    createWidget({ type: "kpi", dataSource: "sprint_items_not_started", title: "Nao iniciados", layout: { order: 16, colSpan: 3, minHeight: 188 } }, 16),
    createWidget({ type: "kpi", dataSource: "sprint_items_blocked", title: "Bloqueados", layout: { order: 17, colSpan: 3, minHeight: 188 } }, 17),
    createWidget({ type: "kpi", dataSource: "sprint_items_late", title: "Atrasados na sprint", layout: { order: 18, colSpan: 3, minHeight: 188 } }, 18),
    createWidget({ type: "kpi", dataSource: "sprint_days_remaining", title: "Dias restantes", layout: { order: 19, colSpan: 3, minHeight: 188 } }, 19),
    createWidget({ type: "progress", dataSource: "sprint_progress", title: "Progresso da sprint", layout: { order: 20, colSpan: 3, minHeight: 230 } }, 20),
    createWidget({ type: "donut", dataSource: "sprint_status_distribution", title: "Status dos itens da sprint", layout: { order: 21, colSpan: 4, minHeight: 330 } }, 21),
    createWidget({ type: "bar", dataSource: "sprint_owner_distribution", title: "Distribuicao por responsavel", layout: { order: 22, colSpan: 4, minHeight: 330 } }, 22),
    createWidget({ type: "line", dataSource: "sprint_burndown", title: "Planejado x realizado", layout: { order: 23, colSpan: 4, minHeight: 330 } }, 23),
    createWidget({ type: "table", dataSource: "sprint_capacity_people", title: "Capacidade da sprint por pessoa", layout: { order: 24, colSpan: 8, minHeight: 390 } }, 24),
    createWidget({ type: "list", dataSource: "sprint_attention_items", title: "Itens bloqueados ou atrasados", layout: { order: 25, colSpan: 4, minHeight: 390 } }, 25),
  ];

  return {
    id: createDashboardId("dashboard"),
    name: "Dashboard operacional",
    description: "Versao inicial editavel inspirada no dashboard atual do sistema.",
    type: "operational",
    status: "active",
    isActive: true,
    createdBy: userName,
    createdAt,
    updatedAt: createdAt,
    components,
    filters: operationalFilters,
    versions: [
      {
        id: createDashboardVersionId(),
        dashboardId: "initial",
        versionNumber: 1,
        configSnapshot: {
          components,
          filters: operationalFilters,
          name: "Dashboard operacional",
          description: "Snapshot inicial",
        },
        createdBy: userName,
        createdAt,
        isPublished: true,
      },
    ],
  };
}

export function createBlankDashboard(userName = "Sistema"): DashboardDefinition {
  const createdAt = new Date().toISOString();
  return {
    id: createDashboardId("dashboard"),
    name: "Novo dashboard",
    description: "Estrutura inicial pronta para customizacao.",
    type: "custom",
    status: "draft",
    isActive: false,
    createdBy: userName,
    createdAt,
    updatedAt: createdAt,
    components: [
      createSection(
        "Nova secao",
        "Use o builder para adicionar cards, graficos, listas e tabelas.",
        0,
      ),
    ],
    filters: DASHBOARD_FILTER_DEFINITIONS.map((filter) => ({ ...filter })),
    versions: [],
  };
}
