import type { Activity, Project, ProjectStage } from "@/lib/types";

export type ProjectProgressSource = "activities" | "stages" | "none";

export type ProjectProgressSummary = {
  percent: number;
  source: ProjectProgressSource;
  completedCount: number;
  totalCount: number;
  helperText: string;
};

const COMPLETED_ACTIVITY_STATUSES = new Set([
  "done",
  "completed",
  "concluido",
  "finalizado",
]);

function coerceArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value == null) {
    return [];
  }

  return [value];
}

export function calculateProjectProgress(
  project?: Pick<Project, "checklist"> | null,
  activities: Array<Pick<Activity, "status">> | Pick<Activity, "status"> | null = [],
) {
  return getProjectProgressSummary(project, activities).percent;
}

export function getProjectProgressSummary(
  project?: Pick<Project, "checklist"> | null,
  activities: Array<Pick<Activity, "status">> | Pick<Activity, "status"> | null = [],
): ProjectProgressSummary {
  const activityList = coerceArray(activities).filter(
    (activity): activity is Pick<Activity, "status"> =>
      Boolean(activity && typeof activity === "object"),
  );

  if (activityList.length > 0) {
    const completedCount = activityList.filter((activity) =>
      isProjectActivityCompleted(activity.status),
    ).length;

    return {
      percent: toBoundedPercent(completedCount, activityList.length),
      source: "activities",
      completedCount,
      totalCount: activityList.length,
      helperText: "Calculado com base nas atividades concluídas.",
    };
  }

  const stageList = coerceArray(project?.checklist).filter(
    (stage): stage is ProjectStage => Boolean(stage && typeof stage === "object"),
  );

  if (stageList.length > 0) {
    const completedCount = stageList.filter((stage) => Boolean(stage?.completed)).length;

    return {
      percent: toBoundedPercent(completedCount, stageList.length),
      source: "stages",
      completedCount,
      totalCount: stageList.length,
      helperText: "Calculado com base nas etapas concluídas.",
    };
  }

  return {
    percent: 0,
    source: "none",
    completedCount: 0,
    totalCount: 0,
    helperText: "Nenhuma atividade ou etapa cadastrada para calcular o progresso.",
  };
}

export function isProjectActivityCompleted(status?: string | null) {
  return COMPLETED_ACTIVITY_STATUSES.has(normalizeComparisonValue(status));
}

function toBoundedPercent(completedCount: number, totalCount: number) {
  if (!totalCount) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((completedCount / totalCount) * 100)));
}

function normalizeComparisonValue(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
