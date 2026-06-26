import type { TicketTimelineEvent, TicketVisibility } from "@/lib/types";

import { api } from "./api";
import type { Paginated } from "./crud";

const TIMELINE_ENDPOINTS = ["/activity-events/", "/activity-history/", "/activity-comments/"];

function unwrapRows<T>(payload: Paginated<T> | T[]) {
  return Array.isArray(payload) ? payload : payload.results || [];
}

function isMissingEndpoint(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 405;
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

export async function listActivityTimeline(activityId: string) {
  try {
    return await tryTimelineRequest(async (endpoint) => {
      const response = await api.get<Paginated<TicketTimelineEvent> | TicketTimelineEvent[]>(
        endpoint,
        { params: { activity: activityId } },
      );
      return unwrapRows(response.data);
    });
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return [];
    }

    throw error;
  }
}

export async function createActivityTimelineComment(payload: {
  activity: string;
  message: string;
  visibility?: TicketVisibility;
}) {
  return tryTimelineRequest(async (endpoint) => {
    const response = await api.post<TicketTimelineEvent>(endpoint, payload);
    return response.data;
  });
}
