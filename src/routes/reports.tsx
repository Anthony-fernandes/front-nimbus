import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { BurndownChart, SlaChart, StatusPie, TechChart } from "@/components/dashboard/Charts";
import { Button } from "@/components/ui/button";
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
import { exportReportCSV, getRatingsReport, getSLAReport, getTicketsReport } from "@/services/reportService";
import type { Activity, Organization, Project, Sprint, Ticket, User } from "@/lib/types";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Relatórios · Stratos Suite" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const dateParams = { date_from: dateFrom, date_to: dateTo };

  const slaReportQuery = useQuery({ queryKey: ["report-sla", dateFrom, dateTo], queryFn: () => getSLAReport(dateParams) });
  const ratingsQuery = useQuery({ queryKey: ["report-ratings", dateFrom, dateTo], queryFn: () => getRatingsReport(dateParams) });

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

  const clients = (results[0].data || []) as Organization[];
  const projects = (results[1].data || []) as Project[];
  const tickets = (results[2].data || []) as Ticket[];
  const activities = (results[3].data || []) as Activity[];
  const users = (results[4].data || []) as User[];
  const sprints = (results[5].data || []) as Sprint[];
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
            <p className="text-sm text-muted-foreground">Indicadores e exportações do período selecionado</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-lg border border-border bg-muted/30 px-2 text-xs text-foreground" />
            <span className="text-xs text-muted-foreground">até</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-lg border border-border bg-muted/30 px-2 text-xs text-foreground" />
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => exportReportCSV("tickets", { date_from: dateFrom, date_to: dateTo })}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Chamados CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => exportReportCSV("sla", { date_from: dateFrom, date_to: dateTo })}>
              <FileDown className="h-3.5 w-3.5" /> SLA CSV
            </Button>
          </div>
        </div>

        {/* SLA summary */}
        {slaReportQuery.data && (
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Chamados com SLA</div>
              <div className="text-2xl font-semibold mt-1">{slaReportQuery.data.total}</div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground">SLA violado (abertos)</div>
              <div className="text-2xl font-semibold mt-1 text-destructive">{slaReportQuery.data.breached_open}</div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Taxa dentro do prazo</div>
              <div className="text-2xl font-semibold mt-1 text-success">{slaReportQuery.data.on_time_rate}%</div>
            </div>
          </div>
        )}

        {/* Ratings summary */}
        {ratingsQuery.data && ratingsQuery.data.total_rated > 0 && (
          <div className="glass rounded-xl p-4 flex items-center gap-6">
            <div>
              <div className="text-xs text-muted-foreground">Avaliações recebidas</div>
              <div className="text-2xl font-semibold">{ratingsQuery.data.total_rated}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Nota média</div>
              <div className="text-2xl font-semibold text-warning">{"★".repeat(Math.round(ratingsQuery.data.average))} {ratingsQuery.data.average}/5</div>
            </div>
          </div>
        )}

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
