import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Circle, Pause, Plus } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { formatHoursLabel } from "@/lib/activityFlow";
import { formatActivityStatusLabel, formatPriorityLabel } from "@/lib/labels";
import type { Activity } from "@/lib/types";
import { listActivities } from "@/services/activityService";

export const Route = createFileRoute("/activities")({
  head: () => ({ meta: [{ title: "Atividades · Stratos Suite" }] }),
  component: ActivitiesPage,
});

const statusMap: Record<string, { cls: string; Icon: typeof Circle }> = {
  "A fazer": { cls: "text-muted-foreground", Icon: Circle },
  Backlog: { cls: "text-muted-foreground", Icon: Circle },
  "Em progresso": { cls: "text-info", Icon: AlertCircle },
  "Em revisao": { cls: "text-accent", Icon: AlertCircle },
  Bloqueado: { cls: "text-warning", Icon: Pause },
  Concluido: { cls: "text-success", Icon: CheckCircle2 },
};

const priorityClr: Record<string, string> = {
  Critica: "bg-destructive/15 text-destructive",
  Alta: "bg-warning/15 text-warning",
  Media: "bg-info/15 text-info",
  Baixa: "bg-muted text-muted-foreground",
};

function ActivitiesPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: () => listActivities(),
  });

  if (pathname !== "/activities") {
    return <Outlet />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: "Atividades" }]}
          title="Atividades"
          subtitle={
            isLoading
              ? "Carregando atividades..."
              : `${rows.length} atividades cadastradas entre backlog e projetos`
          }
          actions={
            <Button
              asChild
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <a href="/activities/new">
                <Plus className="h-4 w-4" /> Nova atividade
              </a>
            </Button>
          }
        />

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <div className="grid grid-cols-12 gap-3 border-b border-border px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1">ID</div>
            <div className="col-span-4">Atividade</div>
            <div className="col-span-2">Projeto</div>
            <div className="col-span-1">Sprint</div>
            <div className="col-span-1">Resp.</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Estimativa</div>
          </div>

          {rows.map((row: Activity, index) => {
            const status = statusMap[row.status || "Backlog"] || statusMap.Backlog;

            return (
              <Link
                key={row.id}
                to="/activities/$id"
                params={{ id: row.id }}
                className="animate-fade-in-up grid grid-cols-12 items-center gap-3 border-b border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="col-span-1 w-20 font-mono text-xs text-muted-foreground">
                  {row.id.slice(0, 8)}
                </div>
                <div className="col-span-4 truncate">
                  {row.title}
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      priorityClr[formatPriorityLabel(row.priority) || "Media"]
                    }`}
                  >
                    {formatPriorityLabel(row.priority || "Media")}
                  </span>
                </div>
                <div className="col-span-2 truncate text-muted-foreground">{row.project_name || "—"}</div>
                <div className="col-span-1 text-xs text-muted-foreground">{row.sprint_name || "—"}</div>
                <div className="col-span-1 text-xs">{row.assignee_name || "—"}</div>
                <div className={`col-span-2 flex items-center gap-1.5 ${status.cls}`}>
                  <status.Icon className="h-3.5 w-3.5" />
                  <span className="text-xs">{formatActivityStatusLabel(row.status || "Backlog")}</span>
                </div>
                <div className="col-span-1 text-right font-mono text-xs text-primary">
                  {formatHoursLabel(Number(row.est_hours || 0))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
