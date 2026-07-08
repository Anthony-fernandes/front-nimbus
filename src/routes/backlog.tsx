import { useState } from "react";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { TablePagination } from "@/components/app/TablePagination";
import { WorkItemModal } from "@/components/workitem/WorkItemModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/services/api";
import { listSprints } from "@/services/sprintService";
import { listTeams } from "@/services/teamService";
import { cn } from "@/lib/utils";
import type { WorkItemRef } from "@/lib/workItem";
import { canSendToSprint } from "@/lib/workItemRules";

export const Route = createFileRoute("/backlog")({
  head: () => ({ meta: [{ title: "Backlog · NimbusDesk" }] }),
  validateSearch: (s) => ({
    team: (s.team as string) || "",
    type: (s.type as string) || "",
  }),
  component: BacklogPage,
});

type BacklogItem = {
  id: string;
  type: "task" | "ticket" | "bug" | "improvement" | "internal_task";
  code: string;
  title: string;
  origin: string;
  priority: string;
  status: string;
  responsible: string;
  sprint: string | null;
  sprint_id: string | null;
  due_at: string | null;
  created_at: string;
};

type BacklogResponse = {
  results: BacklogItem[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type BacklogMetrics = {
  total: number;
  tasks: number;
  tickets: number;
  bugs: number;
  improvements: number;
  no_sprint: number;
  critical: number;
  overdue: number;
  no_responsible: number;
  due_today: number;
};

const TYPE_META: Record<string, { label: string; cls: string }> = {
  task: { label: "Atividade", cls: "bg-violet-500/15 text-violet-400" },
  ticket: { label: "Chamado", cls: "bg-blue-500/15 text-blue-400" },
  bug: { label: "Bug", cls: "bg-destructive/15 text-destructive" },
  improvement: { label: "Melhoria", cls: "bg-emerald-500/15 text-emerald-400" },
  internal_task: { label: "Demanda interna", cls: "bg-amber-500/15 text-amber-500" },
};

const priorityClr: Record<string, string> = {
  Alta: "bg-warning/15 text-warning",
  Media: "bg-info/15 text-info",
  "Média": "bg-info/15 text-info",
  Baixa: "bg-muted text-muted-foreground",
  Critica: "bg-destructive/15 text-destructive",
  "Crítica": "bg-destructive/15 text-destructive",
};

function BacklogPage() {
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const { team: teamParam, type: typeParam } = Route.useSearch();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(typeParam || "");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState(teamParam || "");
  const [noSprintOnly, setNoSprintOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailRef, setDetailRef] = useState<WorkItemRef | null>(null);
  const [sendSprintOpen, setSendSprintOpen] = useState(false);

  const params = {
    search: search || undefined,
    type: typeFilter || undefined,
    priority: priorityFilter || undefined,
    team: teamFilter || undefined,
    no_sprint: noSprintOnly ? "true" : undefined,
  };
  const resetKey = JSON.stringify(params);

  const listQ = useQuery({
    queryKey: ["backlog", resetKey, page, pageSize],
    queryFn: () =>
      api
        .get<BacklogResponse>("/backlog/", { params: { ...params, page, page_size: pageSize } })
        .then((r) => r.data),
  });
  const metricsQ = useQuery({
    queryKey: ["backlog-metrics", resetKey],
    queryFn: () =>
      api.get<BacklogMetrics>("/backlog/metrics/", { params }).then((r) => r.data),
  });
  const teamsQ = useQuery({ queryKey: ["teams"], queryFn: listTeams });
  const sprintsQ = useQuery({
    queryKey: ["sprints-open"],
    queryFn: () => listSprints(),
    select: (data) => data.filter((s) => s.status === "Em andamento" || s.status === "Planejada"),
  });

  const items = listQ.data?.results ?? [];
  const metrics = metricsQ.data;

  const sendToSprint = useMutation({
    mutationFn: async (sprintId: string) => {
      const chosen = items.filter((i) => selected.has(`${i.type}:${i.id}`));
      const ineligible = chosen.filter((i) => !canSendToSprint(i.type === "ticket" ? "ticket" : "activity", i.status));
      if (ineligible.length > 0) {
        throw new Error(
          `${ineligible.length} item(ns) não podem ir para sprint no status atual: ` +
          ineligible.slice(0, 3).map((i) => `${i.code} (${i.status})`).join(", "),
        );
      }
      await Promise.all(
        chosen.map((i) =>
          i.type === "ticket"
            ? api.patch(`/tickets/${i.id}/`, { sprint: sprintId })
            : api.patch(`/activities/${i.id}/`, { sprint: sprintId, status: "A fazer" }),
        ),
      );
    },
    onSuccess: () => {
      toast.success("Itens enviados para a sprint.");
      setSelected(new Set());
      setSendSprintOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["backlog"] });
      void queryClient.invalidateQueries({ queryKey: ["backlog-metrics"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar os itens."),
  });

  if (currentPath !== "/backlog") {
    return <Outlet />;
  }

  const setFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const kpis = metrics
    ? [
        { label: "Total no backlog", value: metrics.total },
        { label: "Atividades", value: metrics.tasks },
        { label: "Chamados", value: metrics.tickets },
        { label: "Bugs", value: metrics.bugs },
        { label: "Sem sprint", value: metrics.no_sprint },
        { label: "Críticos", value: metrics.critical },
        { label: "Atrasados", value: metrics.overdue },
        { label: "Sem responsável", value: metrics.no_responsible },
      ]
    : [];

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
              Fila unificada de demandas: atividades, chamados, bugs e melhorias aguardando planejamento.
            </p>
          </div>
        </div>

        {/* Indicadores (respeitam os filtros ativos) */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {kpis.map((k) => (
              <div key={k.label} className="glass rounded-xl px-3 py-2.5">
                <p className="truncate text-[11px] text-muted-foreground">{k.label}</p>
                <p className="text-xl font-semibold">{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 shadow-card">
          <Input
            value={search}
            onChange={(e) => setFilter(() => setSearch(e.target.value))}
            placeholder="Buscar por título ou código..."
            className="h-9 max-w-xs"
          />
          <select
            value={typeFilter}
            onChange={(e) => setFilter(() => setTypeFilter(e.target.value))}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="task">Atividade</option>
            <option value="ticket">Chamado</option>
            <option value="bug">Bug</option>
            <option value="improvement">Melhoria</option>
            <option value="internal_task">Demanda interna</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setFilter(() => setPriorityFilter(e.target.value))}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Todas as prioridades</option>
            {["Critica", "Alta", "Media", "Baixa"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={teamFilter}
            onChange={(e) => setFilter(() => setTeamFilter(e.target.value))}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Todas as equipes</option>
            {(teamsQ.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={noSprintOnly}
              onChange={(e) => setFilter(() => setNoSprintOnly(e.target.checked))}
              className="h-3.5 w-3.5 accent-primary"
            />
            Só sem sprint
          </label>
          {(search || typeFilter || priorityFilter || teamFilter || noSprintOnly) && (
            <button
              type="button"
              onClick={() =>
                setFilter(() => {
                  setSearch(""); setTypeFilter(""); setPriorityFilter(""); setTeamFilter(""); setNoSprintOnly(false);
                })
              }
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Tabela */}
        <div className="glass overflow-x-auto rounded-2xl shadow-card">
          {listQ.isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum item encontrado com esses filtros.
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={items.length > 0 && items.every((i) => selected.has(`${i.type}:${i.id}`))}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? new Set(items.map((i) => `${i.type}:${i.id}`))
                              : new Set(),
                          )
                        }
                      />
                    </th>
                    <th className="px-2 py-2.5 text-left font-medium">Tipo</th>
                    <th className="px-2 py-2.5 text-left font-medium">Código</th>
                    <th className="px-2 py-2.5 text-left font-medium">Título</th>
                    <th className="hidden lg:table-cell px-2 py-2.5 text-left font-medium">Origem</th>
                    <th className="px-2 py-2.5 text-left font-medium">Prioridade</th>
                    <th className="hidden lg:table-cell px-2 py-2.5 text-left font-medium">Responsável</th>
                    <th className="px-2 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Sprint</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const key = `${item.type}:${item.id}`;
                    const meta = TYPE_META[item.type] || TYPE_META.task;
                    return (
                      <tr
                        key={key}
                        className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"
                        onClick={() =>
                          setDetailRef({
                            type: item.type === "ticket" ? "ticket" : "project_activity",
                            id: item.id,
                          })
                        }
                      >
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={selected.has(key)}
                            onChange={(e) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(key); else next.delete(key);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={cn("rounded px-2 py-0.5 text-[11px] font-medium", meta.cls)}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 font-mono text-xs text-muted-foreground">{item.code}</td>
                        <td className="max-w-[280px] truncate px-2 py-2.5 font-medium">{item.title}</td>
                        <td className="hidden lg:table-cell max-w-[160px] truncate px-2 py-2.5 text-muted-foreground">
                          {item.origin}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", priorityClr[item.priority] || "bg-muted text-muted-foreground")}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell px-2 py-2.5 text-muted-foreground">
                          {item.responsible || "—"}
                        </td>
                        <td className="px-2 py-2.5 text-xs text-muted-foreground">{item.status}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {item.sprint ? (
                            <span className="rounded bg-accent/15 px-2 py-0.5 text-accent">{item.sprint}</span>
                          ) : (
                            <span className="text-muted-foreground">Sem sprint</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <TablePagination
                page={listQ.data?.page ?? page}
                totalPages={listQ.data?.totalPages ?? 1}
                total={listQ.data?.count ?? 0}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              />
            </>
          )}
        </div>
      </div>

      {/* Barra de seleção em massa */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-background/95 px-5 py-3 shadow-card backdrop-blur">
          <span className="text-sm font-medium text-muted-foreground">{selected.size} selecionado(s)</span>
          <div className="h-4 w-px bg-border" />
          {sendSprintOpen ? (
            <select
              autoFocus
              className="h-8 rounded-md border border-primary/40 bg-background px-2 text-sm"
              defaultValue=""
              onChange={(e) => { if (e.target.value) sendToSprint.mutate(e.target.value); }}
              onBlur={() => setSendSprintOpen(false)}
            >
              <option value="" disabled>Escolher sprint...</option>
              {(sprintsQ.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{(s as { team_name?: string }).team_name ? ` · ${(s as { team_name?: string }).team_name}` : ""} ({s.status})
                </option>
              ))}
            </select>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={() => setSendSprintOpen(true)} disabled={sendToSprint.isPending}>
              <ArrowRight className="h-3.5 w-3.5" /> Enviar para sprint
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setSelected(new Set())}>
            Cancelar
          </Button>
        </div>
      )}

      <WorkItemModal
        workRef={detailRef}
        open={Boolean(detailRef)}
        onOpenChange={(v) => { if (!v) setDetailRef(null); }}
        onChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ["backlog"] });
          void queryClient.invalidateQueries({ queryKey: ["backlog-metrics"] });
        }}
      />
    </AppShell>
  );
}
