import { api } from "./api";

export interface CompanyStats {
  total_tickets: number;
  total_members: number;
  open_tickets: number;
}

export interface Company {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  is_active: boolean;
  auto_assign: boolean;
  usage_type?: "interno" | "prestador" | "hibrido";
  email_domain?: string;
  timezone?: string;
  locale?: string;
  currency?: string;
  logo?: string;
  primary_color?: string;
}

export async function getCompanyStats(): Promise<CompanyStats> {
  const res = await api.get<CompanyStats>("/companies/stats/");
  return res.data;
}

export async function getMyCompany(): Promise<Company> {
  const res = await api.get<{ results: Company[] }>("/companies/");
  return res.data.results[0];
}

export async function updateCompany(id: string, data: Partial<Omit<Company, "id" | "is_active">>): Promise<Company> {
  const res = await api.patch<Company>(`/companies/${id}/`, data);
  return res.data;
}
