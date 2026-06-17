import type {
  DashboardComponentConfig,
  DashboardDefinition,
  DashboardFilterDefinition,
  DashboardStatus,
  DashboardViewType,
} from "@/lib/dashboardBuilder";
import {
  createBlankDashboard,
  createDashboardComponent,
  createDashboardId,
  createDashboardVersionId,
  createDefaultDashboard,
} from "@/lib/dashboardBuilder";

import { api } from "./api";
import { unwrapRows, type Paginated } from "./crud";

const ENDPOINT = "/dashboards";
const ACTIVE_ENDPOINT = "/dashboards/active/";
const DATA_QUERY_ENDPOINT = "/dashboard-data/query/";
const STORAGE_KEY = "stratos.dashboard-builder";

let memoryDashboards: DashboardDefinition[] | null = null;

type DashboardPayload = Partial<DashboardDefinition> & Record<string, unknown>;

function nowIso() {
  return new Date().toISOString();
}

function isMissingEndpoint(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 405;
}

function readLocalStorage() {
  if (typeof window === "undefined") {
    if (!memoryDashboards) {
      memoryDashboards = [createDefaultDashboard("Sistema")];
    }
    return memoryDashboards;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    const initial = [createDefaultDashboard("Sistema")];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    return JSON.parse(rawValue) as DashboardDefinition[];
  } catch {
    const fallback = [createDefaultDashboard("Sistema")];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function writeLocalStorage(dashboards: DashboardDefinition[]) {
  memoryDashboards = dashboards;

  if (typeof window === "undefined") {
    return dashboards;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards));
  return dashboards;
}

function buildEndpoint(id?: string, action?: string) {
  if (!id) {
    return `${ENDPOINT}/`;
  }

  if (!action) {
    return `${ENDPOINT}/${id}/`;
  }

  return `${ENDPOINT}/${id}/${action}/`;
}

function normalizeLayout(payload: Record<string, unknown>, fallbackOrder = 0) {
  const layout = typeof payload.layout === "object" && payload.layout !== null
    ? payload.layout as Record<string, unknown>
    : typeof payload.layout_json === "object" && payload.layout_json !== null
      ? payload.layout_json as Record<string, unknown>
      : {};
  const minHeight = Math.max(120, Number(layout.minHeight ?? layout.min_height ?? payload.min_height ?? 188) || 188);
  const colSpan = Math.max(1, Number(layout.colSpan ?? layout.col_span ?? payload.col_span ?? 3) || 3);
  const width = Math.max(1, Math.min(12, Number(layout.w ?? layout.width ?? colSpan) || colSpan));
  const height = Math.max(1, Number(layout.h ?? layout.height ?? Math.max(2, Math.ceil(minHeight / 120))) || Math.max(2, Math.ceil(minHeight / 120)));

  return {
    order: Number(layout.order ?? payload.order ?? fallbackOrder) || fallbackOrder,
    colSpan,
    minHeight,
    x: Math.max(0, Number(layout.x ?? 0) || 0),
    y: Math.max(0, Number(layout.y ?? fallbackOrder) || fallbackOrder),
    w: width,
    h: height,
  };
}

function normalizeComponent(
  payload: Partial<DashboardComponentConfig> & Record<string, unknown>,
  fallbackOrder = 0,
): DashboardComponentConfig {
  return {
    id: String(payload.id || createDashboardId("component")),
    type: String(payload.type || "kpi") as DashboardComponentConfig["type"],
    title: String(payload.title || "Componente"),
    subtitle: typeof payload.subtitle === "string" ? payload.subtitle : "",
    icon: typeof payload.icon === "string" ? payload.icon : "",
    tone: String(payload.tone || "primary") as DashboardComponentConfig["tone"],
    dataSource: String(payload.dataSource || payload.data_source || "tickets_open") as DashboardComponentConfig["dataSource"],
    valueField: typeof payload.valueField === "string"
      ? payload.valueField
      : typeof payload.value_field === "string"
        ? payload.value_field
        : "",
    groupBy: typeof payload.groupBy === "string"
      ? payload.groupBy
      : typeof payload.group_by === "string"
        ? payload.group_by
        : "",
    dateField: typeof payload.dateField === "string"
      ? payload.dateField
      : typeof payload.date_field === "string"
        ? payload.date_field
        : "",
    limit: Number(payload.limit ?? 8) || 8,
    sortBy: typeof payload.sortBy === "string"
      ? payload.sortBy
      : typeof payload.order_by === "string"
        ? payload.order_by
        : "",
    layout: normalizeLayout(payload, fallbackOrder),
    useGlobalFilters:
      typeof payload.useGlobalFilters === "boolean"
        ? payload.useGlobalFilters
        : payload.use_global_filters !== false,
    filters: typeof payload.filters === "object" && payload.filters !== null
      ? payload.filters as DashboardComponentConfig["filters"]
      : typeof payload.filters_json === "object" && payload.filters_json !== null
        ? payload.filters_json as DashboardComponentConfig["filters"]
        : {},
    configJson: typeof payload.configJson === "object" && payload.configJson !== null
      ? payload.configJson as Record<string, unknown>
      : typeof payload.config_json === "object" && payload.config_json !== null
        ? payload.config_json as Record<string, unknown>
        : {},
    isVisible: payload.isVisible !== false && payload.is_visible !== false,
  };
}

function normalizeFilter(payload: Partial<DashboardFilterDefinition> & Record<string, unknown>) {
  return {
    id: String(payload.id || createDashboardId("filter")),
    type: String(payload.type || "period") as DashboardFilterDefinition["type"],
    label: String(payload.label || payload.type || "Filtro"),
    field: String(payload.field || payload.type || "field"),
    defaultValue: typeof payload.defaultValue === "string"
      ? payload.defaultValue
      : typeof payload.default_value === "string"
        ? payload.default_value
        : "",
    configJson: typeof payload.configJson === "object" && payload.configJson !== null
      ? payload.configJson as Record<string, unknown>
      : typeof payload.config_json === "object" && payload.config_json !== null
        ? payload.config_json as Record<string, unknown>
        : {},
    enabled: payload.enabled !== false && payload.is_visible !== false,
  };
}

function normalizeDashboard(payload: DashboardPayload): DashboardDefinition {
  const components = Array.isArray(payload.components)
    ? payload.components
    : Array.isArray(payload.dashboard_components)
      ? payload.dashboard_components
      : Array.isArray(payload.components_json)
        ? payload.components_json
        : [];
  const filters = Array.isArray(payload.filters)
    ? payload.filters
    : Array.isArray(payload.dashboard_filters)
      ? payload.dashboard_filters
      : Array.isArray(payload.filters_json)
        ? payload.filters_json
        : [];
  const versions = Array.isArray(payload.versions)
    ? payload.versions
    : Array.isArray(payload.dashboard_versions)
      ? payload.dashboard_versions
      : [];

  const createdAt = typeof payload.createdAt === "string"
    ? payload.createdAt
    : typeof payload.created_at === "string"
      ? payload.created_at
      : nowIso();
  const updatedAt = typeof payload.updatedAt === "string"
    ? payload.updatedAt
    : typeof payload.updated_at === "string"
      ? payload.updated_at
      : createdAt;

  const normalizedComponents = components.map((component, index) =>
    normalizeComponent(component as Record<string, unknown>, index),
  );
  const normalizedFilters = filters.map((filter) =>
    normalizeFilter(filter as Record<string, unknown>),
  );

  return {
    id: String(payload.id || createDashboardId("dashboard")),
    name: String(payload.name || payload.nome || "Dashboard"),
    description:
      typeof payload.description === "string"
        ? payload.description
        : typeof payload.descricao === "string"
          ? payload.descricao
          : "",
    type: String(payload.type || "custom") as DashboardViewType,
    status: String(payload.status || "draft") as DashboardStatus,
    isActive: Boolean(payload.isActive ?? payload.is_active ?? false),
    createdBy:
      typeof payload.createdBy === "string"
        ? payload.createdBy
        : typeof payload.created_by === "string"
          ? payload.created_by
          : "",
    createdAt,
    updatedAt,
    components: normalizedComponents.length
      ? normalizedComponents.sort((left, right) => left.layout.order - right.layout.order)
      : createBlankDashboard("Sistema").components,
    filters: normalizedFilters,
    versions: versions.map((version, index) => {
      const record = version as Record<string, unknown>;
      return {
        id: String(record.id || createDashboardVersionId()),
        dashboardId: String(record.dashboardId || record.dashboard || payload.id || ""),
        versionNumber: Number(record.versionNumber ?? record.version_number ?? index + 1) || index + 1,
        configSnapshot: {
          name: String(record.name || payload.name || "Dashboard"),
          description:
            typeof record.description === "string"
              ? record.description
              : typeof payload.description === "string"
                ? payload.description
                : "",
          components: normalizedComponents,
          filters: normalizedFilters,
        },
        createdBy:
          typeof record.createdBy === "string"
            ? record.createdBy
            : typeof record.created_by === "string"
              ? record.created_by
              : "",
        createdAt:
          typeof record.createdAt === "string"
            ? record.createdAt
            : typeof record.created_at === "string"
              ? record.created_at
              : updatedAt,
        isPublished: Boolean(record.isPublished ?? record.is_published ?? false),
      };
    }),
  };
}

function buildMutationPayload(dashboard: Partial<DashboardDefinition>) {
  return {
    name: dashboard.name || "",
    description: dashboard.description || "",
    type: dashboard.type || "custom",
    status: dashboard.status || "draft",
    is_active: Boolean(dashboard.isActive),
    components_json: (dashboard.components || []).map((component) => ({
      id: component.id,
      type: component.type,
      title: component.title,
      subtitle: component.subtitle || "",
      icon: component.icon || "",
      tone: component.tone || "primary",
      data_source: component.dataSource,
      value_field: component.valueField || "",
      group_by: component.groupBy || "",
      date_field: component.dateField || "",
      limit: component.limit || 8,
      order_by: component.sortBy || "",
      use_global_filters: component.useGlobalFilters,
      filters_json: component.filters || {},
      config_json: component.configJson || {},
      layout_json: component.layout,
      is_visible: component.isVisible,
      order: component.layout.order,
    })),
    filters_json: (dashboard.filters || []).map((filter) => ({
      id: filter.id,
      type: filter.type,
      label: filter.label,
      field: filter.field,
      default_value: filter.defaultValue || "",
      config_json: filter.configJson || {},
      enabled: filter.enabled,
    })),
  };
}

function ensureSingleActive(dashboards: DashboardDefinition[], nextId: string): DashboardDefinition[] {
  return dashboards.map((dashboard): DashboardDefinition => ({
    ...dashboard,
    isActive: dashboard.id === nextId,
    status: dashboard.id === nextId ? "active" : dashboard.status === "active" ? "inactive" : dashboard.status,
  }));
}

export async function listDashboards() {
  try {
    const response = await api.get<Paginated<DashboardPayload> | DashboardPayload[]>(`${ENDPOINT}/`);
    const rows = unwrapRows(response.data).map((dashboard) => normalizeDashboard(dashboard));
    if (rows.length) {
      return rows;
    }
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  return readLocalStorage();
}

export async function getActiveDashboard() {
  try {
    const response = await api.get<DashboardPayload>(ACTIVE_ENDPOINT);
    return normalizeDashboard(response.data);
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  const dashboards = readLocalStorage();
  return dashboards.find((dashboard) => dashboard.isActive) || dashboards[0] || createDefaultDashboard("Sistema");
}

export async function createDashboard(dashboard: Partial<DashboardDefinition>) {
  try {
    const response = await api.post<DashboardPayload>(`${ENDPOINT}/`, buildMutationPayload(dashboard));
    return normalizeDashboard(response.data);
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  const dashboards = readLocalStorage();
  const createdAt = nowIso();
  const created: DashboardDefinition = {
    ...(createBlankDashboard(dashboard.createdBy || "Sistema")),
    ...dashboard,
    id: createDashboardId("dashboard"),
    createdAt,
    updatedAt: createdAt,
    components: dashboard.components || createBlankDashboard(dashboard.createdBy || "Sistema").components,
    filters: dashboard.filters || createBlankDashboard(dashboard.createdBy || "Sistema").filters,
    versions: [],
    status: dashboard.status || "draft",
    isActive: Boolean(dashboard.isActive),
  };

  const nextDashboards = created.isActive
    ? ensureSingleActive([...dashboards, created], created.id)
    : [...dashboards, created];

  writeLocalStorage(nextDashboards);
  return created;
}

export async function updateDashboard(id: string, dashboard: Partial<DashboardDefinition>) {
  try {
    const response = await api.patch<DashboardPayload>(buildEndpoint(id), buildMutationPayload(dashboard));
    return normalizeDashboard(response.data);
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  const dashboards = readLocalStorage();
  const nextDashboards: DashboardDefinition[] = dashboards.map((item): DashboardDefinition =>
    item.id === id
      ? {
          ...item,
          ...dashboard,
          status: dashboard.status ?? item.status,
          isActive: dashboard.isActive ?? item.isActive,
          updatedAt: nowIso(),
          components: dashboard.components || item.components,
          filters: dashboard.filters || item.filters,
        }
      : item,
  );
  const normalized = dashboard.isActive ? ensureSingleActive(nextDashboards, id) : nextDashboards;
  writeLocalStorage(normalized);
  return normalized.find((item) => item.id === id) || dashboards[0];
}

export async function deleteDashboard(id: string) {
  try {
    await api.delete(buildEndpoint(id));
    return null;
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  const dashboards = readLocalStorage().filter((dashboard) => dashboard.id !== id);
  const nextDashboards = dashboards.length ? dashboards : [createDefaultDashboard("Sistema")];
  const activeExists = nextDashboards.some((dashboard) => dashboard.isActive);
  writeLocalStorage(activeExists ? nextDashboards : ensureSingleActive(nextDashboards, nextDashboards[0].id));
  return null;
}

export async function duplicateDashboard(id: string) {
  try {
    const response = await api.post<DashboardPayload>(buildEndpoint(id, "duplicate"), {});
    return normalizeDashboard(response.data);
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  const dashboards = readLocalStorage();
  const original = dashboards.find((dashboard) => dashboard.id === id);
  if (!original) {
    throw new Error("Dashboard nao encontrado.");
  }

  const createdAt = nowIso();
  const duplicated: DashboardDefinition = {
    ...original,
    id: createDashboardId("dashboard"),
    name: `${original.name} (copia)`,
    status: "draft",
    isActive: false,
    createdAt,
    updatedAt: createdAt,
    components: original.components.map((component, index) => ({
      ...component,
      id: createDashboardId("component"),
      layout: {
        ...component.layout,
        order: index,
      },
    })),
    versions: [
      ...original.versions,
      {
        id: createDashboardVersionId(),
        dashboardId: original.id,
        versionNumber: original.versions.length + 1,
        configSnapshot: {
          name: original.name,
          description: original.description || "",
          components: original.components,
          filters: original.filters,
        },
        createdBy: original.createdBy,
        createdAt,
        isPublished: false,
      },
    ],
  };

  writeLocalStorage([...dashboards, duplicated]);
  return duplicated;
}

export async function publishDashboard(id: string) {
  try {
    const response = await api.post<DashboardPayload>(buildEndpoint(id, "publish"), {});
    return normalizeDashboard(response.data);
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  const dashboards = readLocalStorage();
  const versionTimestamp = nowIso();
  const nextDashboards = ensureSingleActive(
    dashboards.map((dashboard): DashboardDefinition => {
      if (dashboard.id !== id) {
        return {
          ...dashboard,
          status: dashboard.status === "active" ? "inactive" : dashboard.status,
        };
      }

      return {
        ...dashboard,
        status: "active",
        isActive: true,
        updatedAt: versionTimestamp,
        versions: [
          ...dashboard.versions,
          {
            id: createDashboardVersionId(),
            dashboardId: dashboard.id,
            versionNumber: dashboard.versions.length + 1,
            configSnapshot: {
              name: dashboard.name,
              description: dashboard.description || "",
              components: dashboard.components,
              filters: dashboard.filters,
            },
            createdBy: dashboard.createdBy,
            createdAt: versionTimestamp,
            isPublished: true,
          },
        ],
      };
    }),
    id,
  );

  writeLocalStorage(nextDashboards);
  return nextDashboards.find((dashboard) => dashboard.id === id) || null;
}

export async function setActiveDashboard(id: string) {
  try {
    const response = await api.post<DashboardPayload>(buildEndpoint(id, "set-active"), {});
    return normalizeDashboard(response.data);
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  const dashboards = ensureSingleActive(readLocalStorage(), id).map((dashboard): DashboardDefinition =>
    dashboard.id === id ? { ...dashboard, status: "active", isActive: true } : dashboard,
  );
  writeLocalStorage(dashboards);
  return dashboards.find((dashboard) => dashboard.id === id) || null;
}

export async function getDashboard(id: string) {
  try {
    const response = await api.get<DashboardPayload>(buildEndpoint(id));
    return normalizeDashboard(response.data);
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  const dashboards = readLocalStorage();
  return dashboards.find((dashboard) => dashboard.id === id) || null;
}

export async function createComponentFromTemplate(id: string, order: number) {
  const dashboards = readLocalStorage();
  const dashboard = dashboards.find((item) => item.id === id);
  if (!dashboard) {
    return null;
  }

  const component = createDashboardComponent(
    {
      type: "kpi",
      label: "Card / KPI",
      description: "",
      icon: "gauge",
      defaultDataSource: "tickets_open",
      defaultTitle: "Novo KPI",
      defaultColSpan: 3,
      defaultHeight: 188,
    },
    order,
  );

  dashboard.components.push(component);
  dashboard.updatedAt = nowIso();
  writeLocalStorage([...dashboards]);
  return component;
}

export async function queryDashboardData(payload: Record<string, unknown>) {
  const response = await api.post<Record<string, unknown>>(DATA_QUERY_ENDPOINT, payload);
  return response.data;
}
