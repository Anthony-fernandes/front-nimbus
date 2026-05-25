import type { Activity, ActivityTimeEntry, User } from "@/lib/types";

import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./crud";
import { requireId, toNumber } from "./utils";

const ENDPOINT = "/activity-time-entries";

function sortEntries(entries: ActivityTimeEntry[]) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left.date || left.createdAt || 0).getTime();
    const rightTime = new Date(right.date || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function resolveCollaboratorName(user?: Partial<User> | null, fallback = "") {
  return (
    user?.name
    || [user?.first_name, user?.last_name].filter(Boolean).join(" ")
    || user?.username
    || user?.email
    || fallback
    || "Colaborador"
  );
}

function normalizeTimeEntry(
  payload: Partial<ActivityTimeEntry> & Record<string, unknown>,
): ActivityTimeEntry {
  return {
    id: String(payload.id || ""),
    activityId: String(payload.activityId || payload.activity_id || payload.activity || ""),
    sprintId: String(payload.sprintId || payload.sprint_id || payload.sprint || ""),
    projectId: String(payload.projectId || payload.project_id || payload.project || ""),
    collaboratorId: String(
      payload.collaboratorId
      || payload.collaborator_id
      || payload.collaborator
      || payload.user
      || "",
    ),
    collaboratorName:
      typeof payload.collaboratorName === "string"
        ? payload.collaboratorName
        : typeof payload.collaborator_name === "string"
          ? payload.collaborator_name
          : typeof payload.user_name === "string"
            ? payload.user_name
            : "",
    date:
      typeof payload.date === "string"
        ? payload.date
        : new Date().toISOString().slice(0, 10),
    hours: Math.max(0, toNumber(payload.hours, 0)),
    workDescription:
      typeof payload.workDescription === "string"
        ? payload.workDescription
        : typeof payload.work_description === "string"
          ? payload.work_description
          : "",
    generatedCostId:
      typeof payload.generatedCostId === "string"
        ? payload.generatedCostId
        : typeof payload.generated_cost_id === "string"
          ? payload.generated_cost_id
          : undefined,
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

function buildTimeEntryPayload(
  payload: Partial<ActivityTimeEntry>,
  options: {
    activity: Pick<Activity, "id" | "project">;
    collaboratorName?: string;
  },
) {
  return {
    activity: payload.activityId || options.activity.id,
    sprint: payload.sprintId || null,
    project: payload.projectId || options.activity.project || null,
    collaborator: payload.collaboratorId || null,
    collaborator_name: payload.collaboratorName || options.collaboratorName || "",
    date: payload.date || "",
    hours: Math.max(0, toNumber(payload.hours, 0)),
    work_description: payload.workDescription || "",
  };
}

export async function listActivityTimeEntries(activityId?: string) {
  const rows = await listResource<ActivityTimeEntry & Record<string, unknown>>(ENDPOINT, activityId ? { activity: activityId } : undefined);
  return sortEntries(rows.map((entry) => normalizeTimeEntry(entry)));
}

export async function listSprintTimeEntries(sprintId: string) {
  const rows = await listResource<ActivityTimeEntry & Record<string, unknown>>(ENDPOINT, { sprint: sprintId });
  return sortEntries(rows.map((entry) => normalizeTimeEntry(entry)));
}

export async function saveActivityTimeEntry(
  payload: Partial<ActivityTimeEntry>,
  options: {
    mode: "create" | "edit";
    entryId?: string;
    activity: Pick<Activity, "id" | "project">;
    collaborator?: Partial<User> | null;
  },
) {
  requireId(options.mode, options.entryId);

  const collaboratorId = String(payload.collaboratorId || "").trim();
  const date = String(payload.date || "").trim();
  const hours = Math.max(0, toNumber(payload.hours, 0));

  if (!collaboratorId) {
    throw new Error("Selecione o colaborador do apontamento.");
  }

  if (!date) {
    throw new Error("Informe a data do apontamento.");
  }

  if (hours <= 0) {
    throw new Error("Informe quantas horas foram trabalhadas.");
  }

  const requestPayload = buildTimeEntryPayload(payload, {
    activity: options.activity,
    collaboratorName: resolveCollaboratorName(options.collaborator, payload.collaboratorName),
  });
  const saved =
    options.mode === "edit" && options.entryId
      ? await updateResource<ActivityTimeEntry & Record<string, unknown>>(ENDPOINT, options.entryId, requestPayload)
      : await createResource<ActivityTimeEntry & Record<string, unknown>>(ENDPOINT, requestPayload);

  return normalizeTimeEntry(saved);
}

export async function deleteActivityTimeEntry(entryId: string) {
  await deleteResource(ENDPOINT, entryId);
  return null;
}
