import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Table2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { exportReportCSV, exportReportExcel, getRatingsReport, getSLAReport, getTicketsReport } from "@/services/reportService";

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
  head: () => ({ meta: [{ title: "Relatórios · NimbusDesk" }] }),
  component: ReportsPage,
});

type ReportType = "tickets" | "sla" | "ratings" | "activities";

const REPORT_LABELS: Record<ReportType, string> = {
  tickets: "Chamados",
  sla: "SLA",
  ratings: "Avaliações",
  activities: "Atividades",
};

type ActivitiesReport = {
  total: number;
  by_status: { status: string; count: number }[];
  by_project: { project__name: string | null; count: number }[];
};

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

  const slaReportQuery = useQuery({
    queryKey: ["report-sla", dateFrom, dateTo],
    queryFn: () => getSLAReport(dateParams),
    enabled: reportType === "sla",
  });
  const ratingsQuery = useQuery({
    queryKey: ["report-ratings", dateFrom, dateTo],
    queryFn: () => getRatingsReport(dateParams),
    enabled: reportType === "ratings",
  });
  const ticketsReportQuery = useQuery({
    queryKey: ["report-tickets-api", dateFrom, dateTo],
    queryFn: () => getTicketsReport(dateParams),
    enabled: reportType === "tickets",
  });
  const activitiesReportQuery = useQuery({
    queryKey: ["report-activities-api", dateFrom, dateTo],
    queryFn: () =>
      api
        .get<ActivitiesReport>("/reports/", { params: { type: "activities", ...dateParams } })
        .then((r) => r.data),
    enabled: reportType === "activities",
  });

  const slaWeekRanges = getWeekRanges(4);
  const slaWeekQueries = useQueries({
    queries: slaWeekRanges.map((range) => ({
      queryKey: ["report-sla-week", range.date_from, range.date_to],
      queryFn: () => getSLAReport({ date_from: range.date_from, date_to: range.date_to }),
      enabled: reportType === "sla",
    })),
  });

  const t = ticketsReportQuery.data;

  const ticketWeeklyData = (t?.by_date ?? []) as {
    semana: string;
    Abertos: number;
    Finalizados: number;
  }[];

  const slaWeeklyTrendData = slaWeekRanges.map((range, i) => ({
    semana: range.label,
    "Taxa no prazo": slaWeekQueries[i].data?.on_time_rate ?? 0,
  }));

  const exportType = reportType === "ratings" ? "ratings" : reportType;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
            <p className="text-sm text-muted-foreground">
              Todos os números respeitam o período selecionado
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-lg border border-border bg-muted/30 px-2 text-xs text-foreground" />
            <span className="text-xs text-muted-foreground">até</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-lg border border-border bg-muted/30 px-2 text-xs text-foreground" />
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
              onClick={() => exportReportCSV(exportType, dateParams)}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
              onClick={() => exportReportExcel(exportType, dateParams)}>
              <Table2 className="h-3.5 w-3.5" /> Exportar Excel
            </Button>
          </div>
        </div>

        {/* Report type selector */}
        <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
          {(Object.keys(REPORT_LABELS) as ReportType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setReportType(type)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${reportType === type ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {REPORT_LABELS[type]}
            </button>
          ))}
        </div>

        {/* ══════ CHAMADOS ══════ */}
        {reportType === "tickets" && t && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="Total no período" value={t.total ?? 0} />
              <Kpi label="Finalizados" value={t.finished ?? 0} tone="success" />
              <Kpi label="Em aberto" value={t.open ?? 0} />
              <Kpi
                label="Tempo médio de resolução"
                value={t.avg_resolution_time_hours != null ? `${t.avg_resolution_time_hours}h` : "—"}
              />
              <Kpi
                label="SLA cumprido"
                value={t.sla_met_rate != null ? `${t.sla_met_rate}%` : "—"}
                tone="success"
              />
              <Kpi label="Chamados reabertos" value={t.reopen_count ?? 0} tone="warning" />
              <Kpi label="Taxa de reabertura" value={`${t.reopen_rate?.toFixed(1) ?? "0"}%`} />
              <Kpi
                label="CSAT médio"
                value={t.avg_csat != null ? `★ ${t.avg_csat.toFixed(1)}/5` : "—"}
                tone="warning"
              />
            </div>

            <Section title="Volume de Chamados por Semana">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ReportTable
                title="Por status"
                headers={["Status", "Chamados"]}
                rows={(t.by_status ?? []).map((r: { status: string; count: number }) => [r.status || "—", r.count])}
              />
              <ReportTable
                title="Por prioridade"
                headers={["Prioridade", "Chamados"]}
                rows={(t.by_priority ?? []).map((r: { priority: string; count: number }) => [r.priority || "—", r.count])}
              />
              <ReportTable
                title="Por categoria (top 10)"
                headers={["Categoria", "Chamados"]}
                rows={(t.by_category ?? []).map((r: { category: string; count: number }) => [r.category || "—", r.count])}
              />
              <ReportTable
                title="Por técnico (top 10)"
                headers={["Técnico", "Chamados"]}
                rows={(t.by_technician ?? []).map(
                  (r: { responsible_technician__name?: string; count: number }) => [
                    r.responsible_technician__name || "—",
                    r.count,
                  ],
                )}
              />
            </div>
          </>
        )}

        {/* ══════ SLA ══════ */}
        {reportType === "sla" && slaReportQuery.data && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Kpi label="Chamados com SLA" value={slaReportQuery.data.total} />
              <Kpi label="SLA violado (abertos)" value={slaReportQuery.data.breached_open} tone="destructive" />
              <Kpi label="Taxa dentro do prazo" value={`${slaReportQuery.data.on_time_rate}%`} tone="success" />
            </div>
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
          </>
        )}

        {/* ══════ AVALIAÇÕES ══════ */}
        {reportType === "ratings" && ratingsQuery.data && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Avaliações recebidas" value={ratingsQuery.data.total_rated} />
              <Kpi
                label="Nota média"
                value={`${"★".repeat(Math.round(ratingsQuery.data.average || 0))} ${ratingsQuery.data.average}/5`}
                tone="warning"
              />
            </div>
            {ratingsQuery.data.by_score.length > 0 && (
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
          </>
        )}

        {/* ══════ ATIVIDADES ══════ */}
        {reportType === "activities" && activitiesReportQuery.data && (
          <>
            <div className="grid grid-cols-1 gap-3 max-w-xs">
              <Kpi label="Atividades no período" value={activitiesReportQuery.data.total} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ReportTable
                title="Por status"
                headers={["Status", "Atividades"]}
                rows={activitiesReportQuery.data.by_status.map((r) => [r.status || "—", r.count])}
              />
              <ReportTable
                title="Por projeto (top 10)"
                headers={["Projeto", "Atividades"]}
                rows={activitiesReportQuery.data.by_project.map((r) => [r.project__name || "Sem projeto", r.count])}
              />
            </div>
          </>
        )}

        {((reportType === "tickets" && ticketsReportQuery.isLoading) ||
          (reportType === "sla" && slaReportQuery.isLoading) ||
          (reportType === "ratings" && ratingsQuery.isLoading) ||
          (reportType === "activities" && activitiesReportQuery.isLoading)) && (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground shadow-card">
            Carregando relatório...
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "success" | "warning" | "destructive" }) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}

function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                {headers.map((h) => (
                  <th key={h} className="pb-2 pr-4 font-medium last:text-right last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border/60">
                  {row.map((cell, j) => (
                    <td key={j} className={`py-2 pr-4 ${j === row.length - 1 ? "text-right pr-0 font-semibold" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
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
