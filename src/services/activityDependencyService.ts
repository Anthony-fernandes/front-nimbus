import { api } from "./api";
import type { ActivityDependency } from "@/lib/types";

export function listActivityDependencies(activityId: string) {
  return api.get<ActivityDependency[]>(`/activities/dependencies/?activity=${activityId}`).then((r) => {
    const data = r.data;
    if (Array.isArray(data)) return data;
    return (data as { results?: ActivityDependency[] }).results || [];
  });
}

export function createActivityDependency(payload: {
  activity: string;
  depends_on: string;
  dependency_type: string;
}) {
  return api.post<ActivityDependency>("/activities/dependencies/", payload).then((r) => r.data);
}

export function deleteActivityDependency(id: string) {
  return api.delete(`/activities/dependencies/${id}/`);
}
