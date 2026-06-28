import type { SprintParticipant } from "@/lib/types";

import { createResource, deleteResource, listResource, updateResource } from "./crud";
import { requireId, toNumber } from "./utils";

const ENDPOINT = "/sprint-participants";

function normalize(p: Partial<SprintParticipant> & Record<string, unknown>): SprintParticipant {
  const hoursPerDay = toNumber((p.hoursPerDay ?? p.hours_per_day) as number | null, 8);
  const workingDays = toNumber((p.workingDays ?? p.working_days) as number | null, 0);
  const availabilityFactor = toNumber((p.availabilityFactor ?? p.availability_factor) as number | null, 100);
  return {
    id: String(p.id || ""),
    sprintId: String(p.sprintId || p.sprint_id || p.sprint || ""),
    userId: String(p.userId || p.user_id || p.user || ""),
    userName: (p.userName as string) || (p.user_name as string) || undefined,
    teamId: (p.teamId as string) || (p.team_id as string) || (p.team as string) || null,
    teamName: (p.teamName as string) || (p.team_name as string) || null,
    inclusionMode: ((p.inclusionMode ?? p.inclusion_mode) as "team" | "manual") || "manual",
    hoursPerDay,
    workingDays,
    availabilityFactor,
    capacity: typeof p.capacity === "number" ? p.capacity : hoursPerDay * workingDays * (availabilityFactor / 100),
    storyPointsPlanned: toNumber((p.storyPointsPlanned ?? p.story_points_planned) as number | null, 0),
    storyPointsCompleted: toNumber((p.storyPointsCompleted ?? p.story_points_completed) as number | null, 0),
    hoursPlanned: toNumber((p.hoursPlanned ?? p.hours_planned) as number | null, 0),
    hoursExecuted: toNumber((p.hoursExecuted ?? p.hours_executed) as number | null, 0),
    isAvailable: (p.isAvailable ?? p.is_available) !== false,
    notes: (p.notes as string) || "",
    createdAt: (p.createdAt as string) || (p.created_at as string) || undefined,
  };
}

function buildPayload(p: Partial<SprintParticipant>) {
  return {
    sprint: p.sprintId || null,
    user: p.userId || null,
    team: p.teamId || null,
    inclusion_mode: p.inclusionMode || "manual",
    hours_per_day: toNumber(p.hoursPerDay, 8),
    working_days: toNumber(p.workingDays, 0),
    availability_factor: toNumber(p.availabilityFactor, 100),
    story_points_planned: toNumber(p.storyPointsPlanned, 0),
    story_points_completed: toNumber(p.storyPointsCompleted, 0),
    hours_planned: toNumber(p.hoursPlanned, 0),
    hours_executed: toNumber(p.hoursExecuted, 0),
    is_available: p.isAvailable !== false,
    notes: p.notes || "",
  };
}

export async function listSprintParticipants(sprintId: string) {
  const rows = await listResource<SprintParticipant & Record<string, unknown>>(ENDPOINT, { sprint: sprintId });
  return rows.map(normalize);
}

export async function saveSprintParticipant(
  payload: Partial<SprintParticipant>,
  mode: "create" | "edit",
  participantId?: string,
) {
  requireId(mode, participantId);
  if (!payload.sprintId) throw new Error("Sprint obrigatória.");
  if (!payload.userId) throw new Error("Usuário obrigatório.");
  const saved =
    mode === "edit" && participantId
      ? await updateResource<SprintParticipant & Record<string, unknown>>(ENDPOINT, participantId, buildPayload(payload))
      : await createResource<SprintParticipant & Record<string, unknown>>(ENDPOINT, buildPayload(payload));
  return normalize(saved);
}

export async function deleteSprintParticipant(participantId: string) {
  await deleteResource(ENDPOINT, participantId);
}
