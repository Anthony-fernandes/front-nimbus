import { api } from "@/services/api";
import type { Activity, Ticket } from "@/lib/types";
import {
  activityToWorkItem,
  ticketToWorkItem,
  type WorkItem,
  type WorkItemComment,
  type WorkItemHistoryEvent,
  type WorkItemNoteType,
  type WorkItemRef,
  type WorkItemSubtask,
  type WorkItemTimeLog,
} from "@/lib/workItem";

function isTicketRef(ref: WorkItemRef) {
  return ref.type === "ticket";
}

// ── Item ────────────────────────────────────────────────────────────

export async function getWorkItem(ref: WorkItemRef): Promise<WorkItem> {
  if (isTicketRef(ref)) {
    const { data } = await api.get<Ticket>(`/tickets/${ref.id}/`);
    return ticketToWorkItem(data);
  }
  const { data } = await api.get<Activity>(`/activities/${ref.id}/`);
  return activityToWorkItem(data, ref.type);
}

// ── Conversa ────────────────────────────────────────────────────────

type RawComment = {
  id: string;
  author_name?: string;
  author_display?: string;
  body?: string;
  note_type?: string;
  is_internal?: boolean;
  created_at: string;
};

function normalizeComment(raw: RawComment): WorkItemComment {
  const noteType = (raw.note_type ||
    (raw.is_internal ? "internal" : "public")) as WorkItemComment["noteType"];
  return {
    id: raw.id,
    authorName: raw.author_display || raw.author_name || "Sistema",
    body: raw.body || "",
    noteType,
    createdAt: raw.created_at,
  };
}

export async function listWorkItemComments(ref: WorkItemRef): Promise<WorkItemComment[]> {
  const url = isTicketRef(ref)
    ? `/ticket-comments/?ticket=${ref.id}`
    : `/activity-comments/?activity=${ref.id}`;
  const { data } = await api.get<RawComment[] | { results: RawComment[] }>(url);
  const rows = Array.isArray(data) ? data : data.results || [];
  return rows.map(normalizeComment);
}

export async function createWorkItemComment(
  ref: WorkItemRef,
  payload: { body: string; noteType: WorkItemNoteType },
): Promise<void> {
  if (isTicketRef(ref)) {
    await api.post("/ticket-comments/", {
      ticket: ref.id,
      body: payload.body,
      note_type: payload.noteType,
    });
    return;
  }
  await api.post("/activity-comments/", {
    activity: ref.id,
    body: payload.body,
    note_type: payload.noteType,
  });
}

// ── Tempo ───────────────────────────────────────────────────────────

type RawTimeEntry = {
  id: string;
  collaborator_name?: string;
  collaboratorName?: string;
  collaborator_display?: string;
  date: string;
  hours: string | number;
  work_description?: string;
  workDescription?: string;
};

function normalizeTimeEntry(raw: RawTimeEntry): WorkItemTimeLog {
  return {
    id: raw.id,
    collaboratorName:
      raw.collaborator_display || raw.collaboratorName || raw.collaborator_name || "—",
    date: raw.date,
    hours: Number(raw.hours || 0),
    description: raw.workDescription ?? raw.work_description ?? "",
  };
}

export async function listWorkItemTimeLogs(ref: WorkItemRef): Promise<WorkItemTimeLog[]> {
  const url = isTicketRef(ref)
    ? `/ticket-time-entries/?ticket=${ref.id}`
    : `/activity-time-entries/?activity=${ref.id}`;
  const { data } = await api.get<RawTimeEntry[] | { results: RawTimeEntry[] }>(url);
  const rows = Array.isArray(data) ? data : data.results || [];
  return rows.map(normalizeTimeEntry);
}

export async function logWorkItemTime(
  ref: WorkItemRef,
  payload: { date: string; hours: number; description: string; sprintId?: string | null; projectId?: string | null },
): Promise<void> {
  if (isTicketRef(ref)) {
    await api.post("/ticket-time-entries/", {
      ticket: ref.id,
      date: payload.date,
      hours: payload.hours,
      work_description: payload.description,
    });
    return;
  }
  await api.post("/activity-time-entries/", {
    activity: ref.id,
    sprint: payload.sprintId || null,
    project: payload.projectId || null,
    date: payload.date,
    hours: payload.hours,
    work_description: payload.description,
  });
}

// ── Histórico (auditoria + status history de ticket) ────────────────

type RawAudit = {
  id: string;
  actor_name?: string;
  action: string;
  description?: string;
  created_at: string;
};

type RawStatusHistory = {
  id: string;
  changed_by_name?: string;
  status_from?: string;
  status_to?: string;
  reason?: string;
  created_at: string;
};

