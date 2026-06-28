import { api } from "./api";
import type { Team, TeamMember } from "@/lib/types";

export async function listTeams(): Promise<Team[]> {
  const res = await api.get("/teams/");
  const data = res.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function getTeam(id: string): Promise<Team> {
  const res = await api.get(`/teams/${id}/`);
  return res.data;
}

export async function createTeam(payload: Partial<Team>): Promise<Team> {
  const res = await api.post("/teams/", payload);
  return res.data;
}

export async function updateTeam(id: string, payload: Partial<Team>): Promise<Team> {
  const res = await api.patch(`/teams/${id}/`, payload);
  return res.data;
}

export async function deleteTeam(id: string): Promise<void> {
  await api.delete(`/teams/${id}/`);
}

export async function listTeamMembers(teamId?: string): Promise<TeamMember[]> {
  const params = teamId ? { team: teamId } : {};
  const res = await api.get("/team-members/", { params });
  const data = res.data;
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function addTeamMember(payload: {
  team: string;
  user: string;
  role?: string;
  default_hours_per_day?: number;
  default_capacity?: number;
}): Promise<TeamMember> {
  const res = await api.post("/team-members/", payload);
  return res.data;
}

export async function updateTeamMember(id: string, payload: Partial<TeamMember>): Promise<TeamMember> {
  const res = await api.patch(`/team-members/${id}/`, payload);
  return res.data;
}

export async function removeTeamMember(id: string): Promise<void> {
  await api.delete(`/team-members/${id}/`);
}
