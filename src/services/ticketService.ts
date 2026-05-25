import type { TicketFormData } from "@/components/forms/TicketForm";
import {
  getCategoryDefaults,
  resolveTicketOpeningStatus,
} from "@/lib/tickets";
import type { Activity, Ticket, TicketAttachment, TicketCategory } from "@/lib/types";

import {
  createResource,
  deleteResource,
  getResource,
  listResource,
  updateResource,
} from "./crud";
import { hydrateTicketListWithWorkflow, hydrateTicketWithWorkflow } from "./ticketWorkflowService";
import { requireId, toDateOrNull, toNumber } from "./utils";

const ENDPOINT = "/tickets";

type SaveMode = "create" | "edit";

type ClientTicketRequestPayload = {
  title: string;
  description: string;
  client: string;
  requester: string;
  categoryId?: string;
  categoryName?: string;
  category?: TicketCategory | null;
  type: string;
  urgency: string;
  attachments?: TicketAttachment[];
};

function getStatusCode(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status;
}

function canRetryWithLegacyPayload(error: unknown) {
  const status = getStatusCode(error);
  return status === 400 || status === 404;
}

function extractApiErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: unknown } })?.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const payload = data as Record<string, unknown>;
  const directMessage = payload.detail || payload.message || payload.error;
  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage.trim();
  }

  const firstEntry = Object.entries(payload).find(([, value]) => {
    if (typeof value === "string") return value.trim().length > 0;
    return Array.isArray(value) && value.length > 0;
  });

  if (!firstEntry) {
    return null;
  }

  const [field, value] = firstEntry;
  if (typeof value === "string") {
    return `${field}: ${value}`;
  }

  if (Array.isArray(value)) {
    const firstItem = value.find((item) => typeof item === "string" && item.trim().length > 0);
    if (typeof firstItem === "string") {
      return `${field}: ${firstItem}`;
    }
  }

  return null;
}

function toTicketServiceError(error: unknown, mode: SaveMode) {
  const message = extractApiErrorMessage(error);
  if (message) {
    return new Error(message);
  }

  if (error instanceof Error && error.message) {
    return error;
  }

  return new Error(
    mode === "edit"
      ? "Nao foi possivel atualizar o chamado."
      : "Nao foi possivel salvar o chamado.",
  );
}

function normalizeTicketStatusValue(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s/_-]+/g, " ");
}

const TICKET_STATUS_API_ALIASES: Record<string, string> = {
  "TRIAGEM CATEGORIZACAO": "Triagem",
  TRIAGEM: "Triagem",
  "AGUARDANDO ATENDIMENTO": "Aguardando atendimento",
  "VALIDACAO AVALIACAO": "Validacao",
  "EM VALIDACAO": "Validacao",
  VALIDACAO: "Validacao",
};

const TICKET_STATUS_FORM_ALIASES: Record<string, string> = {
  TRIAGEM: "Triagem",
  "TRIAGEM CATEGORIZACAO": "Triagem",
  VALIDACAO: "Validacao",
  "VALIDACAO AVALIACAO": "Validacao",
};

function resolveTicketStatusForApi(status?: string | null) {
  const normalizedStatus = normalizeTicketStatusValue(status);
  return TICKET_STATUS_API_ALIASES[normalizedStatus] || status || "Aberto";
}

function resolveTicketStatusForForm(status?: string | null) {
  const normalizedStatus = normalizeTicketStatusValue(status);
  return TICKET_STATUS_FORM_ALIASES[normalizedStatus] || status || "Aberto";
}

function buildLegacyPayload(data: TicketFormData) {
  return {
    title: data.title,
    description: data.description || "",
    client: data.client || null,
    project: null,
    requester: data.requester || "",
    category: data.category || "Suporte geral",
    type: data.type || "Solicitacao",
    priority: data.priority || "Pendente",
    impact: data.impact || "Pendente",
    urgency: data.urgency || "Media",
    status: resolveTicketStatusForApi(data.status),
    team: data.team || "",
    sla: data.sla || "8h",
    opened_at: toDateOrNull(data.openedAt),
    due_at: toDateOrNull(data.dueAt),
    est_hours: toNumber(data.estHours, 0),
    done_hours: toNumber(data.doneHours, 0),
    tags: data.tags,
    checklist: data.checklist,
    technicians: data.tech,
  };
}

function buildExtendedPayload(data: TicketFormData) {
  return {
    ...buildLegacyPayload(data),
    requester_name: data.requester || "",
    category_id: data.categoryId || null,
    origin: data.origin || "Interno",
    approval_required: Boolean(data.approvalRequired),
    requires_client_validation: Boolean(data.requiresClientValidation),
    internal_notes: data.internalNotes || "",
    approval_status: data.approvalStatus || "",
    responsible_technician: data.responsibleTechnician || null,
    linked_activity: data.linkedActivity || null,
    converted_to_activity: Boolean(data.convertToProjectActivity),
    converted_reason: data.convertToProjectActivity
      ? "Convertido em atividade de projeto"
      : "",
  };
}

