import type { ProjectFormData } from "@/components/forms/ProjectForm";
import type { Project, ProjectStage } from "@/lib/types";

import {
  createResource,
  deleteResource,
  getResource,
  listResource,
  updateResource,
} from "./crud";
import { requireId, toDateOrNull, toNumber } from "./utils";

const ENDPOINT = "/projects";

type LegacyProjectStage =
  | ProjectStage
  | {
      id?: string;
      title?: string;
      expectedEndDate?: string;
      expected_end_date?: string;
      text?: string;
      name?: string;
      done?: boolean;
      completed?: boolean;
    }
  | string
  | null
  | undefined;

function createStageId(index: number) {
  return `stage-${index + 1}`;
}

function coerceArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value == null) {
    return [];
  }

  return [value];
}

function toText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function looksLikeDisplayName(value: string) {
  return value.includes(" ") || value.includes("@");
}

function resolveLegacyMemberId(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return toText(value);
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  return (
    toText(record.id)
    || toText(record.user_id)
    || toText(record.user)
    || toText(record.value)
  );
}

function resolveLegacyMemberName(value: unknown) {
  if (typeof value === "string") {
    const text = toText(value);
    return looksLikeDisplayName(text) ? text : "";
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  const composedName = [toText(record.first_name), toText(record.last_name)]
    .filter(Boolean)
    .join(" ");

  return (
    toText(record.name)
    || composedName
    || toText(record.username)
    || toText(record.email)
  );
}

function normalizeProjectTeam(project: Partial<Project> & Record<string, unknown>) {
  const rawTeam = coerceArray(project.team as unknown[] | unknown);
  const rawTeamNames = coerceArray(project.team_names as unknown[] | unknown)
    .map((value) => toText(value))
    .filter(Boolean);
  const teamIds = rawTeam
    .map((value) => resolveLegacyMemberId(value))
    .filter(Boolean);
  const namesFromTeam = rawTeam
    .map((value) => resolveLegacyMemberName(value))
    .filter(Boolean);

  if (teamIds.length > 0) {
    return {
      team: teamIds,
      team_names: teamIds.map(
        (_, index) => rawTeamNames[index] || namesFromTeam[index] || `Membro ${index + 1}`,
      ),
    };
  }

  return {
    team: [],
    team_names: rawTeamNames.length ? rawTeamNames : namesFromTeam,
  };
}

export function normalizeProjectStages(stages?: LegacyProjectStage[] | LegacyProjectStage) {
  return coerceArray(stages)
    .map((stage, index) => {
      if (typeof stage === "string") {
        const title = toText(stage);
        if (!title) {
          return null;
        }

        return {
          id: createStageId(index),
          title,
          expectedEndDate: undefined,
          completed: false,
        };
      }

      if (!stage || typeof stage !== "object") {
        return null;
      }

      const record = stage as Record<string, unknown>;
      const title =
        toText(record.title) || toText(record.text) || toText(record.name);
      const completed = record.completed ?? record.done;
      const expectedEndDate =
        toText(record.expectedEndDate) || toText(record.expected_end_date);

      if (!title) {
        return null;
      }

      return {
        id: toText(record.id) || createStageId(index),
        title,
        expectedEndDate: expectedEndDate || undefined,
        completed: Boolean(completed),
      };
    })
    .filter(Boolean) as ProjectStage[];
}

function normalizeProjectStatus(status?: string) {
  if (status === "Planejamento") return "Planejado";
  if (status === "Validacao") return "Em risco";
  if (status === "Arquivado") return "Concluído";
  return status || "Planejado";
}

export function normalizeProject(project?: Project | null) {
  if (!project) {
    return null;
  }

  const rawProject = project as Project & Record<string, unknown>;
  const normalizedTeam = normalizeProjectTeam(rawProject);
  const normalizedClientName =
    toText(rawProject.client_name)
    || (looksLikeDisplayName(toText(rawProject.client)) ? toText(rawProject.client) : "");
  const normalizedOwnerName =
    toText(rawProject.owner_name)
    || resolveLegacyMemberName(rawProject.owner);

  return {
    ...project,
    name: toText(rawProject.name) || "Projeto sem nome",
    description: toText(rawProject.description) || "",
    client: toText(rawProject.client) || undefined,
    client_name: normalizedClientName || undefined,
    organization_id: toText(rawProject.organization_id) || toText(rawProject.client) || undefined,
    organization_name: toText(rawProject.organization_name) || normalizedClientName || undefined,
    owner: toText(rawProject.owner) || null,
    owner_name: normalizedOwnerName || undefined,
    leader_name: toText(rawProject.leader_name) || normalizedOwnerName || undefined,
    contact_principal: toText(rawProject.contact_principal) || null,
    contact_principal_name: toText(rawProject.contact_principal_name) || undefined,
    team: normalizedTeam.team,
    team_names: normalizedTeam.team_names,
    member_links: coerceArray(rawProject.member_links as unknown[] | unknown)
      .filter(Boolean) as Project["member_links"],
    status: toText(rawProject.status) || "",
    progress: toNumber(rawProject.progress as string | number | null | undefined, 0),
    budget: toNumber(rawProject.budget, 0),
    real_cost: toNumber(rawProject.real_cost, 0),
    due_at: toText(rawProject.due_at) || null,
    start_at: toText(rawProject.start_at) || null,
    tags: coerceArray(rawProject.tags as string[] | string | null | undefined)
      .map((tag) => toText(tag))
      .filter(Boolean),
    checklist: normalizeProjectStages((rawProject.checklist ?? rawProject.stages) as LegacyProjectStage[] | undefined),
    cost_entries: coerceArray(rawProject.cost_entries as unknown[] | unknown)
      .filter(Boolean) as Project["cost_entries"],
    costs: coerceArray(rawProject.costs as unknown[] | unknown)
      .filter(Boolean) as Project["costs"],
    project_costs: coerceArray(rawProject.project_costs as unknown[] | unknown)
      .filter(Boolean) as Project["project_costs"],
  };
}

export function listProjects(params?: Record<string, unknown>) {
  return listResource<Project>(ENDPOINT, params).then((projects) =>
    projects
      .map((project) => normalizeProject(project))
      .filter(Boolean) as Project[],
  );
}

export function getProject(id: string) {
  return getResource<Project>(ENDPOINT, id).then((project) => normalizeProject(project));
}

export function createProject(payload: Partial<Project>) {
  return createResource<Project>(ENDPOINT, payload).then((project) => normalizeProject(project));
}

export function updateProject(id: string, payload: Partial<Project>) {
  return updateResource<Project>(ENDPOINT, id, payload).then((project) => normalizeProject(project));
}

export function deleteProject(id: string) {
  return deleteResource(ENDPOINT, id);
}

export async function saveProject(
  data: ProjectFormData,
  mode: "create" | "edit",
  projectId?: string,
) {
  requireId(mode, projectId);

  const payload = {
    name: data.name,
    description: data.description || "",
    tipo: data.tipo || "cliente",
    metodologia: data.metodologia || "scrum",
    client: data.tipo === "cliente" ? (data.organization || null) : null,
    department: data.tipo === "interno" ? (data.department || null) : null,
    owner: data.leader || null,
    contact_principal: data.contactPrincipal || null,
    team: data.team,
    status: normalizeProjectStatus(data.status),
    budget: toNumber(data.budget, 0),
    real_cost: toNumber(data.costReal, 0),
    start_at: toDateOrNull(data.startAt),
    due_at: toDateOrNull(data.endAt),
    tags: data.tags,
    checklist: data.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      expectedEndDate: toDateOrNull(stage.expectedEndDate),
      completed: Boolean(stage.completed),
    })),
  };

  return mode === "edit" ? updateProject(projectId!, payload as Partial<Project>) : createProject(payload as Partial<Project>);
}

export function toProjectFormData(project: Project): Partial<ProjectFormData> {
  const normalizedProject = normalizeProject(project) || project;

  return {
    name: normalizedProject.name,
    tipo: (normalizedProject.tipo as ProjectFormData["tipo"]) || "cliente",
    metodologia: (normalizedProject.metodologia as ProjectFormData["metodologia"]) || "scrum",
    organization: normalizedProject.client || normalizedProject.organization_id || "",
    department: normalizedProject.department || "",
    contactPrincipal: normalizedProject.contact_principal || "",
    leader: normalizedProject.owner || "",
    team: normalizedProject.team || [],
    status: normalizedProject.status || "Planejado",
    startAt: normalizedProject.start_at || "",
    endAt: normalizedProject.due_at || "",
    budget: String(normalizedProject.budget ?? ""),
    costReal: String(normalizedProject.real_cost ?? 0),
    estHours: "",
    usedHours: "",
    tags: normalizedProject.tags || [],
    description: normalizedProject.description || "",
    stages: normalizeProjectStages(normalizedProject.checklist) as ProjectStage[],
  };
}
