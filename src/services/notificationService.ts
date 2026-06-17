import type { AppNotification, NotificationPreference } from "@/lib/types";

import { api } from "./api";
import { listResource, unwrapRows, type Paginated } from "./crud";

const ENDPOINT = "/notifications";

export function listNotifications(params?: Record<string, unknown>) {
  return listResource<AppNotification>(ENDPOINT, params);
}

export async function getUnreadCount() {
  const response = await api.get<{ count: number }>(`${ENDPOINT}/unread-count/`);
  return response.data?.count ?? 0;
}

export async function markNotificationRead(id: string) {
  const response = await api.post<AppNotification>(`${ENDPOINT}/${id}/read/`);
  return response.data;
}

export async function markNotificationUnread(id: string) {
  const response = await api.post<AppNotification>(`${ENDPOINT}/${id}/unread/`);
  return response.data;
}

export async function toggleNotificationFavorite(id: string, value: boolean) {
  const response = await api.post<AppNotification>(`${ENDPOINT}/${id}/favorite/`, { value });
  return response.data;
}

export async function archiveNotification(id: string, value = true) {
  const response = await api.post<AppNotification>(`${ENDPOINT}/${id}/archive/`, { value });
  return response.data;
}

export async function markAllNotificationsRead() {
  await api.post(`${ENDPOINT}/read-all/`);
}

export async function getNotificationPreference() {
  const response = await api.get<NotificationPreference>("/notification-preferences/me/");
  return response.data;
}

export async function updateNotificationPreference(payload: Partial<NotificationPreference>) {
  const response = await api.patch<NotificationPreference>(
    "/notification-preferences/me/",
    payload,
  );
  return response.data;
}

export type { Paginated };
export { unwrapRows };
