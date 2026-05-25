import type { Activity } from "@/lib/types";
import type { ActivityFormData } from "@/components/forms/ActivityForm";
import {
  getActivityTagFormState,
  listActivityTags,
  resolveActivityTagNames,
} from "@/services/activityTagService";

import {
  createResource,
  deleteResource,
  getResource,
  listResource,
  updateResource,
} from "./crud";
import { requireId, toNumber } from "./utils";

const ENDPOINT = "/activities";

type SaveMode = "create" | "edit";

function buildLegacyPayload(data: ActivityFormData, configuredTags: Awaited<ReturnType<typeof listActivityTags>>) {
  return {
    title: data.title,
    description: data.description || "",
    type: data.type || "Tarefa",
    status: data.status || "Backlog",
    priority: data.priority || "Media",
    assignee: data.assignee || null,
    project: data.project || null,
    ticket: data.ticket || null,
    est_hours: toNumber(data.estHours, 0),
    tags: resolveActivityTagNames(data.tagIds, configuredTags, data.legacyTagNames),
  };
}

function buildExtendedPayload(
  data: ActivityFormData,
  configuredTags: Awaited<ReturnType<typeof listActivityTags>>,
) {
  return {
    ...buildLegacyPayload(data, configuredTags),
    calculate_hourly_cost: Boolean(data.calculateHourlyCost),
  };
}

function getStatusCode(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status;
}

function canRetryWithLegacyPayload(error: unknown) {
  const status = getStatusCode(error);
  return status === 400 || status === 404;
}

async function persistActivityPayload(
  mode: SaveMode,
  payload: Record<string, unknown>,
  legacyPayload: Record<string, unknown>,
  activityId?: string,
) {
  try {
    return mode === "edit"
      ? await updateActivity(activityId!, payload)
      : await createActivity(payload);
  } catch (error) {
    if (
      !canRetryWithLegacyPayload(error)
      || JSON.stringify(payload) === JSON.stringify(legacyPayload)
    ) {
      throw error;
    }

    return mode === "edit"
      ? await updateActivity(activityId!, legacyPayload)
      : await createActivity(legacyPayload);
  }
}

export function listActivities(params?: Record<string, unknown>) {
  return listResource<Activity>(ENDPOINT, params);
}

export function getActivity(id: string) {
  return getResource<Activity>(ENDPOINT, id);
}

export function createActivity(payload: Partial<Activity> | Record<string, unknown>) {
  return createResource<Activity>(ENDPOINT, payload);
}

export function updateActivity(
  id: string,
  payload: Partial<Activity> | Record<string, unknown>,
) {
  return updateResource<Activity>(ENDPOINT, id, payload);
}

export function deleteActivity(id: string) {
  return deleteResource(ENDPOINT, id);
}

export async function saveActivity(
  data: ActivityFormData,
  mode: SaveMode,
  activityId?: string,
) {
  requireId(mode, activityId);
  const configuredTags = await listActivityTags();

  const legacyPayload = buildLegacyPayload(data, configuredTags);
  const extendedPayload = buildExtendedPayload(data, configuredTags);

  return persistActivityPayload(mode, extendedPayload, legacyPayload, activityId);
}

export function toActivityFormData(activity: Activity): Partial<ActivityFormData> {
  const calculateHourlyCost =
    typeof activity.calculateHourlyCost === "boolean"
      ? activity.calculateHourlyCost
      : Boolean(activity.calculate_hourly_cost);
  return {
    title: activity.title,
    description: activity.description || "",
    type: activity.type || "Tarefa",
    status: activity.status || "Backlog",
    priority: activity.priority || "Media",
    calculateHourlyCost,
    assignee: activity.assignee || "",
    project: activity.project || "",
    ticket: activity.ticket || "",
    estHours: String(activity.est_hours ?? 0),
    tagIds: [],
    legacyTagNames: getActivityTagFormState(activity).legacyTagNames,
  };
}
