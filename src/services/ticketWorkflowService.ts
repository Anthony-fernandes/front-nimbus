import { ticketStatusHistoryToTimelineEvents } from "@/lib/ticketWorkflow";
import type {
  Ticket,
  TicketStatusHistory,
  TicketTimelineEvent,
  TicketWorkflowMeta,
  TicketWorkflowStatusConfig,
} from "@/lib/types";

import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./crud";

const ENDPOINT = "/ticket-workflow-statuses";

function normalizeStatusConfig(
  payload: TicketWorkflowStatusConfig & Record<string, unknown>,
): TicketWorkflowStatusConfig {
  return {
    ...payload,
    active: payload.active !== false,
    pauses_sla: Boolean(payload.pauses_sla),
    is_final: Boolean(payload.is_final),
    allows_resume: Boolean(payload.allows_resume),
    order: typeof payload.order === "number" ? payload.order : 999,
    origin_statuses: Array.isArray(payload.origin_statuses) ? payload.origin_statuses : [],
    next_statuses: Array.isArray(payload.next_statuses) ? payload.next_statuses : [],
    system: Boolean(payload.system),
    item_type: payload.item_type === "activity" ? "activity" : "ticket",
    phase: typeof payload.phase === "string" ? payload.phase : "",
    permissions:
      payload.permissions && typeof payload.permissions === "object"
        ? (payload.permissions as Record<string, boolean>)
        : {},
    requirements:
      payload.requirements && typeof payload.requirements === "object"
        ? (payload.requirements as Record<string, boolean>)
        : {},
  };
}

function buildStatusPayload(payload: Partial<TicketWorkflowStatusConfig>) {
  return {
    name: payload.name || "",
    slug: payload.slug || payload.name || "",
    description: payload.description || "",
    color: payload.color || "",
    active: payload.active ?? true,
    pauses_sla: Boolean(payload.pauses_sla),
    is_final: Boolean(payload.is_final),
    allows_resume: Boolean(payload.allows_resume),
    order: typeof payload.order === "number" ? payload.order : 999,
    origin_statuses: payload.origin_statuses || [],
    next_statuses: payload.next_statuses || [],
    system: Boolean(payload.system),
    item_type: payload.item_type === "activity" ? "activity" : "ticket",
    phase: payload.phase || "",
    permissions: payload.permissions || {},
    requirements: payload.requirements || {},
  };
}

export async function listTicketWorkflowStatuses() {
  const rows = await listResource<TicketWorkflowStatusConfig & Record<string, unknown>>(ENDPOINT);
  return rows.map((status) => normalizeStatusConfig(status));
}

export async function saveTicketWorkflowStatus(
  payload: Partial<TicketWorkflowStatusConfig>,
  mode: "create" | "edit",
  statusId?: string,
) {
  const requestPayload = buildStatusPayload(payload);
  const saved =
    mode === "edit" && statusId
      ? await updateResource<TicketWorkflowStatusConfig & Record<string, unknown>>(ENDPOINT, statusId, requestPayload)
      : await createResource<TicketWorkflowStatusConfig & Record<string, unknown>>(ENDPOINT, requestPayload);

  return normalizeStatusConfig(saved);
}

export async function deleteTicketWorkflowStatus(statusId: string) {
  await deleteResource(ENDPOINT, statusId);
}

export function getTicketWorkflowMeta(_ticketId: string) {
  return null;
}

export function saveTicketWorkflowMeta(
  _ticketId: string,
  _patch:
    | Partial<TicketWorkflowMeta>
    | ((current: TicketWorkflowMeta | null) => Partial<TicketWorkflowMeta> | null),
) {
  return null;
}

export function appendTicketWorkflowHistory(
  _ticket: Pick<Ticket, "id">,
  _entry: TicketStatusHistory,
  _patch?: Partial<TicketWorkflowMeta>,
) {
  return null;
}

export function registerTicketLinkedActivity(
  _ticketId: string,
  _activity: {
    id: string;
    title: string;
    project?: string | null;
  },
) {
  return null;
}

export function hydrateTicketWithWorkflow(ticket: Ticket) {
  return ticket;
}

export function hydrateTicketListWithWorkflow(tickets: Ticket[]) {
  return tickets;
}

export function listTicketWorkflowTimelineEvents(ticket: Ticket): TicketTimelineEvent[] {
  return [
    ...ticketStatusHistoryToTimelineEvents(ticket, ticket.status_history || []),
    ...(ticket.timeline || []),
  ]
    .filter((event) => event.message)
    .sort((left, right) => {
      const leftTime = new Date(left.created_at || 0).getTime();
      const rightTime = new Date(right.created_at || 0).getTime();
      return rightTime - leftTime;
    });
}
