import { api } from "./api";

export interface CompanyStats {
  total_tickets: number;
  total_members: number;
  open_tickets: number;
}

export async function getCompanyStats(): Promise<CompanyStats> {
  const res = await api.get<CompanyStats>("/companies/stats/");
  return res.data;
}

export async function updateCompany(id: string, data: { name?: string; sector?: string }): Promise<void> {
  await api.patch(`/companies/${id}/`, data);
}
