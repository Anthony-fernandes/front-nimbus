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
    userName: typeof p.userName === "string" ? p.userName : typeof p.user_name === "string" ? p.user_name as string : undefined,
    hoursPerDay,
    workingDays,
    availabilityFactor,
    capacity: typeof p.capacity === "number" ? p.capacity : hoursPerDay * workingDays * (availabilityFactor / 100),
    createdAt: typeof p.createdAt === "string" ? p.createdAt : typeof p.created_at === "string" ? p.created_at as string : undefined,
  };
}

function buildPayload(p: Partial<SprintParticipant>) {
  return {
    sprint: p.sprintId || null,
    user: p.userId || null,
    hours_per_day: toNumber(p.hoursPerDay, 8),
    working_days: toNumber(p.workingDays, 0),
    availability_factor: toNumber(p.availabilityFactor, 100),
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
