import type { Activity, Ticket } from "@/lib/types";

/**
 * Camada de normalização "Work Item": trata chamados, atividades de projeto,
 * atividades de sprint e cards do kanban com a MESMA estrutura de atendimento
 * (conversa, execução, resolução, histórico), sem destruir os modelos atuais.
 */

export type WorkItemType =
  | "ticket"
  | "project_activity"
  | "sprint_activity"
  | "kanban_card"
  | "bug"
  | "improvement"
  | "internal_task";

export type WorkItemNoteType = "public" | "internal" | "technical" | "resolution";

export type WorkItemRef = {
  type: WorkItemType;
  id: string;
};

export type WorkItemSubtask = {
  text: string;
  done: boolean;
  required?: boolean;
  responsible?: string;
};

export type WorkItem = {
  ref: WorkItemRef;
  /** entidade backend por trás do item: ticket | activity */
  backend: "ticket" | "activity";
  code: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  requesterName?: string;
  clientName?: string;
  projectId?: string | null;
  projectName?: string;
  sprintId?: string | null;
  sprintName?: string;
  category?: string;
  responsibleId?: string | null;
  responsibleName?: string;
  slaDueAt?: string | null;
  dueAt?: string | null;
  createdAt?: string;
  estHours?: number;
  subtasks: WorkItemSubtask[];
  resolutionType?: string;
  resolutionNotes?: string;
  resolvedByName?: string;
  resolvedAt?: string | null;
  reopenCount?: number;
  tags?: string[];
  raw: Ticket | Activity;
};

export type WorkItemComment = {
  id: string;
  authorName: string;
  body: string;
  noteType: WorkItemNoteType;
  createdAt: string;
};

export type WorkItemTimeLog = {
  id: string;
  collaboratorName: string;
  date: string;
  hours: number;
  description: string;
};

export type WorkItemHistoryEvent = {
  id: string;
  actorName: string;
  description: string;
  action: string;
  createdAt: string;
};

export const WORK_ITEM_TYPE_LABELS: Record<WorkItemType, string> = {
  ticket: "Chamado",
  project_activity: "Atividade de projeto",
  sprint_activity: "Atividade de sprint",
  kanban_card: "Card do kanban",
  bug: "Bug",
  improvement: "Melhoria",
  internal_task: "Tarefa interna",
};

export const TICKET_RESOLUTION_TYPES = [
  "Resolvido",
  "Resolvido parcialmente",
  "Não reproduzido",
  "Duplicado",
  "Encaminhado",
  "Cancelado",
];

export const ACTIVITY_RESOLUTION_TYPES = [
  "Concluído",
  "Entregue parcialmente",
  "Movido para outra sprint",
  "Não necessário",
  "Cancelado",
];

export const TICKET_WORK_STATUSES = [
  "Triagem",
  "Aguardando atendimento",
  "Em atendimento",
  "Aguardando cliente",
  "Validacao",
  "Pausado",
];

export const ACTIVITY_WORK_STATUSES = [
  "Backlog",
  "A fazer",
  "Em progresso",
  "Em revisao",
  "Bloqueado",
];

const TICKET_DONE = ["Finalizado", "Cancelado", "Resolvido"];
const ACTIVITY_DONE = ["Concluída", "Concluido", "Concluído", "Cancelada", "Cancelado", "Done"];

export function isWorkItemFinished(item: WorkItem): boolean {
  const done = item.backend === "ticket" ? TICKET_DONE : ACTIVITY_DONE;
  return done.includes(item.status);
}

export function workItemResolutionTypes(item: WorkItem): string[] {
  return item.backend === "ticket" ? TICKET_RESOLUTION_TYPES : ACTIVITY_RESOLUTION_TYPES;
}

export function workItemStatuses(item: WorkItem): string[] {
  return item.backend === "ticket" ? TICKET_WORK_STATUSES : ACTIVITY_WORK_STATUSES;
}

function inferActivityType(activity: Activity, fallback: WorkItemType): WorkItemType {
  const t = (activity.type || "").toLowerCase();
  if (t === "bug") return "bug";
  if (t === "melhoria" || t === "improvement") return "improvement";
  if (fallback !== "project_activity") return fallback;
  if (activity.sprint) return "sprint_activity";
  return "project_activity";
}

export function ticketToWorkItem(ticket: Ticket): WorkItem {
  return {
    ref: { type: "ticket", id: ticket.id },
    backend: "ticket",
    code: ticket.code || ticket.id.slice(0, 8),
    title: ticket.title,
    description: ticket.description || "",
    status: ticket.status || "Aberto",
    priority: ticket.priority || "Media",
    requesterName: ticket.requester_name || ticket.requester_user_name,
    clientName: ticket.client_name || ticket.organization_name,
    projectId: ticket.project,
    projectName: ticket.project_name,
    sprintId: ticket.sprint,
    sprintName: ticket.sprint_name,
    category: ticket.category_name || ticket.category,
    responsibleId: ticket.responsible_technician,
    responsibleName: ticket.responsible_technician_name,
    slaDueAt: ticket.sla_due_at,
    dueAt: ticket.due_at,
    createdAt: ticket.created_at,
    estHours: Number(ticket.est_hours || 0),
    subtasks: (ticket.checklist || []) as WorkItemSubtask[],
    resolutionType: (ticket as { resolution_type?: string }).resolution_type,
    resolutionNotes: (ticket as { resolution_notes?: string }).resolution_notes,
    resolvedByName: (ticket as { resolved_by_name?: string }).resolved_by_name,
    resolvedAt: (ticket as { resolved_at?: string | null }).resolved_at,
    reopenCount: (ticket as { reopen_count?: number }).reopen_count,
    tags: ticket.tags,
    raw: ticket,
  };
}

export function activityToWorkItem(
  activity: Activity,
  typeHint: WorkItemType = "project_activity",
): WorkItem {
  return {
    ref: { type: inferActivityType(activity, typeHint), id: activity.id },
    backend: "activity",
    code: activity.id.slice(0, 8).toUpperCase(),
    title: activity.title,
    description: activity.description || "",
    status: activity.status || "Backlog",
    priority: activity.priority || "Média",
    projectId: activity.project,
    projectName: activity.project_name,
    sprintId: activity.sprint,
    sprintName: activity.sprint_name,
    category: activity.type,
    responsibleId: activity.assignee,
    responsibleName: activity.assignee_name,
    dueAt: activity.due_at,
    createdAt: activity.created_at,
    estHours: Number(activity.est_hours || 0),
    subtasks: (activity.checklist || []) as WorkItemSubtask[],
    resolutionType: (activity as { resolution_type?: string }).resolution_type,
    resolutionNotes: (activity as { resolution_notes?: string }).resolution_notes,
    resolvedByName: (activity as { resolved_by_name?: string }).resolved_by_name,
    resolvedAt: (activity as { resolved_at?: string | null }).resolved_at,
    reopenCount: (activity as { reopen_count?: number }).reopen_count,
    tags: activity.tags,
    raw: activity,
  };
}

export type WorkItemSubTicket = {
  id: string;
  ticketId: string;
  code: string;
  title: string;
  status: string;
  responsibleName?: string;
  category?: string;
  /** Se true, o chamado pai só pode ser finalizado quando este subchamado encerrar. */
  blocksParent?: boolean;
};

const SUBTICKET_DONE = ["Finalizado", "Cancelado", "Resolvido"];

export function isSubTicketFinished(sub: WorkItemSubTicket): boolean {
  return SUBTICKET_DONE.includes(sub.status);
}
