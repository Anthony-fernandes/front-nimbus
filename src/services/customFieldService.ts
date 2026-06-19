import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./crud";

const ENDPOINT = "/tickets/custom-fields";

export type TicketCustomField = {
  id: string;
  name: string;
  label: string;
  field_type: "text" | "number" | "date" | "select" | "boolean";
  required: boolean;
  is_active: boolean;
};

export async function listCustomFields() {
  return listResource<TicketCustomField>(ENDPOINT);
}

export async function createCustomField(data: Omit<TicketCustomField, "id">) {
  return createResource<TicketCustomField>(ENDPOINT, data);
}

export async function updateCustomField(id: string, data: Partial<Omit<TicketCustomField, "id">>) {
  return updateResource<TicketCustomField>(ENDPOINT, id, data);
}

export async function deleteCustomField(id: string) {
  await deleteResource(ENDPOINT, id);
}
