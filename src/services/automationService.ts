import { api } from "./api";
import { listResource, createResource, deleteResource } from "./crud";

export interface AutomationCondition {
  field: "priority" | "status" | "category" | "type" | "source";
  op: "eq" | "neq" | "in" | "contains";
  value: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: "on_create" | "on_update" | "on_status_change" | "on_sla_breach";
  conditions: AutomationCondition[];
  action: "set_priority" | "set_status" | "assign_technician" | "assign_team" | "add_tag" | "send_notification";
  action_value: string;
  order: number;
  active: boolean;
  created_at: string;
}

export interface InboundMailbox {
  id: string;
  name: string;
  email_address: string;
  webhook_token: string;
  active: boolean;
  created_at: string;
}

export function listAutomationRules() {
  return listResource<AutomationRule>("/tickets/automation-rules");
}

export async function createAutomationRule(data: Partial<AutomationRule>) {
  const r = await api.post<AutomationRule>("/tickets/automation-rules/", data);
  return r.data;
}

export async function updateAutomationRule(id: string, data: Partial<AutomationRule>) {
  const r = await api.patch<AutomationRule>(`/tickets/automation-rules/${id}/`, data);
  return r.data;
}

export function deleteAutomationRule(id: string) {
  return deleteResource("/tickets/automation-rules", id);
}

export function listMailboxes() {
  return listResource<InboundMailbox>("/tickets/mailboxes");
}

export async function createMailbox(data: { name: string; email_address: string }) {
  const r = await api.post<InboundMailbox>("/tickets/mailboxes/", data);
  return r.data;
}

export async function toggleMailbox(id: string, active: boolean) {
  const r = await api.patch<InboundMailbox>(`/tickets/mailboxes/${id}/`, { active });
  return r.data;
}

export function deleteMailbox(id: string) {
  return deleteResource("/tickets/mailboxes", id);
}
