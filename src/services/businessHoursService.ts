import { api } from "./api";
import type { BusinessHours, CompanyHoliday } from "@/lib/types";

export function listBusinessHours() {
  return api.get<BusinessHours[]>("/tickets/business-hours/").then((r) => {
    const data = r.data;
    if (Array.isArray(data)) return data;
    return (data as { results?: BusinessHours[] }).results || [];
  });
}

export function createBusinessHours(payload: Omit<BusinessHours, "id">) {
  return api.post<BusinessHours>("/tickets/business-hours/", payload).then((r) => r.data);
}

export function updateBusinessHours(id: string, payload: Partial<BusinessHours>) {
  return api.patch<BusinessHours>(`/tickets/business-hours/${id}/`, payload).then((r) => r.data);
}

export function deleteBusinessHours(id: string) {
  return api.delete(`/tickets/business-hours/${id}/`);
}

export function listCompanyHolidays() {
  return api.get<CompanyHoliday[]>("/tickets/holidays/").then((r) => {
    const data = r.data;
    if (Array.isArray(data)) return data;
    return (data as { results?: CompanyHoliday[] }).results || [];
  });
}

export function createCompanyHoliday(payload: Omit<CompanyHoliday, "id">) {
  return api.post<CompanyHoliday>("/tickets/holidays/", payload).then((r) => r.data);
}

export function deleteCompanyHoliday(id: string) {
  return api.delete(`/tickets/holidays/${id}/`);
}
