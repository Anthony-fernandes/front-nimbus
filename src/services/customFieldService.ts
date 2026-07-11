import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./crud";
import { api } from "./api";

const ENDPOINT = "/tickets/custom-fields";

export type TicketCustomField = {
  id: string;
  name: string;
  label: string;
  field_type: "text" | "number" | "date" | "select" | "boolean";
  required: boolean;
  is_active: boolean;
  options?: string[];
  category?: string | null;
  category_name?: string;
  visible_to_client?: boolean;
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

export type CustomField = {
  id: string;
  name: string;
  label: string;
  field_type: "text" | "number" | "date" | "select" | "boolean";
  options: string[];
  required: boolean;
  active: boolean;
  order: number;
};

export type CustomValue = {
  id?: string;
  field: string;
  field_label?: string;
  field_type?: string;
  field_options?: string[];
  value: string;
};

export function listActivityCustomFields() {
  return api.get<CustomField[]>("/activities/custom-fields/").then((r) => {
    const d = r.data;
    if (Array.isArray(d)) return d;
    return (d as { results?: CustomField[] }).results || [];
  });
}

export function listActivityCustomValues(activityId: string) {
  return api.get<CustomValue[]>(`/activities/custom-values/?activity=${activityId}`).then((r) => {
    const d = r.data;
    if (Array.isArray(d)) return d;
    return (d as { results?: CustomValue[] }).results || [];
  });
}

export function upsertActivityCustomValue(activityId: string, fieldId: string, value: string, existingId?: string) {
  if (existingId) {
    return api.patch<CustomValue>(`/activities/custom-values/${existingId}/`, { value }).then((r) => r.data);
  }
  return api.post<CustomValue>("/activities/custom-values/", { activity: activityId, field: fieldId, value }).then((r) => r.data);
}

export function listProjectCustomFields() {
  return api.get<CustomField[]>("/projects/custom-fields/").then((r) => {
    const d = r.data;
    if (Array.isArray(d)) return d;
    return (d as { results?: CustomField[] }).results || [];
  });
}

export function listProjectCustomValues(projectId: string) {
  return api.get<CustomValue[]>(`/projects/custom-values/?project=${projectId}`).then((r) => {
    const d = r.data;
    if (Array.isArray(d)) return d;
    return (d as { results?: CustomValue[] }).results || [];
  });
}

export function upsertProjectCustomValue(projectId: string, fieldId: string, value: string, existingId?: string) {
  if (existingId) {
    return api.patch<CustomValue>(`/projects/custom-values/${existingId}/`, { value }).then((r) => r.data);
  }
  return api.post<CustomValue>("/projects/custom-values/", { project: projectId, field: fieldId, value }).then((r) => r.data);
}
