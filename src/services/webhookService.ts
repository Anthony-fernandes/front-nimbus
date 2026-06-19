import { api } from "./api";

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  last_triggered_at: string | null;
  last_status_code: number | null;
  created_at: string;
}

export interface WebhookEvent {
  event: string;
  label: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status_code: number | null;
  success: boolean;
  error: string | null;
  created_at: string;
}

export async function listWebhooks(): Promise<Webhook[]> {
  const { data } = await api.get("/webhooks/");
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export async function getWebhook(id: string): Promise<Webhook> {
  const { data } = await api.get<Webhook>(`/webhooks/${id}/`);
  return data;
}

export async function createWebhook(payload: Omit<Webhook, "id" | "last_triggered_at" | "last_status_code" | "created_at">): Promise<Webhook> {
  const { data } = await api.post<Webhook>("/webhooks/", payload);
  return data;
}

export async function updateWebhook(id: string, payload: Partial<Omit<Webhook, "id" | "created_at">>): Promise<Webhook> {
  const { data } = await api.patch<Webhook>(`/webhooks/${id}/`, payload);
  return data;
}

export async function deleteWebhook(id: string): Promise<void> {
  await api.delete(`/webhooks/${id}/`);
}

export async function getAvailableEvents(): Promise<WebhookEvent[]> {
  const { data } = await api.get<WebhookEvent[]>("/webhooks/available-events/");
  return data;
}

export async function getWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
  const { data } = await api.get<WebhookDelivery[]>(`/webhooks/${id}/deliveries/`);
  return data;
}

export async function testWebhook(id: string): Promise<void> {
  await api.post(`/webhooks/${id}/test/`);
}

export async function retryWebhookDelivery(webhookId: string, deliveryId: string): Promise<void> {
  await api.post(`/webhooks/${webhookId}/retry-delivery/${deliveryId}/`);
}