export async function listWorkItemHistory(ref: WorkItemRef): Promise<WorkItemHistoryEvent[]> {
  const entityType = isTicketRef(ref) ? "ticket" : "activity";
  const requests: Promise<WorkItemHistoryEvent[]>[] = [
    api
      .get<{ results?: RawAudit[] } | RawAudit[]>(
        `/audit-logs/?entity_type=${entityType}&entity_id=${ref.id}&page_size=100`,
      )
      .then(({ data }) => {
        const rows = Array.isArray(data) ? data : data.results || [];
        return rows.map((r) => ({
          id: `audit-${r.id}`,
          actorName: r.actor_name || "Sistema",
          description: r.description || r.action,
          action: r.action,
          createdAt: r.created_at,
        }));
      })
      .catch(() => []),
  ];
  if (isTicketRef(ref)) {
    requests.push(
      api
        .get<{ results?: RawStatusHistory[] } | RawStatusHistory[]>(
          `/tickets/status-history/?ticket=${ref.id}`,
        )
        .then(({ data }) => {
          const rows = Array.isArray(data) ? data : data.results || [];
          return rows.map((r) => ({
            id: `status-${r.id}`,
            actorName: r.changed_by_name || "Sistema",
            description: r.reason
              ? `Status: ${r.status_from || "—"} → ${r.status_to}. ${r.reason}`
              : `Status: ${r.status_from || "—"} → ${r.status_to}`,
            action: "status_change",
            createdAt: r.created_at,
          }));
        })
        .catch(() => []),
    );
  }
  const results = await Promise.all(requests);
  return results
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ── Mutations de fluxo ──────────────────────────────────────────────

export async function updateWorkItemStatus(
  ref: WorkItemRef,
  status: string,
  reason?: string,
): Promise<void> {
  if (isTicketRef(ref)) {
    await api.patch(`/tickets/${ref.id}/`, {
      status,
      ...(reason ? { status_change_reason: reason } : {}),
    });
    return;
  }
  await api.patch(`/activities/${ref.id}/`, {
    status,
    ...(reason ? { status_reason: reason.slice(0, 255) } : {}),
  });
}

export async function updateWorkItemResponsible(ref: WorkItemRef, userId: string): Promise<void> {
  if (isTicketRef(ref)) {
    await api.patch(`/tickets/${ref.id}/`, { responsible_technician: userId });
    return;
  }
  await api.patch(`/activities/${ref.id}/`, { assignee: userId });
}

export async function updateWorkItemSubtasks(
  ref: WorkItemRef,
  subtasks: WorkItemSubtask[],
): Promise<void> {
  const url = isTicketRef(ref) ? `/tickets/${ref.id}/` : `/activities/${ref.id}/`;
  await api.patch(url, { checklist: subtasks });
}

export async function resolveWorkItem(
  ref: WorkItemRef,
  payload: {
    resolutionType: string;
    resolutionNotes: string;
    messageToRequester?: string;
    sendToRequester?: boolean;
  },
): Promise<void> {
  const url = isTicketRef(ref) ? `/tickets/${ref.id}/resolve/` : `/activities/${ref.id}/resolve/`;
  await api.post(url, {
    resolution_type: payload.resolutionType,
    resolution_notes: payload.resolutionNotes,
    message_to_requester: payload.messageToRequester || "",
    send_to_requester: Boolean(payload.sendToRequester),
  });
}

export async function reopenWorkItem(ref: WorkItemRef, reason: string): Promise<void> {
  const url = isTicketRef(ref) ? `/tickets/${ref.id}/reopen/` : `/activities/${ref.id}/reopen/`;
  await api.post(url, { reason });
}

// ── Subchamados (apenas tickets) ────────────────────────────────────

type RawRelation = {
  id: string;
  related_ticket: string;
  related_ticket_code?: string;
  related_ticket_title?: string;
  related_ticket_status?: string;
  related_ticket_responsible?: string;
  related_ticket_category?: string;
  relation_type: string;
  blocks_parent?: boolean;
};

export async function listWorkItemSubTickets(ref: WorkItemRef) {
  if (ref.type !== "ticket") return [];
  const { data } = await api.get<RawRelation[] | { results: RawRelation[] }>(
    `/tickets/relations/?ticket=${ref.id}&relation_type=subchamado`,
  );
  const rows = Array.isArray(data) ? data : data.results || [];
  return rows.map((r) => ({
    id: r.id,
    ticketId: r.related_ticket,
    code: r.related_ticket_code || r.related_ticket.slice(0, 8),
    title: r.related_ticket_title || "",
    status: r.related_ticket_status || "Aberto",
    responsibleName: r.related_ticket_responsible || "",
    category: r.related_ticket_category || "",
    blocksParent: Boolean(r.blocks_parent),
  }));
}

export async function linkWorkItemSubTicket(
  ref: WorkItemRef,
  subTicketId: string,
  blocksParent: boolean,
): Promise<void> {
  await api.post("/tickets/relations/", {
    ticket: ref.id,
    related_ticket: subTicketId,
    relation_type: "subchamado",
    blocks_parent: blocksParent,
  });
}
