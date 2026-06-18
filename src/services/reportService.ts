import { api } from "./api";

export interface TicketsReport {
  total: number;
  finished: number;
  open: number;
  by_status: { status: string; count: number }[];
  by_priority: { priority: string; count: number }[];
  by_category: { category: string; count: number }[];
  by_technician: { responsible_technician__name: string; count: number }[];
}

export interface SLAReport {
  total: number;
  breached_open: number;
  on_time_rate: number;
  tickets: {
    id: string;
    code: string;
    title: string;
    status: string;
    priority: string;
    sla_due_at: string;
    finished_at: string | null;
    sla_breached: boolean;
    responsible_technician__name: string | null;
  }[];
}

export interface RatingsReport {
  total_rated: number;
  average: number;
  by_score: { rating: number; count: number }[];
  tickets: { code: string; title: string; rating: number; rating_comment: string; rated_at: string; responsible_technician__name: string | null }[];
}

export interface SLAAlert {
  id: string;
  code: string;
  title: string;
  priority: string;
  sla_due_at: string;
  responsible_technician_id: string | null;
}

export interface SLAAlerts {
  breached: SLAAlert[];
  warning: SLAAlert[];
}

export interface SLAPolicy {
  id: string;
  name: string;
  priority: string;
  category: string;
  response_time: string;
  priority_weight: number;
  active: boolean;
}

async function getReport<T>(type: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ type, ...params }).toString();
  const res = await api.get(`/reports/?${query}`);
  return res.data as T;
}

export const getTicketsReport = (params?: { date_from?: string; date_to?: string }) =>
  getReport<TicketsReport>("tickets", params as Record<string, string>);

export const getSLAReport = (params?: { date_from?: string; date_to?: string }) =>
  getReport<SLAReport>("sla", params as Record<string, string>);

export const getRatingsReport = (params?: { date_from?: string; date_to?: string }) =>
  getReport<RatingsReport>("ratings", params as Record<string, string>);

export const getActivitiesReport = (params?: { date_from?: string; date_to?: string }) =>
  getReport("activities", params as Record<string, string>);

export const exportReportCSV = (type: string, params: { date_from?: string; date_to?: string } = {}) => {
  const query = new URLSearchParams({ type, export: "csv", ...params }).toString();
  window.open(`${api.defaults.baseURL}/reports/?${query}`, "_blank");
};

export const exportReportExcel = (type: string, params: { date_from?: string; date_to?: string } = {}) => {
  const query = new URLSearchParams({ type, export: "excel", ...params }).toString();
  window.open(`${api.defaults.baseURL}/reports/?${query}`, "_blank");
};

export const getSLAAlerts = async (): Promise<SLAAlerts> => {
  const res = await api.get("/sla-policies/alerts/");
  return res.data as SLAAlerts;
};

export const listSLAPolicies = async (): Promise<SLAPolicy[]> => {
  const res = await api.get("/sla-policies/");
  return res.data as SLAPolicy[];
};

export const createSLAPolicy = async (data: Partial<SLAPolicy>): Promise<SLAPolicy> => {
  const res = await api.post("/sla-policies/", data);
  return res.data as SLAPolicy;
};

export const updateSLAPolicy = async (id: string, data: Partial<SLAPolicy>): Promise<SLAPolicy> => {
  const res = await api.patch(`/sla-policies/${id}/`, data);
  return res.data as SLAPolicy;
};

export const deleteSLAPolicy = async (id: string): Promise<void> => {
  await api.delete(`/sla-policies/${id}/`);
};
