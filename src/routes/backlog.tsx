import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { formatHoursLabel } from "@/lib/activityFlow";
import type { Activity } from "@/lib/types";
import { listActivities } from "@/services/activityService";

export const Route = createFileRoute("/backlog")({
  head: () => ({ meta: [{ title: "Backlog · Stratos Suite" }] }),
  component: BacklogPage,
});

const priorityClr: Record<string, string> = {
  Alta: "bg-warning/15 text-warning",
  Media: "bg-info/15 text-info",
  Baixa: "bg-muted text-muted-foreground",
  Critica: "bg-destructive/15 text-destructive",
};

function BacklogPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: items = [] } = useQuery({
    queryKey: ["backlog"],
    queryFn: () => listActivities({ status: "Backlog" }),
  });

  if (pathname !== "/backlog") {
    return <Outlet />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Backlog</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} itens · {formatHoursLabel(items.reduce((total, item) => total + Number(item.est_hours || 0), 0))} estimadas
            </p>
          </div>
          <a
            href="/activities/new"
            className="rounded-lg bg-gradient-primary px-3 py-1.5 text-xs text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            + Novo item
          </a>
        </div>
        <div className="glass divide-y divide-border rounded-2xl shadow-card">
          {items.map((item: Activity, index) => (
            <div
              key={item.id}
              className="group animate-fade-in-up flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              <span className="w-20 font-mono text-xs text-muted-foreground">{item.id.slice(0, 8)}</span>
              <span className="flex-1 text-sm">{item.title}</span>
              <span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] text-accent">{item.type || "Tarefa"}</span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityClr[item.priority || "Media"]}`}
              >
                {item.priority || "Media"}
              </span>
              <span className="w-16 rounded bg-primary/15 px-2 py-0.5 text-center font-mono text-xs text-primary">
                {formatHoursLabel(Number(item.est_hours || 0))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
