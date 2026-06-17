import { api } from "./api";

export interface EmailTemplate {
  id: string;
  event: string;
  event_label: string;
  subject: string;
  body: string;
  active: boolean;
}

export interface AvailableEvent {
  event: string;
  label: string;
  default_subject: string;
  default_body: string;
}

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  const response = await api.get<{ results: EmailTemplate[] } | EmailTemplate[]>("/email-templates/");
  const data = response.data;
  if (Array.isArray(data)) return data;
  return (data as { results: EmailTemplate[] }).results ?? [];
}

export async function getAvailableEvents(): Promise<AvailableEvent[]> {
  const response = await api.get<AvailableEvent[]>("/email-templates/available-events/");
  return response.data;
}

export async function createEmailTemplate(
  data: Omit<EmailTemplate, "id" | "event_label">,
): Promise<EmailTemplate> {
  const response = await api.post<EmailTemplate>("/email-templates/", data);
  return response.data;
}

export async function updateEmailTemplate(
  id: string,
  data: Partial<Omit<EmailTemplate, "id" | "event_label">>,
): Promise<EmailTemplate> {
  const response = await api.patch<EmailTemplate>(`/email-templates/${id}/`, data);
  return response.data;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await api.delete(`/email-templates/${id}/`);
}
