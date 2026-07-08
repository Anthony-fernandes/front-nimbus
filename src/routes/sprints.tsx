import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus, Rocket, Target, Zap } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { TablePagination } from "@/components/app/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import { Input } from "@/components/ui/input";
import { listTeams } from "@/services/teamService";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BurndownChart } from "@/components/dashboard/Charts";
import type { Sprint } from "@/lib/types";
import { buildSprintCapacitySeries } from "@/services/analytics";
import { listSprints } from "@/services/sprintService";

export const Route = createFileRoute("/sprints")({
  head: () => ({ meta: [{ title: "Sprints · NimbusDesk" }] }),
  validateSearch: (s) => ({ team: (s.team as string) || "" }),
  component: SprintsPage,
});

function pct(sprint: Sprint) {
  return sprint.story_points
    ? Math.min(
        100,
        Math.round(((sprint.story_points || 0) / (sprint.capacity || sprint.story_points || 1)) * 100),
      )
    : 0;
}

function SprintsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { team: teamParam } = Route.useSearch();
  const [teamFilter, setTeamFilter] = useState(teamParam || "");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Mantém o filtro sincronizado quando a navegação vem da sidebar já dentro de /sprints
  useEffect(() => {
    setTeamFilter(teamParam || "");
  }, [teamParam]);
  const { data: allSprints = [], isLoading } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => listSprints(),
  });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: listTeams });

  const sprints = allSprints.filter((s) => {
    const teamId = (s as { team?: string | null }).team;
    if (teamFilter === "none" && teamId) return false;
    if (teamFilter && teamFilter !== "none" && teamId !== teamFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
  const pag = usePagination(sprints, `${teamFilter}|${statusFilter}|${searchTerm}`);

  if (pathname !== "/sprints") {
    return <Outlet />;
  }

  const active =
    sprints.find((s) => s.status === "Em andamento") ||
    sprints.find((s) => s.status === "Planejada") ||
    sprints[0];
  const chartData = buildSprintCapacitySeries(sprints);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sprints</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Carregando planejamento..." : `${sprints.length} sprints cadastradas`}
            </p>
          </div>
          <Button
            asChild
            className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <a href="/sprints/new">
              <Plus className="h-4 w-4" /> Nova sprint
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="glass rounded-2xl p-5 shadow-card lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
                  <Rocket className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">{active?.name || "Nenhuma sprint cadastrada"}</h3>
                  <p className="text-xs text-muted-foreground">
                    {active?.start_at || "--"} a {active?.end_at || "--"}
                  </p>
                </div>
              </div>
              <span className="rounded bg-success/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-success">
                {active?.status || "Planejada"}
              </span>
            </div>
            <BurndownChart data={chartData} />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Mini icon={Target} label="Capacidade" value={`${active?.capacity ?? 0} h`} accent="primary" />
            <Mini icon={CheckCircle2} label="Story points" value={`${active?.story_points ?? 0} sp`} accent="success" />
            <Mini icon={Zap} label="Entrega" value={`${pct(active || ({} as Sprint))}%`} accent="accent" />
            <Mini icon={Rocket} label="Sprints" value={String(sprints.length)} accent="primary" />
          </div>
        </div>

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
            <h3 className="font-semibold">Sprints</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar sprint..."
                className="h-8 w-44 text-xs"
              />
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="">Todas as equipes</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option value="none">Sem equipe</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="">Todos os status</option>
                {["Planejada", "Em andamento", "Concluída", "Cancelada"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <a href="/sprints/new" className="text-xs text-primary hover:underline">
              + Nova sprint
            </a>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Sprint</th>
                <th className="px-2 py-2.5 text-left font-medium">Equipe</th>
                <th className="px-2 py-2.5 text-left font-medium">Status</th>
                <th className="px-2 py-2.5 text-left font-medium">Capacidade</th>
                <th className="px-2 py-2.5 text-left font-medium">SP</th>
                <th className="px-4 py-2.5 text-left font-medium">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {pag.pageRows.map((sprint) => (
                <tr key={sprint.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link to="/sprints/$id" params={{ id: sprint.id }} className="hover:text-primary">
                      {sprint.name}
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">
                    {(sprint as { team_name?: string }).team_name || "—"}
                  </td>
                  <td className="px-2 py-3">
                    <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                      {sprint.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 font-mono text-xs">{sprint.capacity} h</td>
                  <td className="px-2 py-3 font-mono text-xs">{sprint.story_points} sp</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 max-w-[160px] flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-gradient-primary" style={{ width: `${pct(sprint)}%` }} />
                      </div>
                      <span className="w-9 text-xs text-muted-foreground">{pct(sprint)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination
            page={pag.page}
            totalPages={pag.totalPages}
            total={pag.total}
            pageSize={pag.pageSize}
            onPageChange={pag.setPage}
            onPageSizeChange={pag.setPageSize}
          />
        </div>
      </div>
    </AppShell>
  );
}

function Mini({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent: "primary" | "accent" | "success";
}) {
  const map = { primary: "text-primary", accent: "text-accent", success: "text-success" } as const;

  return (
    <div className="glass animate-fade-in-up rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${map[accent]}`} />
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
