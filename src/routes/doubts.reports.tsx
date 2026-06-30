import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart2, Clock, Star, Ticket } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { getTicketReports } from "@/services/knowledgeService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/doubts/reports")({
  head: () => ({ meta: [{ title: "Relatórios · Stratos Suite" }] }),
  component: DoubtsReportsPage,
});

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Ticket; label: string; value: string | number; color: string }) {
  return (
    <div className="glass rounded-2xl p-5 flex items-center gap-4">
      <div className={cn("h-12 w-12 rounded-xl grid place-items-center shrink-0", color)}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

function BarChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <p className="text-xs text-muted-foreground">Sem dados.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            className="w-full rounded-t bg-primary/60 hover:bg-primary transition-colors"
            style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }}
          />
          <span className="text-[9px] text-muted-foreground rotate-45 origin-left hidden group-hover:block absolute -bottom-5 left-0 whitespace-nowrap">
            {d.date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

function DoubtsReportsPage() {
  const reportsQuery = useQuery({
    queryKey: ["ticket-reports"],
    queryFn: getTicketReports,
  });

  const data = reportsQuery.data;

  return (
    <AppShell>
      <div className="max-w-4xl space-y-6">
        <Link
          to="/doubts"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar a Dúvidas
        </Link>

        <PageHeader
          title="Relatórios de Chamados"
          subtitle="Visão geral de atendimento, CSAT e volume."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <BarChart2 className="h-4 w-4" />
            </span>
          }
        />

        {reportsQuery.isLoading ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Carregando relatórios...
          </div>
        ) : !data ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Erro ao carregar dados.
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Ticket} label="Total de chamados" value={data.total} color="bg-blue-500/10 text-blue-500" />
              <StatCard icon={Ticket} label="Abertos" value={data.open} color="bg-orange-500/10 text-orange-500" />
              <StatCard icon={Ticket} label="Fechados" value={data.closed} color="bg-green-500/10 text-green-500" />
              <StatCard icon={Ticket} label="Pendentes" value={data.pending} color="bg-yellow-500/10 text-yellow-500" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                icon={Star}
                label="CSAT médio (1–5)"
                value={data.avg_csat !== null ? data.avg_csat.toFixed(1) : "N/D"}
                color="bg-purple-500/10 text-purple-500"
              />
              <StatCard
                icon={Clock}
                label="Tempo médio de resposta"
                value={data.avg_response_hours !== null ? `${data.avg_response_hours.toFixed(1)}h` : "N/D"}
                color="bg-teal-500/10 text-teal-500"
              />
            </div>

            {/* Volume chart */}
            <div className="glass rounded-2xl p-6 shadow-card">
              <h3 className="text-sm font-semibold mb-4">Volume (últimos 30 dias)</h3>
              <BarChart data={data.volume_by_day} />
            </div>

            {/* Top categories */}
            {data.top_categories.length > 0 && (
              <div className="glass rounded-2xl p-6 shadow-card">
                <h3 className="text-sm font-semibold mb-4">Top categorias</h3>
                <div className="space-y-2">
                  {data.top_categories.map((cat) => {
                    const maxCount = Math.max(...data.top_categories.map((c) => c.count), 1);
                    return (
                      <div key={cat.category} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-32 truncate shrink-0">
                          {cat.category || "(sem categoria)"}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-muted/40">
                          <div
                            className="h-2 rounded-full bg-primary/60"
                            style={{ width: `${(cat.count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right shrink-0">{cat.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
