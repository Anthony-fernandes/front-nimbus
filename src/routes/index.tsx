import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Ticket,
  AlertTriangle,
  Clock,
  FolderKanban,
  Rocket,
  Users,
  Timer,
  Activity as ActivityIcon,
  ArrowUpRight,
  CircleDot,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { BurndownChart, SlaChart, StatusPie, TechChart } from "@/components/dashboard/Charts";
import { getDashboard } from "@/services/dashboardService";
import { listTickets } from "@/services/ticketService";
import { listUsers } from "@/services/userService";
import { listSprints } from "@/services/sprintService";
import { listActivities } from "@/services/activityService";
import { listProjects } from "@/services/projectService";
import {
  buildDailyTicketTrend,
  buildProjectRiskRows,
  buildSprintCapacitySeries,
  buildStatusDistribution,
  buildTechnicianLoad,
  countActiveProjects,
  countOpenActivities,
  isTicketLate,
  sumUserHours,
} from "@/services/analytics";
import { formatDate, formatRelativeDate } from "@/services/utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · Stratos Suite" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
  });

  const results = useQueries({
    queries: [
      { queryKey: ["tickets"], queryFn: () => listTickets() },
      { queryKey: ["users"], queryFn: () => listUsers() },
      { queryKey: ["sprints"], queryFn: () => listSprints() },
      { queryKey: ["activities"], queryFn: () => listActivities() },
      { queryKey: ["projects"], queryFn: () => listProjects() },
    ],
  });

  const [tickets = [], users = [], sprints = [], activities = [], projects = []] = results.map((result) => result.data || []);

  const ticketTrend = buildDailyTicketTrend(tickets);
  const technicianLoad = buildTechnicianLoad(tickets, users);
  const sprintSeries = buildSprintCapacitySeries(sprints);
  const statusData = buildStatusDistribution(tickets);
  const riskProjects = dashboard?.projects_at_risk?.length
    ? dashboard.projects_at_risk.map((project) => ({
        id: project.id,
        name: project.name,
        risk: Math.max(0, 100 - Number(project.progress ?? 0)),
        due: project.due_at || "",
      }))
    : buildProjectRiskRows(projects);
  const recentTickets = dashboard?.recent_tickets?.length ? dashboard.recent_tickets : tickets.slice(0, 5);
  const recentActivities = activities.slice(0, 5);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Painel operacional</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão consolidada da operação · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-glow" />
              Backend Django conectado
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-muted-foreground">
              {sprints[0]?.name || "Sem sprint ativa"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Chamados abertos" value={String(dashboard?.tickets_open ?? tickets.filter((ticket) => ticket.status !== "Finalizado").length)} delta={0} icon={Ticket} accent="primary" />
          <StatCard label="Críticos" value={String(dashboard?.tickets_critical ?? tickets.filter((ticket) => ticket.priority === "Crítica").length)} delta={0} icon={AlertTriangle} accent="destructive" />
          <StatCard label="Atrasados" value={String(tickets.filter(isTicketLate).length)} delta={0} icon={Clock} accent="warning" />
          <StatCard label="Projetos ativos" value={String(dashboard?.projects_active ?? countActiveProjects(projects))} delta={0} icon={FolderKanban} accent="accent" />
          <StatCard label="Atividades abertas" value={String(dashboard?.activities ?? countOpenActivities(activities))} delta={0} icon={ActivityIcon} accent="primary" />
          <StatCard label="Usuários" value={String(users.length)} delta={0} icon={Users} accent="success" />
          <StatCard label="Horas capacidade" value={`${sumUserHours(users, "total_hours")}h`} delta={0} icon={Rocket} accent="accent" />
          <StatCard label="Horas usadas" value={`${sumUserHours(users, "used_hours")}h`} delta={0} icon={Timer} accent="success" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Chamados por dia" subtitle="Últimos registros abertos">
            <SlaChart data={ticketTrend} />
          </ChartCard>
          <ChartCard title="Chamados por técnico" subtitle="Volume por responsável">
            <TechChart data={technicianLoad} />
          </ChartCard>
          <ChartCard title="Capacidade por sprint" subtitle="Capacidade x story points">
            <BurndownChart data={sprintSeries} />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 glass rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Últimos chamados</h3>
                <p className="text-xs text-muted-foreground">Direto da API Django</p>
              </div>
              <button className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-1.5">
              {recentTickets.map((ticket) => (
                <div key={ticket.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer">
                  <CircleDot className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-mono text-muted-foreground w-20">{ticket.code || ticket.id}</span>
                  <span className="flex-1 text-sm truncate">{ticket.title}</span>
                  <PriorityPill priority={ticket.priority || "Média"} />
                  <span className="hidden md:inline text-xs text-muted-foreground w-16 text-right">SLA {ticket.sla || "8h"}</span>
                  <StatusPill status={ticket.status || "Triagem"} />
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Status de chamados</h3>
                <p className="text-xs text-muted-foreground">Distribuição atual</p>
              </div>
            </div>
            <StatusPie data={statusData} />
            <div className="mt-3 space-y-1.5">
              {statusData.map((status) => (
                <div key={status.name} className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: status.color }} />
                    {status.name}
                  </span>
                  <span className="text-muted-foreground">{status.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5 shadow-card">
            <h3 className="font-semibold">Projetos em risco</h3>
            <p className="text-xs text-muted-foreground mb-4">Estimativa baseada no progresso registrado</p>
            <div className="space-y-3">
              {riskProjects.map((project) => (
                <div key={project.id || project.name} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{project.name}</span>
                    <span className="text-xs text-muted-foreground">entrega {project.due ? formatDate(project.due) : "sem prazo"}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${project.risk}%`,
                        background: project.risk > 70 ? "oklch(0.65 0.24 25)" : project.risk > 50 ? "oklch(0.82 0.17 85)" : "oklch(0.72 0.18 155)",
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Risco {project.risk}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 shadow-card">
            <h3 className="font-semibold">Atividades recentes</h3>
            <p className="text-xs text-muted-foreground mb-4">Últimas alterações recebidas da API</p>
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 text-sm">
                  <div className="h-7 w-7 rounded-full bg-gradient-primary grid place-items-center text-[10px] font-semibold text-primary-foreground shrink-0">
                    {(activity.assignee_name || "ST").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{activity.assignee_name || "Sem responsável"}</span>{" "}
                      <span className="text-muted-foreground">atualizou</span>{" "}
                      <span className="text-foreground">{activity.title}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">{activity.status || "Backlog"} · {formatRelativeDate(activity.updated_at || activity.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5 shadow-card animate-fade-in-up">
      <div className="mb-3">
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    Crítica: "bg-destructive/15 text-destructive border-destructive/30",
    Alta: "bg-warning/15 text-warning border-warning/30",
    Média: "bg-info/15 text-info border-info/30",
    Baixa: "bg-muted text-muted-foreground border-border",
  };

  return <span className={`hidden sm:inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md border ${map[priority]}`}>{priority}</span>;
}

function StatusPill({ status }: { status: string }) {
  return <span className="text-[11px] px-2 py-1 rounded-md bg-muted/60 text-muted-foreground border border-border whitespace-nowrap">{status}</span>;
}
