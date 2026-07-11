import type { TicketCategory } from "@/lib/types";

import {
  createResource,
  deleteResource,
  getResource,
  listResource,
  updateResource,
} from "./crud";

const ENDPOINT = "/ticket-categories";

function normalizeCategoryPayload(payload: Partial<TicketCategory>) {
  return {
    name: payload.name,
    description: payload.description || "",
    active: payload.active ?? true,
    sla: payload.sla || "",
    sla_unit: payload.sla_unit || "",
    approval_required: Boolean(payload.approval_required),
    default_type: payload.default_type || "",
    default_priority: payload.default_priority || "",
    default_impact: payload.default_impact || "",
    default_team: payload.default_team || "",
    allow_project_activity: Boolean(payload.allow_project_activity),
    requires_technical_categorization: Boolean(payload.requires_technical_categorization),
    requires_client_validation: Boolean(payload.requires_client_validation),
    color: payload.color || "",
    icon: payload.icon || "",
    subcategories: payload.subcategories || [],
    subcategory_required: Boolean(payload.subcategory_required),
    attachment_required: Boolean(payload.attachment_required),
  };
}

function getStatusCode(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status;
}

function isValidationError(error: unknown) {
  return getStatusCode(error) === 400;
}

function isMissingEndpoint(error: unknown) {
  const status = getStatusCode(error);
  return status === 404 || status === 405;
}

function toCategoryServiceError(error: unknown) {
  if (isMissingEndpoint(error)) {
    return new Error(
      "A API de categorias de chamados ainda não esta disponível no backend Django.",
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Não foi possível acessar categorias de chamados.");
}

export async function listTicketCategories() {
  try {
    return await listResource<TicketCategory>(ENDPOINT);
  } catch (error) {
    throw toCategoryServiceError(error);
  }
}

export async function getTicketCategory(id: string) {
  try {
    return await getResource<TicketCategory>(ENDPOINT, id);
  } catch (error) {
    throw toCategoryServiceError(error);
  }
}

export async function createTicketCategory(payload: Partial<TicketCategory>) {
  try {
    return await createResource<TicketCategory>(ENDPOINT, normalizeCategoryPayload(payload));
  } catch (error) {
    throw toCategoryServiceError(error);
  }
}

export async function updateTicketCategory(id: string, payload: Partial<TicketCategory>) {
  try {
    return await updateResource<TicketCategory>(ENDPOINT, id, normalizeCategoryPayload(payload));
  } catch (error) {
    throw toCategoryServiceError(error);
  }
}

export async function deleteTicketCategory(id: string) {
  try {
    await deleteResource(ENDPOINT, id);
  } catch (error) {
    throw toCategoryServiceError(error);
  }
}

export async function saveTicketCategory(
  payload: Partial<TicketCategory>,
  mode: "create" | "edit",
  categoryId?: string,
) {
  try {
    return mode === "edit" && categoryId
      ? await updateTicketCategory(categoryId, payload)
      : await createTicketCategory(payload);
  } catch (error) {
    if (isValidationError(error)) {
      throw new Error("A API rejeitou os campos enviados para a categoria.");
    }

    throw toCategoryServiceError(error);
  }
}
