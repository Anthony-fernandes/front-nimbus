import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus, Rocket, Target, Zap } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Can } from "@/components/app/Can";
import { TablePagination } from "@/components/app/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import { Input } from "@/components/ui/input";
import { listTeams } from "@/services/teamService";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getSprintMetrics, listSprints } from "@/services/sprintService";
import type { Sprint } from "@/lib/types";

// Progresso real da sprint (itens concluídos ÷ itens planejados), calculado no backend
function pct(sprint: Sprint) {
  return Math.min(100, Math.max(0, Math.round(sprint.progress_pct ?? 0)));
}

export const Route = createFileRoute("/sprints")({
  head: () => ({ meta: [{ title: "Sprints · NimbusDesk" }] }),
  validateSearch: (s): { team?: string; context?: string } => {
    const out: { team?: string; context?: string } = {};
    if (s.team) out.team = String(s.team);
    if (s.context) out.context = String(s.context);
    return out;
  },
  component: SprintsPage,
});


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

  // ── Sprint em foco ─────────────────────────────────────────────
  // Auto-seleção: sprint ativa mais recente da equipe → próxima planejada → mais recente.
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    setFocusId(null); // trocar de equipe/filtros re-seleciona automaticamente
  }, [teamFilter]);

  const pickDefaultFocus = (list: Sprint[]) => {
    const byStartDesc = (a: Sprint, b: Sprint) => (b.start_at || "").localeCompare(a.start_at || "");
    const byStartAsc = (a: Sprint, b: Sprint) => (a.start_at || "").localeCompare(b.start_at || "");
    const running = list.filter((s) => s.status === "Em andamento").sort(byStartDesc);
    if (running.length) return running[0];
    const planned = list.filter((s) => s.status === "Planejada").sort(byStartAsc);
    if (planned.length) return planned[0];
    return [...list].sort(byStartDesc)[0];
  };
  const focused = sprints.find((s) => s.id === focusId) ?? (sprints.length ? pickDefaultFocus(sprints) : undefined);

  const metricsQ = useQuery({
    queryKey: ["sprint-metrics", focused?.id],
    queryFn: () => getSprintMetrics(focused!.id),
    enabled: Boolean(focused),
  });
  const metrics = metricsQ.data;

  const listStats = {
    total: sprints.length,
    running: sprints.filter((s) => s.status === "Em andamento").length,
    planned: sprints.filter((s) => s.status === "Planejada").length,
    finished: sprints.filter((s) => s.status === "Finalizada").length,
  };

  if (pathname !== "/sprints") {
    return <Outlet />;
  }

  const selectedTeam = teams.find((t) => t.id === teamFilter);
  const teamContextLabel =
    teamFilter === "none" ? "Sem equipe" : selectedTeam?.name || "Todas as equipes";
  const statusTone =
    focused?.status === "Em andamento"
      ? "bg-success/15 text-success"
      : focused?.status === "Finalizada"
        ? "bg-muted text-muted-foreground"
        : "bg-info/15 text-info";

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">Sprints</h1>
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: selectedTeam?.color || "#94a3b8" }}
                />
                {teamContextLabel}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Carregando planejamento..." : `${sprints.length} sprints cadastradas`}
            </p>
          </div>
          <Can permission="sprints.create">
            <Button
              asChild
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <a href="/sprints/new">
                <Plus className="h-4 w-4" /> Nova sprint
              </a>
            </Button>
          </Can>
        </div>

        {!isLoading && sprints.length === 0 ? (
          <div className="glass grid place-items-center gap-2 rounded-2xl p-10 text-center shadow-card">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <Rocket className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="font-semibold">
              Nenhuma sprint {teamFilter ? `em "${teamContextLabel}"` : "cadastrada"}
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {teamFilter
                ? "Esta equipe ainda não possui sprints. Crie uma nova sprint ou selecione outra equipe na barra lateral."
                : "Crie a primeira sprint para começar o planejamento do time."}
            </p>
          </div>
        ) : focused ? (
          <div className="space-y-3">
            {/* Barra da sprint em foco: identifica claramente de qual sprint são os cards */}
            <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-card">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
                  <Rocket className="h-4.5 w-4.5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Sprint em foco — os indicadores abaixo são somente desta sprint
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold leading-tight">{focused.name}</h3>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusTone}`}>
                      {focused.status || "Planejada"}
                    </span>
                    {focused.status === "Em andamento" && (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-success" title="Sprint ativa" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {focused.team_name || "Sem equipe"}
                    {focused.start_at ? ` · ${focused.start_at} a ${focused.end_at || "--"}` : ""}
                  </p>
                </div>
              </div>

              {/* Seletor de sprint em foco */}
              <select
                value={focused.id}
                onChange={(e) => setFocusId(e.target.value)}
                className="h-9 max-w-full rounded-lg border border-border bg-background px-3 text-xs"
                title="Trocar sprint em foco"
              >
                {[...sprints]
                  .sort((a, b) => (b.start_at || "").localeCompare(a.start_at || ""))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.status === "Em andamento" ? "● " : ""}
                      {s.name} — {s.status || "Planejada"} · {s.team_name || "Sem equipe"}
                      {s.start_at ? ` · ${s.start_at} a ${s.end_at || "--"}` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="glass rounded-2xl p-5 shadow-card lg:col-span-2">

              {metricsQ.isLoading ? (
                <div className="grid h-40 place-items-center text-sm text-muted-foreground">
                  Carregando indicadores...
                </div>
              ) : !metrics || metrics.total_items === 0 ? (
                <div className="grid h-40 place-items-center text-center text-sm text-muted-foreground">
                  Nenhum item planejado nesta sprint ainda.
                  <br />
                  Use o planejamento para adicionar atividades e chamados.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Progresso geral */}
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progresso da sprint</span>
                      <span className="font-semibold text-foreground">
                        {metrics.done}/{metrics.total_items} itens · {metrics.progress_pct}%
                      </span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/40">
                      {metrics.done > 0 && (
                        <div className="bg-success" style={{ width: `${(metrics.done / metrics.total_items) * 100}%` }} />
                      )}
                      {metrics.in_progress > 0 && (
                        <div className="bg-info" style={{ width: `${(metrics.in_progress / metrics.total_items) * 100}%` }} />
                      )}
                      {metrics.blocked > 0 && (
                        <div className="bg-destructive" style={{ width: `${(metrics.blocked / metrics.total_items) * 100}%` }} />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-success" /> Concluídos {metrics.done}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-info" /> Em andamento {metrics.in_progress}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Pendentes {metrics.pending}
                      </span>
                      {metrics.blocked > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-destructive" /> Bloqueados {metrics.blocked}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Horas apontadas vs planejadas */}
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Horas apontadas</span>
                      <span className="font-semibold text-foreground">
                        {metrics.hours_done.toFixed(1)}h de {metrics.hours_planned.toFixed(1)}h planejadas
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, metrics.hours_planned ? (metrics.hours_done / metrics.hours_planned) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Composição */}
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{metrics.activities} atividades</span>
                    <span>{metrics.tickets} chamados</span>
                    <span>Capacidade planejada: {metrics.capacity_used_pct}% de {metrics.capacity}h</span>
                  </div>
                </div>
              )}
            </div>

              {/* Risco da sprint */}
              <div className="glass rounded-2xl p-5 shadow-card">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Risco da sprint</div>
                <div
                  className={`mt-1 text-2xl font-semibold capitalize ${
                    metrics?.risk === "alto"
                      ? "text-destructive"
                      : metrics?.risk === "medio"
                        ? "text-warning"
                        : "text-success"
                  }`}
                >
                  {metrics?.risk === "medio" ? "Médio" : metrics?.risk === "alto" ? "Alto" : "Baixo"}
                </div>
                {metrics?.risk_reasons?.length ? (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {metrics.risk_reasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Sem sinais de risco no momento.</p>
                )}
                <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Capacidade usada</span>
                    <span className="font-semibold text-foreground">{metrics?.capacity_used_pct ?? 0}% de {metrics?.capacity ?? focused.capacity ?? 0}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Story points</span>
                    <span className="font-semibold text-foreground">
                      {metrics ? `${metrics.story_points_done}/${metrics.story_points_planned} sp` : "0 sp"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Horas</span>
                    <span className="font-semibold text-foreground">
                      {metrics ? `${metrics.hours_done.toFixed(0)}h / ${metrics.hours_planned.toFixed(0)}h` : "0h"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPIs da sprint em foco */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <Mini icon={Rocket} label="Total de itens" value={String(metrics?.total_items ?? 0)} accent="primary" />
              <Mini icon={CheckCircle2} label="Concluídos" value={String(metrics?.done ?? 0)} accent="success" />
              <Mini icon={Zap} label="Em andamento" value={String(metrics?.in_progress ?? 0)} accent="accent" />
              <Mini icon={Target} label="Atrasados" value={String(metrics?.overdue ?? 0)} accent="primary" />
              <Mini icon={Target} label="Bloqueados" value={String(metrics?.blocked ?? 0)} accent="primary" />
              <Mini icon={Target} label="Bugs" value={String(metrics?.bugs ?? 0)} accent="accent" />
            </div>
          </div>
        ) : null}

        {/* Visão geral da lista (secundária, não compete com a sprint em foco) */}
        {sprints.length > 0 && (
          <p className="px-1 text-xs text-muted-foreground">
            Visão geral das sprints filtradas: {listStats.total} no total · {listStats.running} em andamento ·{" "}
            {listStats.planned} planejadas · {listStats.finished} finalizadas
          </p>
        )}

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
            <Can permission="sprints.create">
              <a href="/sprints/new" className="text-xs text-primary hover:underline">
                + Nova sprint
              </a>
            </Can>
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
                  <td className="px-2 py-3 font-mono text-xs">{sprint.points_done ?? 0}/{sprint.points_planned ?? 0} sp</td>
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
