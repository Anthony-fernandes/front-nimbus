import type { DashboardData } from "@/lib/types";

import { api } from "./api";

export async function getDashboard() {
  const response = await api.get<DashboardData>("/dashboard/");
  return response.data;
}