async function persistTicketPayload(
  mode: SaveMode,
  payload: Record<string, unknown>,
  legacyPayload: Record<string, unknown>,
  ticketId?: string,
) {
  try {
    return mode === "edit"
      ? await updateTicket(ticketId!, payload)
      : await createTicket(payload);
  } catch (error) {
    if (
      !canRetryWithLegacyPayload(error) ||
      JSON.stringify(payload) === JSON.stringify(legacyPayload)
    ) {
      throw toTicketServiceError(error, mode);
    }

    try {
      return mode === "edit"
        ? await updateTicket(ticketId!, legacyPayload)
        : await createTicket(legacyPayload);
    } catch (legacyError) {
      throw toTicketServiceError(legacyError, mode);
    }
  }
}

export function listTickets(params?: Record<string, unknown>) {
  return listResource<Ticket>(ENDPOINT, params).then((tickets) =>
    hydrateTicketListWithWorkflow(tickets),
  );
}

export function getTicket(id: string) {
  return getResource<Ticket>(ENDPOINT, id).then((ticket) => hydrateTicketWithWorkflow(ticket));
}

export function createTicket(payload: Partial<Ticket> | Record<string, unknown>) {
  return createResource<Ticket>(ENDPOINT, payload).then((ticket) => hydrateTicketWithWorkflow(ticket));
}

export function updateTicket(
  id: string,
  payload: Partial<Ticket> | Record<string, unknown>,
) {
  return updateResource<Ticket>(ENDPOINT, id, payload).then((ticket) => hydrateTicketWithWorkflow(ticket));
}

export function deleteTicket(id: string) {
  return deleteResource(ENDPOINT, id);
}

export async function saveTicket(
  data: TicketFormData,
  mode: SaveMode,
  ticketId?: string,
) {
  requireId(mode, ticketId);

  const legacyPayload = buildLegacyPayload(data);
  const extendedPayload = buildExtendedPayload(data);

  return persistTicketPayload(mode, extendedPayload, legacyPayload, ticketId);
}

export async function createClientTicketRequest(payload: ClientTicketRequestPayload) {
  const categoryDefaults = getCategoryDefaults(payload.category);
  const extendedPayload = {
    title: payload.title.trim(),
    description: payload.description.trim(),
    client: payload.client,
    requester: payload.requester,
    requester_name: payload.requester,
    category: payload.category?.name || payload.categoryName || payload.categoryId || "",
    category_id: payload.category?.id || payload.categoryId || null,
    type: payload.type || categoryDefaults.type,
    priority: categoryDefaults.priority,
    impact: categoryDefaults.impact,
    urgency: payload.urgency || "Media",
    status: resolveTicketStatusForApi(resolveTicketOpeningStatus(payload.category)),
    team: categoryDefaults.team,
    sla: categoryDefaults.sla,
    approval_required: categoryDefaults.approvalRequired,
    requires_client_validation: categoryDefaults.requiresClientValidation,
    origin: "Portal Cliente",
    opened_at: new Date().toISOString(),
    attachments: payload.attachments || [],
  };

  const legacyPayload = {
    title: extendedPayload.title,
    description: extendedPayload.description,
    client: extendedPayload.client,
    requester: extendedPayload.requester,
    category: extendedPayload.category || "Suporte geral",
    type: extendedPayload.type || "Solicitacao",
    priority: extendedPayload.priority || "Pendente",
    impact: extendedPayload.impact || "Pendente",
    urgency: extendedPayload.urgency,
    status: extendedPayload.status,
    team: extendedPayload.team || "",
    sla: extendedPayload.sla || "8h",
    opened_at: extendedPayload.opened_at,
  };

  return persistTicketPayload("create", extendedPayload, legacyPayload);
}

