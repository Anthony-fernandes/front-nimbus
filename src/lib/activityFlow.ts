import type { Activity, ActivityTimeEntry, SprintActivityPlan } from "@/lib/types";
import { toNumber } from "@/services/utils";

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatHoursLabel(value: number) {
  const rounded = roundHours(value);
  const normalized = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(2).replace(/\.?0+$/, "");

  return `${normalized}h`;
}

export function sumPlannedHours(plans: SprintActivityPlan[]) {
  return roundHours(
    plans.reduce((sum, plan) => sum + Math.max(0, toNumber(plan.plannedHours, 0)), 0),
  );
}

export function sumRealizedHours(entries: ActivityTimeEntry[]) {
  return roundHours(
    entries.reduce((sum, entry) => sum + Math.max(0, toNumber(entry.hours, 0)), 0),
  );
}

export function getActivityExecutionSummary(params: {
  activity?: Pick<Activity, "est_hours" | "done_hours"> | null;
  plans?: SprintActivityPlan[];
  timeEntries?: ActivityTimeEntry[];
}) {
  const estimatedHours = roundHours(Math.max(0, toNumber(params.activity?.est_hours, 0)));
  const plannedHours = sumPlannedHours(params.plans || []);
  const legacyRealizedHours = Math.max(0, toNumber(params.activity?.done_hours, 0));
  const timeEntryHours = sumRealizedHours(params.timeEntries || []);
  const realizedHours = roundHours(legacyRealizedHours + timeEntryHours);
  const estimatedBalanceHours = roundHours(estimatedHours - realizedHours);
  const plannedBalanceHours = roundHours(plannedHours - realizedHours);
  const estimatedOverflowHours = roundHours(Math.max(0, realizedHours - estimatedHours));

  return {
    estimatedHours,
    plannedHours,
    realizedHours,
    estimatedBalanceHours,
    plannedBalanceHours,
    estimatedOverflowHours,
    isEstimateExceeded: estimatedOverflowHours > 0,
  };
}

export function getSprintPlanExecutionSummary(
  plan: SprintActivityPlan,
  entries: ActivityTimeEntry[],
) {
  const plannedHours = roundHours(Math.max(0, toNumber(plan.plannedHours, 0)));
  const realizedHours = roundHours(
    entries
      .filter((entry) => entry.sprintId === plan.sprintId)
      .reduce((sum, entry) => sum + Math.max(0, toNumber(entry.hours, 0)), 0),
  );
  const differenceHours = roundHours(realizedHours - plannedHours);

  if (differenceHours > 0) {
    return {
      plannedHours,
      realizedHours,
      differenceHours,
      status: "over",
      label: `Estourou ${formatHoursLabel(differenceHours)}`,
    };
  }

  if (differenceHours < 0) {
    return {
      plannedHours,
      realizedHours,
      differenceHours,
      status: "under",
      label: `Restam ${formatHoursLabel(Math.abs(differenceHours))} planejadas`,
    };
  }

  return {
    plannedHours,
    realizedHours,
    differenceHours,
    status: "balanced",
    label: "Dentro do planejado",
  };
}
