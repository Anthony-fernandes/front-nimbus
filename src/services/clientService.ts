import type { Client } from "@/lib/types";
import type { ClientFormData } from "@/components/forms/ClientForm";

import { createResource, deleteResource, getResource, listResource, updateResource } from "./crud";
import { requireId } from "./utils";

const ENDPOINT = "/clients";

export function listClients(params?: Record<string, unknown>) {
  return listResource<Client>(ENDPOINT, params);
}

export function getClient(id: string) {
  return getResource<Client>(ENDPOINT, id);
}

export function createClient(payload: Partial<Client>) {
  return createResource<Client>(ENDPOINT, payload);
}

export function updateClient(id: string, payload: Partial<Client>) {
  return updateResource<Client>(ENDPOINT, id, payload);
}

export function deleteClient(id: string) {
  return deleteResource(ENDPOINT, id);
}

export async function saveClient(data: ClientFormData, mode: "create" | "edit", clientId?: string) {
  requireId(mode, clientId);

  const payload = {
    name: data.name,
    email: data.email || "",
    phone: data.phone || "",
    sector: data.sector || "",
    contact_name: data.owner || "",
    notes: data.notes || "",
    status: data.status || "Ativo",
  };

  return mode === "edit" ? updateClient(clientId!, payload) : createClient(payload);
}

export function toClientFormData(client: Client): Partial<ClientFormData> {
  return {
    name: client.name,
    email: client.email || "",
    phone: client.phone || "",
    sector: client.sector || "",
    owner: client.contact_name || "",
    notes: client.notes || "",
    status: client.status || "Ativo",
  };
}
