import type { Sprint } from "@/lib/types";
import type { SprintFormData } from "@/components/forms/SprintForm";

import { createResource, deleteResource, getResource, listResource, updateResource } from "./crud";
import { requireId, toDateOrNull, toNumber } from "./utils";

const ENDPOINT = "/sprints";

export function listSprints(params?: Record<string, unknown>) {
  return listResource<Sprint>(ENDPOINT, params);
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
    project: null,
    lead: data.lead || null,
    goal: data.goal || "",
    status: data.status || "Planejada",
    start_at: toDateOrNull(data.startAt),
    end_at: toDateOrNull(data.endAt),
    capacity: toNumber(data.capacity, 0),
  };

  return mode === "edit" ? updateSprint(sprintId!, payload) : createSprint(payload);
}

export function toSprintFormData(sprint: Sprint): Partial<SprintFormData> {
  return {
    name: sprint.name,
    lead: sprint.lead || "",
    startAt: sprint.start_at || "",
    endAt: sprint.end_at || "",
    goal: sprint.goal || "",
    status: sprint.status || "Planejada",
    capacity: String(sprint.capacity ?? 0),
  };
}
