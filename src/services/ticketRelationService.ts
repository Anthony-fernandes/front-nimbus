import { api } from "./api";
import type { TicketRelation } from "@/lib/types";

export function listTicketRelations(ticketId: string) {
  return api.get<TicketRelation[]>(`/tickets/relations/?ticket=${ticketId}`).then((r) => r.data);
}

export function createTicketRelation(payload: {
  ticket: string;
  related_ticket: string;
  relation_type: string;
}) {
  return api.post<TicketRelation>("/tickets/relations/", payload).then((r) => r.data);
}

export function deleteTicketRelation(id: string) {
  return api.delete(`/tickets/relations/${id}/`);
}

export function listTicketStatusHistory(ticketId: string) {
  return api
    .get<
      | { results?: import("@/lib/types").TicketStatusHistoryEntry[]; count?: number }
      | import("@/lib/types").TicketStatusHistoryEntry[]
    >(`/tickets/status-history/?ticket=${ticketId}`)
    .then((r) => {
      const data = r.data;
      if (Array.isArray(data)) return data;
      return data.results || [];
    });
}

export function reopenTicket(ticketId: string) {
  return api
    .post<{ detail: string; reopen_count: number }>(`/tickets/${ticketId}/reopen/`)
    .then((r) => r.data);
}
