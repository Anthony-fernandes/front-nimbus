import type { TicketTimelineEvent, TicketVisibility } from "@/lib/types";

import { api } from "./api";
import type { Paginated } from "./crud";

const TIMELINE_ENDPOINTS = ["/ticket-events/", "/ticket-history/", "/ticket-comments/"];

function unwrapRows<T>(payload: Paginated<T> | T[]) {
  return Array.isArray(payload) ? payload : payload.results || [];
}

function isMissingEndpoint(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 405;
}

// Normalize a TicketComment (body/is_internal) → TicketTimelineEvent (message/visibility)
function normalizeEvent(raw: Record<string, unknown>): TicketTimelineEvent {
  const hasCommentFields = "body" in raw || "is_internal" in raw;
  if (!hasCommentFields) return raw as TicketTimelineEvent;
  return {
    ...raw,
    message: (raw.message as string | undefined) ?? (raw.body as string | undefined),
    visibility:
      (raw.visibility as TicketVisibility | undefined) ??
      ((raw.is_internal as boolean | undefined) === false ? "client" : "internal"),
    type: (raw.type as string | undefined) ?? "comment",
  } as TicketTimelineEvent;
}

async function tryTimelineRequest<T>(handler: (endpoint: string) => Promise<T>) {
  let lastError: unknown;

  for (const endpoint of TIMELINE_ENDPOINTS) {
    try {
      return await handler(endpoint);
    } catch (error) {
      lastError = error;
      if (!isMissingEndpoint(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Timeline indisponivel.");
}

export async function listTicketTimeline(ticketId: string) {
  try {
    return await tryTimelineRequest(async (endpoint) => {
      const response = await api.get<Paginated<Record<string, unknown>> | Record<string, unknown>[]>(
        endpoint,
        { params: { ticket: ticketId } },
      );
      return (unwrapRows(response.data) as Record<string, unknown>[]).map(normalizeEvent);
    });
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return [];
    }

    throw error;
  }
}

export async function createTicketTimelineComment(payload: {
  ticket: string;
  message: string;
  visibility?: TicketVisibility;
}) {
  return tryTimelineRequest(async (endpoint) => {
    // /ticket-comments/ uses body + is_internal; other endpoints use message + visibility
    const body =
      endpoint === "/ticket-comments/"
        ? {
            ticket: payload.ticket,
            body: payload.message,
            is_internal: payload.visibility !== "client",
          }
        : payload;

    const response = await api.post<Record<string, unknown>>(endpoint, body);
    return normalizeEvent(response.data);
  });
}
