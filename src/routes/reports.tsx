import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { BurndownChart, SlaChart, StatusPie, TechChart } from "@/components/dashboard/Charts";
import { listClients } from "@/services/clientService";
import { listProjects } from "@/services/projectService";
import { listTickets } from "@/services/ticketService";
import { listActivities } from "@/services/activityService";
import { listUsers } from "@/services/userService";
import { listSprints } from "@/services/sprintService";
import {
  buildDailyTicketTrend,
  buildReportSummary,
  buildSprintCapacitySeries,
  buildStatusDistribution,
  buildTechnicianLoad,
} from "@/services/analytics";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Relatórios · Stratos Suite" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const results = useQueries({
    queries: [
      { queryKey: ["report-clients"], queryFn: () => listClients() },
      { queryKey: ["report-projects"], queryFn: () => listProjects() },
      { queryKey: ["report-tickets"], queryFn: () => listTickets() },
      { queryKey: ["report-activities"], queryFn: () => listActivities() },
      { queryKey: ["report-users"], queryFn: () => listUsers() },
      { queryKey: ["report-sprints"], queryFn: () => listSprints() },
    ],
  });

  const [clients = [], projects = [], tickets = [], activities = [], users = [], sprints = []] = results.map((result) => result.data || []);
  const summary = buildReportSummary({ tickets, projects, clients, activities });
  const ticketTrend = buildDailyTicketTrend(tickets);
  const technicianLoad = buildTechnicianLoad(tickets, users);
  const sprintSeries = buildSprintCapacitySeries(sprints);
  const statusData = buildStatusDistribution(tickets);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Indicadores gerados a partir da API Django</p>
          </div>
          <div className="flex gap-2 text-xs">
            <button className="px-3 py-1.5 rounded-lg glass hover:border-primary/40 inline-flex items-center gap-1.5">
              <FileDown className="h-3.5 w-3.5" /> PDF
            </button>
            <button className="px-3 py-1.5 rounded-lg glass hover:border-primary/40 inline-flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summary.map((item) => (
            <div key={item.label} className="glass rounded-xl p-4 animate-fade-in-up">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="text-2xl font-semibold mt-1">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Chamados por dia"><SlaChart data={ticketTrend} /></Section>
          <Section title="Top técnicos"><TechChart data={technicianLoad} /></Section>
          <Section title="Capacidade por sprint"><BurndownChart data={sprintSeries} /></Section>
          <Section title="Distribuição por status"><StatusPie data={statusData} /></Section>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}
