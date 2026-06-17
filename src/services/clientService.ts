import type { Organization } from "@/lib/types";
import type { ClientFormData } from "@/components/forms/ClientForm";

import { createResource, deleteResource, getResource, listResource, updateResource } from "./crud";
import { requireId } from "./utils";

const ENDPOINT = "/clients";

export function listClients(params?: Record<string, unknown>) {
  return listResource<Organization>(ENDPOINT, params);
}

export function getClient(id: string) {
  return getResource<Organization>(ENDPOINT, id);
}

export function createClient(payload: Partial<Organization>) {
  return createResource<Organization>(ENDPOINT, payload);
}

export function updateClient(id: string, payload: Partial<Organization>) {
  return updateResource<Organization>(ENDPOINT, id, payload);
}

export function deleteClient(id: string) {
  return deleteResource(ENDPOINT, id);
}

export async function saveClient(data: ClientFormData, mode: "create" | "edit", clientId?: string) {
  requireId(mode, clientId);

  const payload = {
    name: data.name,
    organization_type: data.organizationType || "CLIENTE_EMPRESA",
    document: data.doc || "",
    email: data.email || "",
    phone: data.phone || "",
    address: data.address || "",
    sector: data.sector || "",
    contact_name: data.owner || "",
    notes: data.notes || "",
    active: data.status !== "Inativo" && data.status !== "Bloqueado",
    parent: data.parentOrganization || null,
    status: data.status || "Ativo",
  };

  return mode === "edit" ? updateClient(clientId!, payload) : createClient(payload);
}

export function toClientFormData(client: Organization): Partial<ClientFormData> {
  return {
    name: client.name,
    organizationType: client.organization_type || client.type || "CLIENTE_EMPRESA",
    doc: client.document || "",
    email: client.email || "",
    phone: client.phone || "",
    address: client.address || "",
    sector: client.sector || "",
    owner: client.contact_name || "",
    notes: client.notes || "",
    parentOrganization: client.parent || client.organization_parent_id || "",
    status: client.status || "Ativo",
  };
}

export const listOrganizations = listClients;
export const getOrganization = getClient;
export const createOrganization = createClient;
export const updateOrganization = updateClient;
export const deleteOrganization = deleteClient;
export const saveOrganization = saveClient;
