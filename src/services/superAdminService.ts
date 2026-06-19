import { api } from "./api";

export interface SuperAdminCompany {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  is_active: boolean;
  auto_assign?: boolean;
  created_at?: string;
}

export interface CreateCompanyData {
  name: string;
  document: string;
  email: string;
  phone: string;
}

export interface SetupAdminData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export async function listAllCompanies(): Promise<SuperAdminCompany[]> {
  const res = await api.get<SuperAdminCompany[] | { results: SuperAdminCompany[] }>("/superadmin/companies/");
  const data = res.data;
  return Array.isArray(data) ? data : data.results;
}

export async function createCompany(data: CreateCompanyData): Promise<SuperAdminCompany> {
  const res = await api.post<SuperAdminCompany>("/superadmin/companies/", data);
  return res.data;
}

export async function setupCompanyAdmin(companyId: string, data: SetupAdminData): Promise<unknown> {
  const res = await api.post(`/superadmin/companies/${companyId}/setup-admin/`, data);
  return res.data;
}

export async function toggleCompanyActive(companyId: string, isActive: boolean): Promise<SuperAdminCompany> {
  const res = await api.patch<SuperAdminCompany>(`/superadmin/companies/${companyId}/`, { is_active: isActive });
  return res.data;
}