export async function transitionTicket(
  id: string,
  payload: {
    status: string;
    internalNotes?: string;
    approvalStatus?: string;
    approvalJustification?: string;
    approvalRequired?: boolean;
    requiresClientValidation?: boolean;
    linkedActivity?: string | null;
    convertedToActivity?: boolean;
    finishedAt?: string | null;
    category?: string;
    categoryId?: string | null;
    categoryName?: string;
    subcategory?: string;
    priority?: string;
    impact?: string;
    urgency?: string;
    sla?: string;
    team?: string;
    responsibleTechnician?: string | null;
    technicians?: string[];
  },
) {
  const resolvedStatus = resolveTicketStatusForApi(payload.status);
  const extendedPayload: Record<string, unknown> = {
    status: resolvedStatus,
  };
  const legacyPayload: Record<string, unknown> = {
    status: payload.status,
  };

  if ("internalNotes" in payload) {
    extendedPayload.internal_notes = payload.internalNotes || "";
  }

  if ("approvalStatus" in payload) {
    extendedPayload.approval_status = payload.approvalStatus || "";
  }

  if ("approvalJustification" in payload) {
    extendedPayload.approval_justification = payload.approvalJustification || "";
  }

  if ("linkedActivity" in payload) {
    extendedPayload.linked_activity = payload.linkedActivity ?? null;
  }

  if ("convertedToActivity" in payload) {
    extendedPayload.converted_to_activity = Boolean(payload.convertedToActivity);
  }

  if ("finishedAt" in payload) {
    extendedPayload.finished_at = payload.finishedAt ?? null;
    legacyPayload.finished_at = payload.finishedAt ?? null;
  }

  if ("team" in payload) {
    extendedPayload.team = payload.team || "";
    legacyPayload.team = payload.team || "";
  }

  if ("category" in payload) {
    extendedPayload.category = payload.category || "";
  }

  if ("categoryId" in payload) {
    extendedPayload.category_id = payload.categoryId ?? null;
  }

  if ("categoryName" in payload) {
    extendedPayload.category_name = payload.categoryName || "";
  }

  if ("subcategory" in payload) {
    extendedPayload.subcategory = payload.subcategory || "";
  }

  if ("priority" in payload) {
    extendedPayload.priority = payload.priority || "";
  }

  if ("impact" in payload) {
    extendedPayload.impact = payload.impact || "";
  }

  if ("urgency" in payload) {
    extendedPayload.urgency = payload.urgency || "";
  }

  if ("sla" in payload) {
    extendedPayload.sla = payload.sla || "";
    legacyPayload.sla = payload.sla || "";
  }

  if ("approvalRequired" in payload) {
    extendedPayload.approval_required = Boolean(payload.approvalRequired);
  }

  if ("requiresClientValidation" in payload) {
    extendedPayload.requires_client_validation = Boolean(payload.requiresClientValidation);
  }

  if ("responsibleTechnician" in payload) {
    extendedPayload.responsible_technician = payload.responsibleTechnician ?? null;
  }

  if ("technicians" in payload) {
    extendedPayload.technicians = payload.technicians;
    legacyPayload.technicians = payload.technicians;
  }

  return persistTicketPayload("edit", extendedPayload, legacyPayload, id);
}

export async function markTicketConvertedToActivity(
  ticketId: string,
  activity: Pick<Activity, "id" | "title" | "project">,
) {
  return transitionTicket(ticketId, {
    status: "Finalizado",
    linkedActivity: activity.id,
    convertedToActivity: true,
    finishedAt: new Date().toISOString(),
    internalNotes: `Convertido em atividade de projeto: ${activity.title}.`,
  });
}

export async function linkActivityToTicket(
  ticketId: string,
  activity: Pick<Activity, "id" | "title" | "project">,
) {
  const extendedPayload = {
    linked_activity: activity.id,
    converted_to_activity: false,
  };
  const legacyPayload = {
    linked_activity: activity.id,
  };

  try {
    return await updateTicket(ticketId, extendedPayload);
  } catch (error) {
    if (
      !canRetryWithLegacyPayload(error)
      || JSON.stringify(extendedPayload) === JSON.stringify(legacyPayload)
    ) {
      throw toTicketServiceError(error, "edit");
    }

    try {
      return await updateTicket(ticketId, legacyPayload);
    } catch (legacyError) {
      throw toTicketServiceError(legacyError, "edit");
    }
  }
}

export function toTicketFormData(ticket: Ticket): Partial<TicketFormData> {
  return {
    title: ticket.title,
    description: ticket.description || "",
    client: ticket.client || "",
    requester: ticket.requester_name || ticket.requester || "",
    category: ticket.category_id || ticket.category || "",
    categoryId: ticket.category_id || "",
    type: ticket.type || "Solicitacao",
    priority: ticket.priority || "Pendente",
    impact: ticket.impact || "Pendente",
    urgency: ticket.urgency || "Media",
    sla: ticket.sla || "8h",
    status: resolveTicketStatusForForm(ticket.status),
    tech: ticket.technicians || [],
    team: ticket.team || "",
    project: ticket.project || "",
    openedAt: ticket.opened_at || "",
    dueAt: ticket.due_at || "",
    estHours: String(ticket.est_hours ?? 0),
    doneHours: String(ticket.done_hours ?? 0),
    tags: ticket.tags || [],
    checklist: ticket.checklist || [],
    origin: ticket.origin || "Interno",
    approvalRequired: Boolean(ticket.approval_required),
    approvalStatus: ticket.approval_status || ticket.approval?.status || "",
    requiresClientValidation: Boolean(ticket.requires_client_validation),
    internalNotes: ticket.internal_notes || "",
    responsibleTechnician: ticket.responsible_technician || "",
    linkedActivity: ticket.linked_activity || "",
    convertToProjectActivity: Boolean(ticket.converted_to_activity),
  };
}
