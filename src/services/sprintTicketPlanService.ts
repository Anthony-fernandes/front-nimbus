import type { SprintTicketPlan } from "@/lib/types";

import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./crud";
import { requireId, toNumber } from "./utils";

const ENDPOINT = "/sprint-ticket-plans";

function normalizeSprintTicketPlan(
  payload: Partial<SprintTicketPlan> & Record<string, unknown>,
): SprintTicketPlan {
  const responsibleIds = Array.isArray(payload.responsibleIds)
    ? payload.responsibleIds
    : Array.isArray(payload.responsible_ids)
      ? payload.responsible_ids
      : [];

  const rawUserHours = payload.userHours ?? (payload as Record<string, unknown>).user_hours;
  const userHours =
    rawUserHours && typeof rawUserHours === "object" && !Array.isArray(rawUserHours)
      ? (rawUserHours as Record<string, number>)
      : {};

  return {
    id: String(payload.id || ""),
    sprintId: String(payload.sprintId || payload.sprint_id || payload.sprint || ""),
    ticketId: String(payload.ticketId || payload.ticket_id || payload.ticket || ""),
    responsibleIds: responsibleIds.map((v) => String(v || "").trim()).filter(Boolean),
    userHours,
    priority: typeof payload.priority === "string" ? payload.priority : "Média",
    complexity: payload.complexity != null ? Number(payload.complexity) : undefined,
    plannedEndDate:
      typeof payload.plannedEndDate === "string"
        ? payload.plannedEndDate
        : typeof (payload as Record<string, unknown>).planned_end_date === "string"
          ? (payload as Record<string, unknown>).planned_end_date as string
          : "",
    plannedHours: Math.max(0, toNumber((payload.plannedHours ?? payload.planned_hours) as string | number | null | undefined, 0)),
    storyPoints:
      payload.storyPoints == null && payload.story_points == null
        ? undefined
        : Math.max(0, toNumber((payload.storyPoints ?? payload.story_points) as string | number | null | undefined, 0)),
    notes: typeof payload.notes === "string" ? payload.notes : "",
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

function buildPayload(payload: Partial<SprintTicketPlan>) {
  return {
    sprint: payload.sprintId || null,
    ticket: payload.ticketId || null,
    responsible_ids: Array.from(new Set((payload.responsibleIds || []).filter(Boolean))),
    user_hours: payload.userHours || {},
    planned_hours: Math.max(0, toNumber(payload.plannedHours, 0)),
    story_points: payload.storyPoints == null ? null : Math.max(0, toNumber(payload.storyPoints, 0)),
    priority: payload.priority || "Média",
    complexity: payload.complexity ?? null,
    planned_end_date: payload.plannedEndDate || null,
    notes: payload.notes || "",
  };
}

export async function listSprintTicketPlansBySprint(sprintId: string) {
  const rows = await listResource<SprintTicketPlan & Record<string, unknown>>(ENDPOINT, { sprint: sprintId });
  return rows.map((plan) => normalizeSprintTicketPlan(plan));
}

export async function saveSprintTicketPlan(
  payload: Partial<SprintTicketPlan>,
  mode: "create" | "edit",
  planId?: string,
) {
  requireId(mode, planId);
  if (!payload.sprintId) throw new Error("Sprint obrigatória.");
  if (!payload.ticketId) throw new Error("Chamado obrigatório.");

  const saved =
    mode === "edit" && planId
      ? await updateResource<SprintTicketPlan & Record<string, unknown>>(ENDPOINT, planId, buildPayload(payload))
      : await createResource<SprintTicketPlan & Record<string, unknown>>(ENDPOINT, buildPayload(payload));

  return normalizeSprintTicketPlan(saved);
}

export async function deleteSprintTicketPlan(planId: string) {
  await deleteResource(ENDPOINT, planId);
}
