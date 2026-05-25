import type {
  Project,
  ProjectCost,
  ProjectCostRelatedType,
  ProjectCostSource,
  ProjectCostType,
} from "@/lib/types";

import { api } from "./api";
import type { Paginated } from "./crud";
import { getProject, updateProject } from "./projectService";
import { toDateOrNull, toNumber } from "./utils";

const COST_COLLECTION_ENDPOINTS = [
  "/project-costs/",
  "/project_costs/",
  "/cost-launches/",
];

const PROJECT_COST_FIELDS = ["cost_entries", "costs", "project_costs"] as const;

export const PROJECT_COST_CATEGORY_OPTIONS = [
  "Mao de obra",
  "Infraestrutura",
  "Licencas",
  "Deslocamento",
  "Terceiros",
  "Outros",
] as const;

function createProjectCostId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `cost-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createActivityTimeEntryId(activityId: string) {
  return `activity:${activityId}`;
}

function createGeneratedTimeEntryId(timeEntryId: string) {
  return `time-entry:${timeEntryId}`;
}

function unwrapRows<T>(payload: Paginated<T> | T[]) {
  return Array.isArray(payload) ? payload : payload.results || [];
}

function getStatusCode(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status;
}

function isMissingEndpoint(error: unknown) {
  const status = getStatusCode(error);
  return status === 404 || status === 405;
}

function isRetriableProjectFieldError(error: unknown) {
  const status = getStatusCode(error);
  return status === 400 || status === 404;
}

function canRetryProjectCostPayload(error: unknown) {
  const status = getStatusCode(error);
  return status === 400;
}

function normalizeRelatedItemType(value?: string | null): ProjectCostRelatedType | undefined {
  if (value === "activity" || value === "ticket") {
    return value;
  }

  return undefined;
}

function normalizeCostSource(value?: string | null): ProjectCostSource {
  return value === "activity_time_entry" ? "activity_time_entry" : "manual";
}

function resolveProjectCostAmount(payload: {
  type?: ProjectCostType | string | null;
  amount?: string | number | null;
  hours?: string | number | null;
  hourlyRate?: string | number | null;
  hourly_rate?: string | number | null;
  value?: string | number | null;
}) {
  const type = payload.type === "hours" ? "hours" : "manual";
  const hourlyRate = toNumber(payload.hourlyRate ?? payload.hourly_rate, 0);
  const hours = toNumber(payload.hours, 0);

  if (type === "hours") {
    return toNumber(payload.amount, hours * hourlyRate);
  }

  return toNumber(payload.amount ?? payload.value, 0);
}

export function normalizeProjectCost(
  payload: Partial<ProjectCost> & Record<string, unknown>,
  projectId?: string,
): ProjectCost {
  const type = payload.type === "hours" ? "hours" : "manual";
  const collaboratorName =
    typeof payload.collaboratorName === "string"
      ? payload.collaboratorName
      : typeof payload.collaborator_name === "string"
        ? payload.collaborator_name
        : typeof payload.user_name === "string"
          ? payload.user_name
          : undefined;
  const relatedItemTitle =
    typeof payload.relatedItemTitle === "string"
      ? payload.relatedItemTitle
      : typeof payload.related_item_title === "string"
        ? payload.related_item_title
        : typeof payload.related_item_name === "string"
          ? payload.related_item_name
          : typeof payload.activity_name === "string"
            ? payload.activity_name
            : typeof payload.ticket_title === "string"
              ? payload.ticket_title
              : undefined;
  const dateValue =
    typeof payload.date === "string"
      ? payload.date
      : typeof payload.launch_date === "string"
        ? payload.launch_date
        : typeof payload.created_at === "string"
          ? payload.created_at.slice(0, 10)
          : new Date().toISOString().slice(0, 10);

  return {
    id: String(payload.id || createProjectCostId()),
    projectId: String(
      projectId
      || payload.projectId
      || payload.project_id
      || payload.project
      || "",
    ),
    type,
    source: normalizeCostSource(
      typeof payload.source === "string"
        ? payload.source
        : typeof payload.cost_source === "string"
          ? payload.cost_source
          : undefined,
    ),
    isActive:
      typeof payload.isActive === "boolean"
        ? payload.isActive
        : typeof payload.is_active === "boolean"
          ? payload.is_active
          : true,
    description:
      typeof payload.description === "string"
        ? payload.description
        : typeof payload.title === "string"
          ? payload.title
          : "",
    collaboratorId: String(
      payload.collaboratorId
      || payload.collaborator_id
      || payload.collaborator
      || payload.user
      || "",
    ) || undefined,
    collaboratorName,
    relatedItemId: String(
      payload.relatedItemId
      || payload.related_item_id
      || payload.related_item
      || "",
    ) || undefined,
    relatedItemType: normalizeRelatedItemType(
      typeof payload.relatedItemType === "string"
        ? payload.relatedItemType
        : typeof payload.related_item_type === "string"
          ? payload.related_item_type
          : undefined,
    ),
    relatedItemTitle,
    timeEntryId:
      typeof payload.timeEntryId === "string"
        ? payload.timeEntryId
        : typeof payload.time_entry_id === "string"
          ? payload.time_entry_id
          : undefined,
    category:
      typeof payload.category === "string" && payload.category.trim()
        ? payload.category
        : type === "hours"
          ? "Mao de obra"
          : "Outros",
    date: dateValue,
    hours:
      payload.hours == null
        ? undefined
        : toNumber(payload.hours as string | number, 0),
    hourlyRate:
      payload.hourlyRate == null && payload.hourly_rate == null
        ? undefined
        : toNumber((payload.hourlyRate ?? payload.hourly_rate) as string | number, 0),
    amount: resolveProjectCostAmount({
      type,
      amount: payload.amount as string | number | null | undefined,
      hours: payload.hours as string | number | null | undefined,
      hourlyRate: payload.hourlyRate as string | number | null | undefined,
      hourly_rate: payload.hourly_rate as string | number | null | undefined,
      value: payload.value as string | number | null | undefined,
    }),
    notes:
      typeof payload.notes === "string"
        ? payload.notes
        : typeof payload.observation === "string"
          ? payload.observation
          : typeof payload.observacao === "string"
            ? payload.observacao
            : "",
    createdAt:
      typeof payload.createdAt === "string"
        ? payload.createdAt
        : typeof payload.created_at === "string"
          ? payload.created_at
          : undefined,
    updatedAt:
      typeof payload.updatedAt === "string"
        ? payload.updatedAt
        : typeof payload.updated_at === "string"
          ? payload.updated_at
          : undefined,
  };
}

function toProjectCostPayload(payload: Partial<ProjectCost>) {
  const type = payload.type === "hours" ? "hours" : "manual";
  const source = payload.source === "activity_time_entry" ? "activity_time_entry" : "manual";
  const amount = resolveProjectCostAmount({
    type,
    amount: payload.amount,
    hours: payload.hours,
    hourlyRate: payload.hourlyRate,
  });

  return {
    project: payload.projectId,
    type,
    source,
    is_active: payload.isActive ?? true,
    description: payload.description || "",
    collaborator: payload.collaboratorId || null,
    collaborator_name: payload.collaboratorName || "",
    related_item_id: payload.relatedItemId || null,
    related_item_type: payload.relatedItemType || null,
    related_item_title: payload.relatedItemTitle || "",
    time_entry_id: payload.timeEntryId || null,
    category: payload.category || (type === "hours" ? "Mao de obra" : "Outros"),
    date: toDateOrNull(payload.date || new Date().toISOString().slice(0, 10)),
    hours: type === "hours" ? toNumber(payload.hours, 0) : null,
    hourly_rate: type === "hours" ? toNumber(payload.hourlyRate, 0) : null,
    amount,
    notes: payload.notes || "",
  };
}

function toLegacyProjectCostPayload(payload: Partial<ProjectCost>) {
  const type = payload.type === "hours" ? "hours" : "manual";
  const amount = resolveProjectCostAmount({
    type,
    amount: payload.amount,
    hours: payload.hours,
    hourlyRate: payload.hourlyRate,
  });

  return {
    project: payload.projectId,
    type,
    description: payload.description || "",
    collaborator: payload.collaboratorId || null,
    collaborator_name: payload.collaboratorName || "",
    related_item_id: payload.relatedItemId || null,
    related_item_type: payload.relatedItemType || null,
    related_item_title: payload.relatedItemTitle || "",
    category: payload.category || (type === "hours" ? "Mao de obra" : "Outros"),
    date: toDateOrNull(payload.date || new Date().toISOString().slice(0, 10)),
    hours: type === "hours" ? toNumber(payload.hours, 0) : null,
    hourly_rate: type === "hours" ? toNumber(payload.hourlyRate, 0) : null,
    amount,
    notes: payload.notes || "",
  };
}

function toEmbeddedProjectCostPayload(payload: ProjectCost) {
  return {
    id: payload.id,
    projectId: payload.projectId,
    type: payload.type,
    source: payload.source || "manual",
    isActive: payload.isActive ?? true,
    description: payload.description || "",
    collaboratorId: payload.collaboratorId || "",
    collaboratorName: payload.collaboratorName || "",
    relatedItemId: payload.relatedItemId || "",
    relatedItemType: payload.relatedItemType || "",
    relatedItemTitle: payload.relatedItemTitle || "",
    timeEntryId: payload.timeEntryId || "",
    category: payload.category,
    date: payload.date,
    hours: payload.hours,
    hourlyRate: payload.hourlyRate,
    amount: resolveProjectCostAmount(payload),
    notes: payload.notes || "",
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };
}

function toLegacyEmbeddedProjectCostPayload(payload: ProjectCost) {
  return {
    id: payload.id,
    projectId: payload.projectId,
    type: payload.type,
    description: payload.description || "",
    collaboratorId: payload.collaboratorId || "",
    collaboratorName: payload.collaboratorName || "",
    relatedItemId: payload.relatedItemId || "",
    relatedItemType: payload.relatedItemType || "",
    relatedItemTitle: payload.relatedItemTitle || "",
    category: payload.category,
    date: payload.date,
    hours: payload.hours,
    hourlyRate: payload.hourlyRate,
    amount: resolveProjectCostAmount(payload),
    notes: payload.notes || "",
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };
}

function resolveProjectCostField(project: Project & Record<string, unknown>) {
  const existingField = PROJECT_COST_FIELDS.find((field) => Array.isArray(project[field]));
  return existingField || PROJECT_COST_FIELDS[0];
}

function readProjectCostField(project: Project & Record<string, unknown>) {
  const field = resolveProjectCostField(project);
  const rows = Array.isArray(project[field]) ? (project[field] as Array<Record<string, unknown>>) : [];
  return rows.map((row) => normalizeProjectCost(row, project.id));
}

async function writeProjectCostField(projectId: string, costs: ProjectCost[]) {
  const project = await getProject(projectId) as Project & Record<string, unknown>;
  const fields = [resolveProjectCostField(project), ...PROJECT_COST_FIELDS].filter(
    (field, index, values) => values.indexOf(field) === index,
  );
  const embeddedCosts = costs.map(toEmbeddedProjectCostPayload);
  const legacyEmbeddedCosts = costs.map(toLegacyEmbeddedProjectCostPayload);
  const summary = calculateProjectCostSummary(costs, project.budget);
  let lastError: unknown;

  for (const field of fields) {
    try {
      return await updateProject(projectId, {
        [field]: embeddedCosts,
        real_cost: summary.realized,
      });
    } catch (error) {
      lastError = error;
      if (canRetryProjectCostPayload(error)) {
        try {
          return await updateProject(projectId, {
            [field]: legacyEmbeddedCosts,
            real_cost: summary.realized,
          });
        } catch (legacyError) {
          lastError = legacyError;
        }
      }
      if (!isRetriableProjectFieldError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Não foi possível salvar os custos do projeto.");
}

async function syncProjectRealCost(projectId: string) {
  try {
    const project = await getProject(projectId);
    const costs = await listProjectCosts(projectId);
    const summary = calculateProjectCostSummary(costs, project.budget);
    await updateProject(projectId, { real_cost: summary.realized });
  } catch {
    return null;
  }

  return null;
}

async function listProjectCostsFromApi(projectId: string) {
  let lastError: unknown;

  try {
    const nestedResponse = await api.get<Paginated<Record<string, unknown>> | Record<string, unknown>[]>(
      `/projects/${projectId}/costs/`,
    );
    return unwrapRows(nestedResponse.data).map((row) => normalizeProjectCost(row, projectId));
  } catch (error) {
    lastError = error;
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  for (const endpoint of COST_COLLECTION_ENDPOINTS) {
    try {
      const response = await api.get<Paginated<Record<string, unknown>> | Record<string, unknown>[]>(
        endpoint,
        { params: { project: projectId } },
      );
      return unwrapRows(response.data).map((row) => normalizeProjectCost(row, projectId));
    } catch (error) {
      lastError = error;
      if (!isMissingEndpoint(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Não foi possível listar os custos do projeto.");
}

export async function listProjectCosts(projectId: string) {
  try {
    return await listProjectCostsFromApi(projectId);
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }

    const project = await getProject(projectId) as Project & Record<string, unknown>;
    return readProjectCostField(project);
  }
}

export async function createProjectCost(projectId: string, payload: Partial<ProjectCost>) {
  const normalizedPayload = toProjectCostPayload({ ...payload, projectId });
  const legacyPayload = toLegacyProjectCostPayload({ ...payload, projectId });
  let lastError: unknown;

  try {
    const nestedResponse = await api.post<Record<string, unknown>>(
      `/projects/${projectId}/costs/`,
      normalizedPayload,
    );
    await syncProjectRealCost(projectId);
    return normalizeProjectCost(nestedResponse.data, projectId);
  } catch (error) {
    lastError = error;
    if (canRetryProjectCostPayload(error)) {
      try {
        const legacyResponse = await api.post<Record<string, unknown>>(
          `/projects/${projectId}/costs/`,
          legacyPayload,
        );
        await syncProjectRealCost(projectId);
        return normalizeProjectCost(legacyResponse.data, projectId);
      } catch (legacyError) {
        lastError = legacyError;
      }
    }
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  for (const endpoint of COST_COLLECTION_ENDPOINTS) {
    try {
      const response = await api.post<Record<string, unknown>>(endpoint, normalizedPayload);
      await syncProjectRealCost(projectId);
      return normalizeProjectCost(response.data, projectId);
    } catch (error) {
      lastError = error;
      if (canRetryProjectCostPayload(error)) {
        try {
          const legacyResponse = await api.post<Record<string, unknown>>(endpoint, legacyPayload);
          await syncProjectRealCost(projectId);
          return normalizeProjectCost(legacyResponse.data, projectId);
        } catch (legacyError) {
          lastError = legacyError;
        }
      }
      if (!isMissingEndpoint(error)) {
        throw error;
      }
    }
  }

  const existingCosts = await listProjectCosts(projectId);
  const nextCost = normalizeProjectCost({
    ...payload,
    id: payload.id || createProjectCostId(),
    projectId,
    source: payload.source || "manual",
    amount: resolveProjectCostAmount({
      type: payload.type,
      amount: payload.amount,
      hours: payload.hours,
      hourlyRate: payload.hourlyRate,
    }),
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, projectId);

  await writeProjectCostField(projectId, [...existingCosts, nextCost]);
  return nextCost;
}

export async function updateProjectCost(
  projectId: string,
  costId: string,
  payload: Partial<ProjectCost>,
) {
  const normalizedPayload = toProjectCostPayload({ ...payload, projectId });
  const legacyPayload = toLegacyProjectCostPayload({ ...payload, projectId });
  let lastError: unknown;

  try {
    const nestedResponse = await api.patch<Record<string, unknown>>(
      `/projects/${projectId}/costs/${costId}/`,
      normalizedPayload,
    );
    await syncProjectRealCost(projectId);
    return normalizeProjectCost(nestedResponse.data, projectId);
  } catch (error) {
    lastError = error;
    if (canRetryProjectCostPayload(error)) {
      try {
        const legacyResponse = await api.patch<Record<string, unknown>>(
          `/projects/${projectId}/costs/${costId}/`,
          legacyPayload,
        );
        await syncProjectRealCost(projectId);
        return normalizeProjectCost(legacyResponse.data, projectId);
      } catch (legacyError) {
        lastError = legacyError;
      }
    }
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  for (const endpoint of COST_COLLECTION_ENDPOINTS) {
    try {
      const response = await api.patch<Record<string, unknown>>(
        `${endpoint}${costId}/`,
        normalizedPayload,
      );
      await syncProjectRealCost(projectId);
      return normalizeProjectCost(response.data, projectId);
    } catch (error) {
      lastError = error;
      if (canRetryProjectCostPayload(error)) {
        try {
          const legacyResponse = await api.patch<Record<string, unknown>>(
            `${endpoint}${costId}/`,
            legacyPayload,
          );
          await syncProjectRealCost(projectId);
          return normalizeProjectCost(legacyResponse.data, projectId);
        } catch (legacyError) {
          lastError = legacyError;
        }
      }
      if (!isMissingEndpoint(error)) {
        throw error;
      }
    }
  }

  const existingCosts = await listProjectCosts(projectId);
  const nextCosts = existingCosts.map((cost) => {
    if (cost.id !== costId) {
      return cost;
    }

    return normalizeProjectCost({
      ...cost,
      ...payload,
      id: costId,
      projectId,
      updatedAt: new Date().toISOString(),
    }, projectId);
  });
  const updatedCost = nextCosts.find((cost) => cost.id === costId);

  if (!updatedCost) {
    throw lastError instanceof Error ? lastError : new Error("Lançamento não encontrado.");
  }

  await writeProjectCostField(projectId, nextCosts);
  return updatedCost;
}

export async function deleteProjectCost(projectId: string, costId: string) {
  let lastError: unknown;

  try {
    await api.delete(`/projects/${projectId}/costs/${costId}/`);
    await syncProjectRealCost(projectId);
    return;
  } catch (error) {
    lastError = error;
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  for (const endpoint of COST_COLLECTION_ENDPOINTS) {
    try {
      await api.delete(`${endpoint}${costId}/`);
      await syncProjectRealCost(projectId);
      return;
    } catch (error) {
      lastError = error;
      if (!isMissingEndpoint(error)) {
        throw error;
      }
    }
  }

  const existingCosts = await listProjectCosts(projectId);
  await writeProjectCostField(
    projectId,
    existingCosts.filter((cost) => cost.id !== costId),
  );

  if (existingCosts.some((cost) => cost.id === costId)) {
    return;
  }

  throw lastError instanceof Error ? lastError : new Error("Lançamento não encontrado.");
}

export function calculateProjectCostSummary(
  costs: ProjectCost[],
  budget?: string | number | null,
) {
  const costList = Array.isArray(costs) ? costs.filter(Boolean) : [];
  const totalBudget = toNumber(budget, 0);
  const realized = costList.reduce(
    (sum, cost) => sum + (cost.isActive === false ? 0 : resolveProjectCostAmount(cost)),
    0,
  );
  const balance = totalBudget - realized;
  const percentConsumed = totalBudget > 0 ? (realized / totalBudget) * 100 : 0;

  return {
    budget: totalBudget,
    realized,
    balance,
    percentConsumed,
  };
}

export function findActivityTimeEntryCost(costs: ProjectCost[], activityId: string) {
  const timeEntryId = createActivityTimeEntryId(activityId);

  return (
    costs.find(
      (cost) =>
        cost.source === "activity_time_entry"
        && (cost.timeEntryId === timeEntryId
          || (cost.relatedItemType === "activity" && cost.relatedItemId === activityId)),
    ) || null
  );
}

export function findGeneratedTimeEntryCost(costs: ProjectCost[], timeEntryId: string) {
  const normalizedTimeEntryId = createGeneratedTimeEntryId(timeEntryId);

  return (
    costs.find(
      (cost) =>
        cost.source === "activity_time_entry"
        && (cost.timeEntryId === normalizedTimeEntryId || cost.timeEntryId === timeEntryId),
    ) || null
  );
}

export function listActivityGeneratedCosts(costs: ProjectCost[], activityId: string) {
  return costs.filter(
    (cost) =>
      cost.source === "activity_time_entry"
      && cost.relatedItemType === "activity"
      && cost.relatedItemId === activityId,
  );
}

async function listActivityTimeEntryCandidates(projectIds: string[]) {
  const rows = await Promise.all(
    projectIds.map(async (projectId) => {
      try {
        return await listProjectCosts(projectId);
      } catch {
        return [];
      }
    }),
  );

  return rows.flat();
}

export async function syncActivityTimeEntryCost(params: {
  activityId: string;
  activityTitle: string;
  calculateHourlyCost?: boolean;
  projectId?: string | null;
  previousProjectId?: string | null;
  collaboratorId?: string | null;
  collaboratorName?: string;
  fallbackHourlyRate?: string | number | null;
  hours?: string | number | null;
  notes?: string;
  date?: string | null;
}) {
  const projectId = params.projectId || null;
  const previousProjectId = params.previousProjectId || null;
  const projectIds = [projectId, previousProjectId]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);
  const candidateCosts = projectIds.length
    ? await listActivityTimeEntryCandidates(projectIds)
    : [];
  const existingCost = findActivityTimeEntryCost(candidateCosts, params.activityId);
  const normalizedHours = toNumber(params.hours, 0);
  const shouldCalculateHourlyCost = Boolean(params.calculateHourlyCost);
  const preservedHourlyRate =
    existingCost
    && existingCost.collaboratorId === (params.collaboratorId || undefined)
    && toNumber(existingCost.hourlyRate, 0) > 0
      ? toNumber(existingCost.hourlyRate, 0)
      : 0;
  const selectedHourlyRate = preservedHourlyRate || toNumber(params.fallbackHourlyRate, 0);

  if (!shouldCalculateHourlyCost || !projectId || !params.collaboratorId || normalizedHours <= 0) {
    if (existingCost) {
      await deleteProjectCost(existingCost.projectId, existingCost.id);
    }
    return null;
  }

  if (selectedHourlyRate <= 0) {
    throw new Error(
      "Defina o custo por hora do colaborador antes de apontar horas na atividade.",
    );
  }

  const payload: Partial<ProjectCost> = {
    projectId,
    type: "hours",
    source: "activity_time_entry",
    isActive: true,
    description: params.activityTitle,
    collaboratorId: params.collaboratorId,
    collaboratorName: params.collaboratorName || "",
    relatedItemId: params.activityId,
    relatedItemType: "activity",
    relatedItemTitle: params.activityTitle,
    timeEntryId: createActivityTimeEntryId(params.activityId),
    category: "Mao de obra",
    date:
      existingCost?.date
      || params.date
      || new Date().toISOString().slice(0, 10),
    hours: normalizedHours,
    hourlyRate: selectedHourlyRate,
    amount: normalizedHours * selectedHourlyRate,
    notes: params.notes || "",
  };

  if (existingCost && existingCost.projectId === projectId) {
    return updateProjectCost(projectId, existingCost.id, {
      ...existingCost,
      ...payload,
    });
  }

  if (existingCost) {
    await deleteProjectCost(existingCost.projectId, existingCost.id);
  }

  return createProjectCost(projectId, payload);
}

export async function syncGeneratedTimeEntryCost(params: {
  timeEntryId: string;
  activityId: string;
  activityTitle: string;
  calculateHourlyCost?: boolean;
  projectId?: string | null;
  previousProjectId?: string | null;
  collaboratorId?: string | null;
  collaboratorName?: string;
  hourlyRate?: string | number | null;
  hours?: string | number | null;
  notes?: string;
  date?: string | null;
}) {
  const projectId = params.projectId || null;
  const previousProjectId = params.previousProjectId || null;
  const projectIds = [projectId, previousProjectId]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);
  const candidateCosts = projectIds.length
    ? await listActivityTimeEntryCandidates(projectIds)
    : [];
  const existingCost = findGeneratedTimeEntryCost(candidateCosts, params.timeEntryId);
  const normalizedHours = toNumber(params.hours, 0);
  const shouldCalculateHourlyCost = params.calculateHourlyCost !== false;
  const preservedHourlyRate =
    existingCost
    && existingCost.collaboratorId === (params.collaboratorId || undefined)
    && toNumber(existingCost.hourlyRate, 0) > 0
      ? toNumber(existingCost.hourlyRate, 0)
      : 0;
  const selectedHourlyRate = preservedHourlyRate || toNumber(params.hourlyRate, 0);

  if (!shouldCalculateHourlyCost || !projectId || !params.collaboratorId || normalizedHours <= 0) {
    if (existingCost) {
      await deleteProjectCost(existingCost.projectId, existingCost.id);
    }
    return null;
  }

  if (selectedHourlyRate <= 0) {
    throw new Error("Defina o custo por hora do colaborador antes de salvar o apontamento.");
  }

  const payload: Partial<ProjectCost> = {
    projectId,
    type: "hours",
    source: "activity_time_entry",
    isActive: true,
    description: params.activityTitle,
    collaboratorId: params.collaboratorId,
    collaboratorName: params.collaboratorName || "",
    relatedItemId: params.activityId,
    relatedItemType: "activity",
    relatedItemTitle: params.activityTitle,
    timeEntryId: createGeneratedTimeEntryId(params.timeEntryId),
    category: "Mao de obra",
    date:
      existingCost?.date
      || params.date
      || new Date().toISOString().slice(0, 10),
    hours: normalizedHours,
    hourlyRate: selectedHourlyRate,
    amount: normalizedHours * selectedHourlyRate,
    notes: params.notes || "",
  };

  if (existingCost && existingCost.projectId === projectId) {
    return updateProjectCost(projectId, existingCost.id, {
      ...existingCost,
      ...payload,
    });
  }

  if (existingCost) {
    await deleteProjectCost(existingCost.projectId, existingCost.id);
  }

  return createProjectCost(projectId, payload);
}

export async function removeActivityTimeEntryCost(params: {
  activityId: string;
  projectId?: string | null;
  previousProjectId?: string | null;
}) {
  const projectIds = [params.projectId, params.previousProjectId]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);

  if (!projectIds.length) {
    return null;
  }

  const candidateCosts = await listActivityTimeEntryCandidates(projectIds);
  const existingCost = findActivityTimeEntryCost(candidateCosts, params.activityId);

  if (!existingCost) {
    return null;
  }

  await deleteProjectCost(existingCost.projectId, existingCost.id);
  return null;
}

export async function removeGeneratedTimeEntryCost(params: {
  timeEntryId: string;
  projectId?: string | null;
  previousProjectId?: string | null;
}) {
  const projectIds = [params.projectId, params.previousProjectId]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);

  if (!projectIds.length) {
    return null;
  }

  const candidateCosts = await listActivityTimeEntryCandidates(projectIds);
  const existingCost = findGeneratedTimeEntryCost(candidateCosts, params.timeEntryId);

  if (!existingCost) {
    return null;
  }

  await deleteProjectCost(existingCost.projectId, existingCost.id);
  return null;
}
