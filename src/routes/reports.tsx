import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet, Table2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import { AppShell } from "@/components/app/AppShell";
import { CardSkeleton } from "@/components/app/CardSkeleton";
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
import { exportReportCSV, exportReportExcel, getRatingsReport, getSLAReport, getTicketsReport } from "@/services/reportService";
import type { Activity, Organization, Project, Sprint, Ticket, User } from "@/lib/types";

const tooltipStyle = {
  background: "oklch(0.20 0.018 265)",
  border: "1px solid oklch(0.30 0.02 265)",
  borderRadius: 12,
  fontSize: 12,
  color: "oklch(0.97 0.01 250)",
  padding: "8px 10px",
};

const RATING_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#22c55e",
};

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Relatórios · Stratos Suite" }] }),
  component: ReportsPage,
});

type ReportType = "tickets" | "sla" | "ratings";

function getWeekRanges(count: number) {
  const ranges: { date_from: string; date_to: string; label: string }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    ranges.push({
      date_from: start.toISOString().slice(0, 10),
      date_to: end.toISOString().slice(0, 10),
      label: `Sem ${count - i}`,
    });
  }
  return ranges;
}

function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("tickets");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const dateParams = { date_from: dateFrom, date_to: dateTo };

  const slaReportQuery = useQuery({ queryKey: ["report-sla", dateFrom, dateTo], queryFn: () => getSLAReport(dateParams) });
  const ratingsQuery = useQuery({ queryKey: ["report-ratings", dateFrom, dateTo], queryFn: () => getRatingsReport(dateParams) });
  const ticketsReportQuery = useQuery({ queryKey: ["report-tickets-api", dateFrom, dateTo], queryFn: () => getTicketsReport(dateParams) });

  const slaWeekRanges = getWeekRanges(4);
  const slaWeekQueries = useQueries({
    queries: slaWeekRanges.map((range) => ({
      queryKey: ["report-sla-week", range.date_from, range.date_to],
      queryFn: () => getSLAReport({ date_from: range.date_from, date_to: range.date_to }),
    })),
  });

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
  const isLoadingAll = results.some((r) => r.isLoading);
  const summary = buildReportSummary({ tickets, projects, clients, activities });
  const ticketTrend = buildDailyTicketTrend(tickets);
  const technicianLoad = buildTechnicianLoad(tickets, users);
  const sprintSeries = buildSprintCapacitySeries(sprints);
  const statusData = buildStatusDistribution(tickets);

  const ticketWeeklyData = (ticketsReportQuery.data?.by_date ?? []) as {
    semana: string;
    Abertos: number;
    Finalizados: number;
  }[];

  const slaWeeklyTrendData = slaWeekRanges.map((range, i) => ({
    semana: range.label,
    "Taxa no prazo": slaWeekQueries[i].data?.on_time_rate ?? 0,
  }));

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
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => exportReportExcel("tickets", { date_from: dateFrom, date_to: dateTo })}>
              <Table2 className="h-3.5 w-3.5" /> Chamados Excel
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => exportReportCSV("sla", { date_from: dateFrom, date_to: dateTo })}>
              <FileDown className="h-3.5 w-3.5" /> SLA CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => exportReportExcel("sla", { date_from: dateFrom, date_to: dateTo })}>
              <Table2 className="h-3.5 w-3.5" /> SLA Excel
            </Button>
          </div>
        </div>

        {/* Report type selector */}
        <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
          {(["tickets", "sla", "ratings"] as ReportType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setReportType(type)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${reportType === type ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {type === "tickets" ? "Chamados" : type === "sla" ? "SLA" : "Avaliações"}
            </button>
          ))}
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

        {isLoadingAll ? (
          <CardSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {summary.map((item) => (
              <div key={item.label} className="glass rounded-xl p-4 animate-fade-in-up">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="text-2xl font-semibold mt-1">{item.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Chamados por dia"><SlaChart data={ticketTrend} /></Section>
          <Section title="Top técnicos"><TechChart data={technicianLoad} /></Section>
          <Section title="Capacidade por sprint"><BurndownChart data={sprintSeries} /></Section>
          <Section title="Distribuição por status"><StatusPie data={statusData} /></Section>
        </div>

        {/* Chart: Ticket Volume Over Time */}
        {reportType === "tickets" && ticketsReportQuery.data && (
          <Section title="Volume de Chamados por Semana">
            {/* NOTE: Weekly breakdown is mocked from by_status totals until backend supports it */}
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ticketWeeklyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.02 265 / 0.4)" />
                <XAxis dataKey="semana" stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.27 0.03 265 / 0.3)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Abertos" fill="oklch(0.72 0.20 260)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Finalizados" fill="oklch(0.74 0.18 155)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Chart: SLA Compliance Trend */}
        {reportType === "sla" && (
          <Section title="Tendência de Conformidade SLA (últimas 4 semanas)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={slaWeeklyTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.02 265 / 0.4)" />
                <XAxis dataKey="semana" stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "Taxa no prazo"]} />
                <Line type="monotone" dataKey="Taxa no prazo" stroke="oklch(0.72 0.20 260)" strokeWidth={2.5} dot={{ r: 4, fill: "oklch(0.72 0.20 260)" }} />
              </LineChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* Chart: Ratings Distribution */}
        {reportType === "ratings" && ratingsQuery.data && ratingsQuery.data.by_score.length > 0 && (
          <Section title="Distribuição de Avaliações por Nota">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={ratingsQuery.data.by_score.map((item) => ({ nota: `★ ${item.rating}`, count: item.count, rating: item.rating }))}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.02 265 / 0.4)" />
                <XAxis dataKey="nota" stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Avaliações" radius={[6, 6, 0, 0]}>
                  {ratingsQuery.data.by_score.map((item) => (
                    <Cell key={`cell-${item.rating}`} fill={RATING_COLORS[item.rating] ?? "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}
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
