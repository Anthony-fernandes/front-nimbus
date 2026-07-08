import type { Sprint, SprintRetrospective, SprintReview, SprintVelocityEntry } from "@/lib/types";
import type { SprintFormData } from "@/components/forms/SprintForm";

import { createResource, deleteResource, getResource, listResource, updateResource } from "./crud";
import { requireId, toDateOrNull, toNumber } from "./utils";
import { api } from "./api";

const ENDPOINT = "/sprints";

export function listSprints(params?: Record<string, unknown>) {
  return listResource<Sprint>(ENDPOINT, params);
}

export type SprintMetrics = {
  total_items: number;
  activities: number;
  tickets: number;
  done: number;
  in_progress: number;
  pending: number;
  blocked: number;
  story_points_planned: number;
  story_points_done: number;
  hours_planned: number;
  hours_done: number;
  capacity: number;
  capacity_used_pct: number;
  progress_pct: number;
};

export function getSprintMetrics(id: string) {
  return api.get<SprintMetrics>(`/sprints/${id}/metrics/`).then((r) => r.data);
}

export function getSprint(id: string) {
  return getResource<Sprint>(ENDPOINT, id);
}

export function createSprint(payload: Partial<Sprint>) {
  return createResource<Sprint>(ENDPOINT, payload);
}

export function updateSprint(id: string, payload: Partial<Sprint>) {
  return updateResource<Sprint>(ENDPOINT, id, payload);
}

export function deleteSprint(id: string) {
  return deleteResource(ENDPOINT, id);
}

export async function saveSprint(data: SprintFormData, mode: "create" | "edit", sprintId?: string) {
  requireId(mode, sprintId);

  const payload = {
    name: data.name,
    goal: data.goal || "",
    observations: data.observations || "",
    status: data.status || "Planejada",
    start_at: toDateOrNull(data.startAt),
    end_at: toDateOrNull(data.endAt),
  };

  return mode === "edit" ? updateSprint(sprintId!, payload) : createSprint(payload);
}

export function toSprintFormData(sprint: Sprint): Partial<SprintFormData> {
  return {
    name: sprint.name,
    startAt: sprint.start_at || "",
    endAt: sprint.end_at || "",
    goal: sprint.goal || "",
    observations: sprint.observations || "",
    status: sprint.status || "Planejada",
  };
}

export function getSprintRetrospective(sprintId: string) {
  return api.get<SprintRetrospective[]>(`/sprints/retrospectives/?sprint=${sprintId}`).then((r) => {
    const data = r.data;
    if (Array.isArray(data)) return data[0] || null;
    return null;
  });
}

export function saveSprintRetrospective(
  payload: { sprint: string; went_well: string; to_improve: string; action_items: unknown[] },
  existingId?: string,
) {
  if (existingId) {
    return api.patch<SprintRetrospective>(`/sprints/retrospectives/${existingId}/`, payload).then((r) => r.data);
  }
  return api.post<SprintRetrospective>("/sprints/retrospectives/", payload).then((r) => r.data);
}

export function getSprintReview(sprintId: string) {
  return api.get<SprintReview[]>(`/sprints/reviews/?sprint=${sprintId}`).then((r) => {
    const data = r.data;
    if (Array.isArray(data)) return data[0] || null;
    return null;
  });
}

export function startSprint(sprintId: string, payload: { force?: boolean } = {}) {
  return api.post<{ detail: string; status: string }>(`/sprints/${sprintId}/start/`, payload).then((r) => r.data);
}

export function closeSprint(sprintId: string, payload: { notes?: string }) {
  return api.post<SprintReview>(`/sprints/${sprintId}/close/`, payload).then((r) => r.data);
}

export function getSprintVelocity() {
  return api.get<{ sprints: SprintVelocityEntry[]; avg_velocity: number }>("/sprints/velocity/").then((r) => r.data);
}
