import { api } from "./api";

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function buildEndpoint(endpoint: string, id?: string) {
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (!id) return normalized.endsWith("/") ? normalized : `${normalized}/`;
  return `${normalized.replace(/\/$/, "")}/${id}/`;
}

export function unwrapRows<T>(payload: Paginated<T> | T[] | undefined) {
  if (!payload) return [];
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

export async function listResource<T>(endpoint: string, params?: Record<string, unknown>) {
  const response = await api.get<Paginated<T> | T[]>(buildEndpoint(endpoint), { params });
  return unwrapRows(response.data);
}

export async function getResource<T>(endpoint: string, id: string, params?: Record<string, unknown>) {
  const response = await api.get<T>(buildEndpoint(endpoint, id), { params });
  return response.data;
}

export async function createResource<T>(endpoint: string, payload: unknown) {
  const response = await api.post<T>(buildEndpoint(endpoint), payload);
  return response.data;
}

export async function updateResource<T>(endpoint: string, id: string, payload: unknown) {
  const response = await api.patch<T>(buildEndpoint(endpoint, id), payload);
  return response.data;
}

export async function deleteResource(endpoint: string, id: string) {
  await api.delete(buildEndpoint(endpoint, id));
}
