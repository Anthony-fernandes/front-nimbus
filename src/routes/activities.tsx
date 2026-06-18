import { useState } from "react";
import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, CheckCircle2, Circle, Pause, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { formatHoursLabel } from "@/lib/activityFlow";
import { formatActivityStatusLabel, formatPriorityLabel } from "@/lib/labels";
import type { Activity } from "@/lib/types";
import { listActivities, updateActivity } from "@/services/activityService";

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
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: () => listActivities(),
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  if (pathname !== "/activities") {
    return <Outlet />;
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length && rows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r: Activity) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const concludeSelected = async () => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          updateActivity(id, { status: "Concluída" }),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success(`${selectedIds.size} atividade(s) concluída(s).`);
      clearSelection();
    } catch {
      toast.error("Não foi possível concluir as atividades selecionadas.");
    } finally {
      setBulkSaving(false);
    }
  };

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

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
            <div className="col-span-1 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary cursor-pointer"
                checked={allSelected}
                onChange={toggleSelectAll}
                aria-label="Selecionar todos"
              />
              <span>ID</span>
            </div>
            <div className="col-span-4">Atividade</div>
            <div className="col-span-2">Projeto</div>
            <div className="col-span-1">Sprint</div>
            <div className="col-span-1">Resp.</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Estimativa</div>
          </div>

          {rows.map((row: Activity, index) => {
            const status = statusMap[row.status || "Backlog"] || statusMap.Backlog;
            const isSelected = selectedIds.has(row.id);

            return (
              <div
                key={row.id}
                className={`animate-fade-in-up grid grid-cols-12 items-center gap-3 border-b border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="col-span-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary cursor-pointer shrink-0"
                    checked={isSelected}
                    onChange={() => toggleSelect(row.id)}
                    aria-label={`Selecionar atividade ${row.id.slice(0, 8)}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Link
                    to="/activities/$id"
                    params={{ id: row.id }}
                    className="font-mono text-xs text-muted-foreground hover:text-primary"
                  >
                    {row.id.slice(0, 8)}
                  </Link>
                </div>
                <Link
                  to="/activities/$id"
                  params={{ id: row.id }}
                  className="col-span-4 truncate hover:text-primary"
                >
                  {row.title}
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      priorityClr[formatPriorityLabel(row.priority) || "Media"]
                    }`}
                  >
                    {formatPriorityLabel(row.priority || "Media")}
                  </span>
                </Link>
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-background/95 px-5 py-3 shadow-card backdrop-blur">
          <span className="text-sm font-medium text-muted-foreground">
            {selectedIds.size} selecionada(s)
          </span>
          <div className="h-4 w-px bg-border" />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={bulkSaving}
            onClick={concludeSelected}
          >
            <Check className="h-3.5 w-3.5" /> Concluir selecionadas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={clearSelection}
          >
            <X className="h-3.5 w-3.5" /> Cancelar seleção
          </Button>
        </div>
      ) : null}
    </AppShell>
  );
}
