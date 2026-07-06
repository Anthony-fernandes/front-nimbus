import { useState } from "react";
import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { WorkItemModal } from "@/components/workitem/WorkItemModal";
import { formatHoursLabel } from "@/lib/activityFlow";
import type { Activity } from "@/lib/types";
import { listActivities, updateActivity } from "@/services/activityService";
import { listProjects } from "@/services/projectService";
import { listSprints } from "@/services/sprintService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/backlog")({
  head: () => ({ meta: [{ title: "Backlog · NimbusDesk" }] }),
  component: BacklogPage,
});

const priorityClr: Record<string, string> = {
  Alta: "bg-warning/15 text-warning",
  Media: "bg-info/15 text-info",
  Baixa: "bg-muted text-muted-foreground",
  Critica: "bg-destructive/15 text-destructive",
};

const PRIORITIES = ["Todos", "Critica", "Alta", "Media", "Baixa"] as const;
type PriorityFilter = (typeof PRIORITIES)[number];

function BacklogPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("Todos");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [detailActivityId, setDetailActivityId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["backlog"],
    queryFn: () => listActivities({ status: "Backlog" }),
  });

  const projectsQuery = useQuery({
    queryKey: ["projects-list"],
    queryFn: () => listProjects(),
  });

  const sprintsQuery = useQuery({
    queryKey: ["sprints-open"],
    queryFn: () => listSprints(),
    select: (data) => data.filter((s) => s.status === "Em andamento" || s.status === "Planejada"),
  });

  const moveToSprintMutation = useMutation({
    mutationFn: ({ activityId, sprintId }: { activityId: string; sprintId: string }) =>
      updateActivity(activityId, { sprint: sprintId, status: "A fazer" }),
    onSuccess: () => {
      toast.success("Item movido para o sprint.");
      void queryClient.invalidateQueries({ queryKey: ["backlog"] });
      setMovingId(null);
    },
    onError: () => toast.error("Não foi possível mover o item."),
  });

  if (pathname !== "/backlog") {
    return <Outlet />;
  }

  const filtered = items.filter((item: Activity) => {
    const matchesPriority = priorityFilter === "Todos" || item.priority === priorityFilter;
    const matchesProject = projectFilter === "all" || item.project === projectFilter;
    return matchesPriority && matchesProject;
  });

  const activeSprints = sprintsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-semibold tracking-tight">Backlog</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} de {items.length} itens ·{" "}
              {formatHoursLabel(filtered.reduce((total, item) => total + Number(item.est_hours || 0), 0))} estimadas
            </p>
          </div>
          <a
            href="/activities/new"
            className="rounded-lg bg-gradient-primary px-3 py-1.5 text-xs text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            + Novo item
          </a>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  priorityFilter === p
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          {projects.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-7 rounded-lg border border-border bg-muted/30 px-2 text-xs text-foreground focus:outline-none"
            >
              <option value="all">Todos os projetos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="glass overflow-x-auto rounded-2xl shadow-card">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {items.length === 0 ? "Nenhum item no backlog." : "Nenhum item com esses filtros."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">ID</th>
                  <th className="px-2 py-2.5 text-left font-medium">Item</th>
                  <th className="px-2 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-2 py-2.5 text-left font-medium">Prioridade</th>
                  <th className="px-2 py-2.5 text-right font-medium">Estimativa</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: Activity) => (
                  <tr
                    key={item.id}
                    className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"
                    onClick={() => setDetailActivityId(item.id)}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{item.id.slice(0, 8)}</td>
                    <td className="px-2 py-2.5 font-medium">{item.title}</td>
                    <td className="px-2 py-2.5">
                      <span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
                        {item.type || "Tarefa"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          priorityClr[item.priority || "Media"],
                        )}
                      >
                        {item.priority || "Media"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">
                        {formatHoursLabel(Number(item.est_hours || 0))}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {activeSprints.length > 0 ? (
                        movingId === item.id ? (
                          <select
                            autoFocus
                            className="h-6 rounded border border-primary/40 bg-muted/50 px-1.5 text-xs focus:outline-none"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                moveToSprintMutation.mutate({ activityId: item.id, sprintId: e.target.value });
                              }
                            }}
                            onBlur={() => setMovingId(null)}
                          >
                            <option value="" disabled>Selecione...</option>
                            {activeSprints.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            title="Mover para sprint"
                            onClick={() => setMovingId(item.id)}
                            className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:border-primary/40 hover:text-foreground group-hover:opacity-100"
                          >
                            <ArrowRight className="h-3 w-3" /> Sprint
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <WorkItemModal
        workRef={detailActivityId ? { type: "project_activity", id: detailActivityId } : null}
        open={Boolean(detailActivityId)}
        onOpenChange={(v) => { if (!v) setDetailActivityId(null); }}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: ["backlog"] })}
      />
    </AppShell>
  );
}
