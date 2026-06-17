import type { Ticket, TicketApprovalEntry } from "@/lib/types";

import { api } from "./api";
import { hydrateTicketWithWorkflow } from "./ticketWorkflowService";

const ENDPOINT = "/tickets";

function extractApiErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object") {
    const payload = data as Record<string, unknown>;
    const direct = payload.detail || payload.message || payload.error;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }
  return null;
}

function toServiceError(error: unknown, fallback: string) {
  const message = extractApiErrorMessage(error);
  if (message) return new Error(message);
  if (error instanceof Error && error.message) return error;
  return new Error(fallback);
}

async function decide(
  action: "approve" | "reject" | "request-changes",
  ticketId: string,
  comment?: string,
) {
  try {
    const response = await api.post<Ticket>(`${ENDPOINT}/${ticketId}/${action}/`, {
      comment: comment || "",
    });
    return hydrateTicketWithWorkflow(response.data);
  } catch (error) {
    throw toServiceError(error, "Nao foi possivel registrar a decisao de aprovacao.");
  }
}

export function approveTicket(ticketId: string, comment?: string) {
  return decide("approve", ticketId, comment);
}

export function rejectTicket(ticketId: string, comment?: string) {
  return decide("reject", ticketId, comment);
}

export function requestTicketChanges(ticketId: string, comment?: string) {
  return decide("request-changes", ticketId, comment);
}

export async function listTicketApprovals(ticketId: string) {
  const response = await api.get<TicketApprovalEntry[]>(`${ENDPOINT}/${ticketId}/approvals/`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function convertTicketToActivity(
  ticketId: string,
  payload: { project?: string | null; sprint?: string | null } = {},
) {
  try {
    const response = await api.post<{
      ticket: Ticket;
      activity_id: string;
      reason: string;
    }>(`${ENDPOINT}/${ticketId}/convert-to-activity/`, {
      project: payload.project ?? null,
      sprint: payload.sprint ?? null,
    });
    return response.data;
  } catch (error) {
    throw toServiceError(error, "Nao foi possivel converter o chamado em atividade.");
  }
}
