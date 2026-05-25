import type { Activity, Project, Sprint, Ticket, User } from "@/lib/types";

type SimplePoint = {
  label: string;
  value: number;
};

type StatusPoint = {
  name: string;
  value: number;
  color: string;
};

type TrendPoint = {
  day: string;
  sla: number;
};

type ComparisonPoint = {
  day: string;
  ideal: number;
  real: number;
};

const STATUS_COLORS: Record<string, string> = {
  Triagem: "oklch(0.68 0.025 260)",
  "Em atendimento": "oklch(0.72 0.20 260)",
  "Aguardando cliente": "oklch(0.82 0.17 85)",
  Validação: "oklch(0.72 0.16 210)",
  Pausado: "oklch(0.62 0.02 260)",
  Finalizado: "oklch(0.72 0.18 155)",
  Backlog: "oklch(0.62 0.02 260)",
  "A fazer": "oklch(0.68 0.025 260)",
  "Em progresso": "oklch(0.72 0.20 260)",
  "Em revisão": "oklch(0.72 0.16 210)",
  Bloqueado: "oklch(0.82 0.17 85)",
  Concluído: "oklch(0.72 0.18 155)",
};

function formatShortWeekday(date: Date) {
  return date.toLocaleDateString("pt-BR", { weekday: "short" });
}

function takeLast<T>(items: T[], count: number) {
  return items.slice(Math.max(0, items.length - count));
}

export function isTicketLate(ticket: Ticket) {
  return Boolean(
    ticket.due_at &&
      new Date(ticket.due_at).getTime() < Date.now() &&
      ticket.status !== "Finalizado",
  );
}

export function countActiveProjects(projects: Project[]) {
  return projects.filter((project) => project.status !== "Concluído").length;
}

export function countOpenActivities(activities: Activity[]) {
  return activities.filter((activity) => activity.status !== "Concluído").length;
}

export function sumUserHours(users: User[], key: "total_hours" | "used_hours") {
  return users.reduce((total, user) => total + Number(user[key] ?? 0), 0);
}

export function buildDailyTicketTrend(tickets: Ticket[]): TrendPoint[] {
  const buckets = new Map<string, number>();

  tickets.forEach((ticket) => {
    const rawDate = ticket.opened_at || ticket.created_at;
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  return takeLast([...buckets.entries()], 7).map(([date, total]) => ({
    day: formatShortWeekday(new Date(date)),
    sla: total,
  }));
}

export function buildTechnicianLoad(
  tickets: Ticket[],
  users: User[],
): Array<{ name: string; chamados: number }> {
  const userNamesById = new Map(
    users.map((user) => [
      user.id,
      user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Sem nome",
    ]),
  );

  const counts = new Map<string, number>();

  tickets.forEach((ticket) => {
    if (ticket.technicians?.length) {
      ticket.technicians.forEach((technicianId) => {
        const name = userNamesById.get(technicianId);
        if (!name) return;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      });
      return;
    }

    ticket.technician_names?.forEach((name) => {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, chamados]) => ({ name, chamados }));
}

export function buildSprintCapacitySeries(sprints: Sprint[]): ComparisonPoint[] {
  return takeLast(
    sprints
      .slice()
      .sort((a, b) => {
        const left = new Date(a.start_at || a.created_at || 0).getTime();
        const right = new Date(b.start_at || b.created_at || 0).getTime();
        return left - right;
      }),
    7,
  ).map((sprint, index) => ({
    day: sprint.name || `Sprint ${index + 1}`,
    ideal: Number(sprint.capacity ?? 0),
    real: Number(sprint.story_points ?? 0),
  }));
}

export function buildStatusDistribution(
  rows: Array<Pick<Ticket, "status"> | Pick<Activity, "status">>,
): StatusPoint[] {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const status = row.status || "Sem status";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });

  return [...counts.entries()].map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name] || "oklch(0.68 0.025 260)",
  }));
}

export function buildProjectRiskRows(projects: Project[]) {
  return projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      risk: Math.max(0, 100 - Number(project.progress ?? 0)),
      due: project.due_at || "",
    }))
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 5);
}

export function buildReportSummary(args: {
  tickets: Ticket[];
  projects: Project[];
  clients: { id: string }[];
  activities: Activity[];
}) {
  const { tickets, projects, clients, activities } = args;

  return [
    { label: "Clientes", value: String(clients.length) },
    { label: "Projetos ativos", value: String(countActiveProjects(projects)) },
    { label: "Chamados atrasados", value: String(tickets.filter(isTicketLate).length) },
    { label: "Atividades abertas", value: String(countOpenActivities(activities)) },
  ] satisfies SimplePoint[];
}
