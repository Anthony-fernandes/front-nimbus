import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bug, ListTodo, Rocket, Ticket as TicketIcon } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { getTeam } from "@/services/teamService";
import { listSprints } from "@/services/sprintService";
import { listTickets } from "@/services/ticketService";
import { listActivities } from "@/services/activityService";
import { formatDate } from "@/services/utils";
import { formatSprintStatusLabel } from "@/lib/labels";
import type { Activity, Sprint, Team, Ticket } from "@/lib/types";

export type TeamSection = "sprints" | "tarefas" | "chamados" | "bugs";

const SECTIONS: { key: TeamSection; label: string; icon: typeof Rocket; to: string }[] = [
  { key: "sprints", label: "Sprints", icon: Rocket, to: "sprints" },
  { key: "tarefas", label: "Tarefas", icon: ListTodo, to: "tarefas" },
  { key: "chamados", label: "Chamados", icon: TicketIcon, to: "chamados" },
  { key: "bugs", label: "Bugs", icon: Bug, to: "bugs" },
];

function isBug(activity: Activity) {
  return (activity.type || "").toLowerCase().includes("bug");
}

/** Tela contextualizada de uma equipe: Sprints, Tarefas, Chamados ou Bugs. */
export function TeamWorkspace({ teamId, section }: { teamId: string; section: TeamSection }) {
  const teamQ = useQuery<Team>({ queryKey: ["team", teamId], queryFn: () => getTeam(teamId) });
  const team = teamQ.data;
  const color = team?.color || "#6366f1";

  const memberIds = useMemo(
    () => new Set((team?.members ?? []).map((m) => String(m.user))),
    [team],
  );

  // Sprints da equipe (fonte para o mapa sprint→equipe usado por tarefas/bugs).
  const sprintsQ = useQuery({ queryKey: ["team-sprints", teamId], queryFn: () => listSprints() });
  const teamSprints = useMemo(
    () => (sprintsQ.data ?? []).filter((s) => String(s.team || "") === teamId),
    [sprintsQ.data, teamId],
  );
  const teamSprintIds = useMemo(() => new Set(teamSprints.map((s) => String(s.id))), [teamSprints]);

  const ticketsQ = useQuery({
    queryKey: ["team-tickets", teamId],
    queryFn: () => listTickets(),
    enabled: section === "chamados",
  });
  const activitiesQ = useQuery({
    queryKey: ["team-activities", teamId],
    queryFn: () => listActivities(),
    enabled: section === "tarefas" || section === "bugs",
  });

  const teamTickets = useMemo(() => {
    const rows = (ticketsQ.data as Ticket[] | undefined) ?? [];
    return rows.filter(
      (t) =>
        String(t.team || "") === teamId ||
        (t.responsible_technician && memberIds.has(String(t.responsible_technician))) ||
        (t.technicians || []).some((id) => memberIds.has(String(id))),
    );
  }, [ticketsQ.data, teamId, memberIds]);

  // Atividade pertence à equipe se: responsável é membro, ou está numa sprint da equipe.
  const activityBelongs = (a: Activity) =>
    (a.assignee && memberIds.has(String(a.assignee))) ||
    (a.assignees || []).some((id) => memberIds.has(String(id))) ||
    (a.sprint && teamSprintIds.has(String(a.sprint)));

  const teamActivities = useMemo(() => {
    const rows = (activitiesQ.data as Activity[] | undefined) ?? [];
    return rows.filter((a) => activityBelongs(a) && !isBug(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activitiesQ.data, memberIds, teamSprintIds]);

  const teamBugs = useMemo(() => {
    const rows = (activitiesQ.data as Activity[] | undefined) ?? [];
    return rows.filter((a) => activityBelongs(a) && isBug(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activitiesQ.data, memberIds, teamSprintIds]);

  const loading =
    teamQ.isLoading ||
    (section === "sprints" && sprintsQ.isLoading) ||
    (section === "chamados" && ticketsQ.isLoading) ||
    ((section === "tarefas" || section === "bugs") && (activitiesQ.isLoading || sprintsQ.isLoading));

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Cabeçalho com contexto da equipe */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            <div>
              <Link
                to="/teams"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Equipes
              </Link>
              <h1 className="text-2xl font-semibold tracking-tight">
                {team?.name || "Equipe"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {SECTIONS.find((s) => s.key === section)?.label} da equipe
              </p>
            </div>
          </div>
        </div>

        {/* Sub-navegação das seções da equipe */}
        <div className="flex flex-wrap gap-1 border-b border-border">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.key === section;
            return (
              <Link
                key={s.key}
                to={`/teams/${teamId}/${s.to}`}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {s.label}
              </Link>
            );
          })}
        </div>

        {loading ? (
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : section === "sprints" ? (
          <SprintsList sprints={teamSprints} />
        ) : section === "chamados" ? (
          <TicketsList tickets={teamTickets} />
        ) : section === "tarefas" ? (
          <ActivitiesList activities={teamActivities} emptyLabel="Nenhuma tarefa para esta equipe." />
        ) : (
          <ActivitiesList activities={teamBugs} emptyLabel="Nenhum bug para esta equipe." isBug />
        )}
      </div>
    </AppShell>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-10 text-center text-sm text-muted-foreground">{label}</div>
  );
}

function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
          {head}
        </thead>
        <tbody className="divide-y divide-border/60">{children}</tbody>
      </table>
    </div>
  );
}

