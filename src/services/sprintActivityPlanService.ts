import type { SprintActivityPlan } from "@/lib/types";

import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./crud";
import { requireId, toNumber } from "./utils";

const ENDPOINT = "/sprint-activity-plans";

function sortPlans(plans: SprintActivityPlan[]) {
  return [...plans].sort((left, right) => {
    const leftOrder = typeof left.order === "number" ? left.order : Number.MAX_SAFE_INTEGER;
    const rightOrder = typeof right.order === "number" ? right.order : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftTime = new Date(left.createdAt || 0).getTime();
    const rightTime = new Date(right.createdAt || 0).getTime();
    return leftTime - rightTime;
  });
}

function normalizeSprintActivityPlan(
  payload: Partial<SprintActivityPlan> & Record<string, unknown>,
): SprintActivityPlan {
  const responsibleIds = Array.isArray(payload.responsibleIds)
    ? payload.responsibleIds
    : Array.isArray(payload.responsible_ids)
      ? payload.responsible_ids
      : [];

  return {
    id: String(payload.id || ""),
    sprintId: String(payload.sprintId || payload.sprint_id || payload.sprint || ""),
    activityId: String(payload.activityId || payload.activity_id || payload.activity || ""),
    projectId: String(payload.projectId || payload.project_id || payload.project || ""),
    responsibleIds: responsibleIds
      .map((value) => String(value || "").trim())
      .filter(Boolean),
    plannedHours: Math.max(0, toNumber(payload.plannedHours ?? payload.planned_hours, 0)),
    storyPoints:
      payload.storyPoints == null && payload.story_points == null
        ? undefined
        : Math.max(0, toNumber(payload.storyPoints ?? payload.story_points, 0)),
    plannedStartDate:
      typeof payload.plannedStartDate === "string"
        ? payload.plannedStartDate
        : typeof payload.planned_start_date === "string"
          ? payload.planned_start_date
          : "",
    plannedEndDate:
      typeof payload.plannedEndDate === "string"
        ? payload.plannedEndDate
        : typeof payload.planned_end_date === "string"
          ? payload.planned_end_date
          : "",
    order:
      payload.order == null
        ? undefined
        : Math.max(0, toNumber(payload.order, 0)),
    notes:
      typeof payload.notes === "string"
        ? payload.notes
        : "",
    createdAt:
      typeof payload.createdAt === "string"
        ? payload.createdAt
        : typeof payload.created_at === "string"
          ? payload.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof payload.updatedAt === "string"
        ? payload.updatedAt
        : typeof payload.updated_at === "string"
          ? payload.updated_at
          : undefined,
  };
}

function buildSprintActivityPlanPayload(payload: Partial<SprintActivityPlan>) {
  return {
    sprint: payload.sprintId || null,
    activity: payload.activityId || null,
    project: payload.projectId || null,
    responsible_ids: Array.from(new Set((payload.responsibleIds || []).filter(Boolean))),
    planned_hours: Math.max(0, toNumber(payload.plannedHours, 0)),
    story_points:
      payload.storyPoints == null
        ? null
        : Math.max(0, toNumber(payload.storyPoints, 0)),
    planned_start_date: payload.plannedStartDate || null,
    planned_end_date: payload.plannedEndDate || null,
    order:
      payload.order == null
        ? null
        : Math.max(0, toNumber(payload.order, 0)),
    notes: payload.notes || "",
  };
}

export async function listSprintActivityPlans() {
  const rows = await listResource<SprintActivityPlan & Record<string, unknown>>(ENDPOINT);
  return sortPlans(rows.map((plan) => normalizeSprintActivityPlan(plan)));
}

export async function listSprintPlansBySprint(sprintId: string) {
  const rows = await listResource<SprintActivityPlan & Record<string, unknown>>(ENDPOINT, { sprint: sprintId });
  return sortPlans(rows.map((plan) => normalizeSprintActivityPlan(plan)));
}

export async function listSprintPlansByActivity(activityId: string) {
  const rows = await listResource<SprintActivityPlan & Record<string, unknown>>(ENDPOINT, { activity: activityId });
  return sortPlans(rows.map((plan) => normalizeSprintActivityPlan(plan)));
}

export async function saveSprintActivityPlan(
  payload: Partial<SprintActivityPlan>,
  mode: "create" | "edit",
  planId?: string,
) {
  requireId(mode, planId);

  if (!payload.sprintId) {
    throw new Error("Selecione a sprint do planejamento.");
  }

  if (!payload.activityId) {
    throw new Error("Selecione a atividade que sera planejada.");
  }

  const plannedHours = Math.max(0, toNumber(payload.plannedHours, 0));

  if (plannedHours <= 0) {
    throw new Error("Informe as horas planejadas para esta sprint.");
  }

  const requestPayload = buildSprintActivityPlanPayload(payload);
  const saved =
    mode === "edit" && planId
      ? await updateResource<SprintActivityPlan & Record<string, unknown>>(ENDPOINT, planId, requestPayload)
      : await createResource<SprintActivityPlan & Record<string, unknown>>(ENDPOINT, requestPayload);

  return normalizeSprintActivityPlan(saved);
}

export async function deleteSprintActivityPlan(planId: string) {
  await deleteResource(ENDPOINT, planId);
}
