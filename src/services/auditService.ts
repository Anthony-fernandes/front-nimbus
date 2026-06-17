import type { AuditLog } from "@/lib/types";

import { api } from "./api";

export async function listAuditLogs(params?: {
  entity_type?: string;
  action?: string;
  search?: string;
  page?: number;
}): Promise<{ results: AuditLog[]; count: number }> {
  const res = await api.get("/audit-logs/", { params });
  return res.data;
}