function SprintsList({ sprints }: { sprints: Sprint[] }) {
  if (!sprints.length) return <EmptyRow label="Nenhuma sprint para esta equipe." />;
  return (
    <Table
      head={
        <tr>
          <th className="px-4 py-2.5">Sprint</th>
          <th className="px-4 py-2.5">Status</th>
          <th className="px-4 py-2.5">Período</th>
          <th className="px-4 py-2.5 text-right">Progresso</th>
        </tr>
      }
    >
      {sprints.map((s) => (
        <tr key={s.id} className="transition-colors hover:bg-muted/20">
          <td className="px-4 py-2.5">
            <Link to="/sprints/$id" params={{ id: s.id }} className="font-medium hover:text-primary">
              {s.name}
            </Link>
          </td>
          <td className="px-4 py-2.5 text-muted-foreground">{formatSprintStatusLabel(s.status || "")}</td>
          <td className="px-4 py-2.5 text-muted-foreground">
            {s.start_at ? formatDate(s.start_at) : "—"} → {s.end_at ? formatDate(s.end_at) : "—"}
          </td>
          <td className="px-4 py-2.5 text-right text-muted-foreground">{s.progress_pct ?? 0}%</td>
        </tr>
      ))}
    </Table>
  );
}

function TicketsList({ tickets }: { tickets: Ticket[] }) {
  if (!tickets.length) return <EmptyRow label="Nenhum chamado para esta equipe." />;
  return (
    <Table
      head={
        <tr>
          <th className="px-4 py-2.5">Código</th>
          <th className="px-4 py-2.5">Título</th>
          <th className="px-4 py-2.5">Status</th>
          <th className="px-4 py-2.5">Prioridade</th>
        </tr>
      }
    >
      {tickets.map((t) => (
        <tr key={t.id} className="transition-colors hover:bg-muted/20">
          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.code || t.id.slice(0, 8)}</td>
          <td className="px-4 py-2.5">
            <Link to="/tickets/$id" params={{ id: t.id }} className="font-medium hover:text-primary">
              {t.title}
            </Link>
          </td>
          <td className="px-4 py-2.5 text-muted-foreground">{t.status || "—"}</td>
          <td className="px-4 py-2.5 text-muted-foreground">{t.priority || "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

function ActivitiesList({
  activities,
  emptyLabel,
  isBug: bugMode,
}: {
  activities: Activity[];
  emptyLabel: string;
  isBug?: boolean;
}) {
  if (!activities.length) return <EmptyRow label={emptyLabel} />;
  return (
    <Table
      head={
        <tr>
          <th className="px-4 py-2.5">{bugMode ? "Bug" : "Tarefa"}</th>
          <th className="px-4 py-2.5">Projeto</th>
          <th className="px-4 py-2.5">Status</th>
          <th className="px-4 py-2.5">Responsável</th>
        </tr>
      }
    >
      {activities.map((a) => (
        <tr key={a.id} className="transition-colors hover:bg-muted/20">
          <td className="px-4 py-2.5">
            <Link to="/activities/$id" params={{ id: a.id }} className="font-medium hover:text-primary">
              {a.title}
            </Link>
          </td>
          <td className="px-4 py-2.5 text-muted-foreground">{a.project_name || "—"}</td>
          <td className="px-4 py-2.5 text-muted-foreground">{a.status || "—"}</td>
          <td className="px-4 py-2.5 text-muted-foreground">{a.assignee_name || "Sem responsável"}</td>
        </tr>
      ))}
    </Table>
  );
}
