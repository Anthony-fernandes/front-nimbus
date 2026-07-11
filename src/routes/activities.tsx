import { useState } from "react";
import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, CheckCircle2, Circle, Clock, Pause, Plus, Timer, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Can } from "@/components/app/Can";
import { TablePagination } from "@/components/app/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import { WorkItemModal } from "@/components/workitem/WorkItemModal";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatHoursLabel } from "@/lib/activityFlow";
import { formatActivityStatusLabel, formatPriorityLabel } from "@/lib/labels";
import type { Activity } from "@/lib/types";
import { listActivities, updateActivity } from "@/services/activityService";
import { listActivityTimeEntries, saveActivityTimeEntry } from "@/services/activityTimeEntryService";
import { listTeams } from "@/services/teamService";
import { listSprints } from "@/services/sprintService";
import { getStoredUser } from "@/services/authService";

export const Route = createFileRoute("/activities")({
  head: () => ({ meta: [{ title: "Atividades · NimbusDesk" }] }),
  // team = contexto da equipe; kind = "bug" (Bugs) | "task" (Tarefas) | "" (todas)
  validateSearch: (s): { team?: string; kind?: "bug" | "task"; context?: string } => {
    const out: { team?: string; kind?: "bug" | "task"; context?: string } = {};
    if (s.team) out.team = String(s.team);
    if (s.kind === "bug" || s.kind === "task") out.kind = s.kind;
    if (s.context) out.context = String(s.context);
    return out;
  },
  component: ActivitiesPage,
});

function isBugActivity(a: Activity) {
  return (a.type || "").toLowerCase().includes("bug");
}

const statusMap: Record<string, { cls: string; Icon: typeof Circle }> = {
  "A fazer": { cls: "text-muted-foreground", Icon: Circle },
  Backlog: { cls: "text-muted-foreground", Icon: Circle },
  "Em progresso": { cls: "text-info", Icon: AlertCircle },
  "Em revisao": { cls: "text-accent", Icon: AlertCircle },
  Bloqueado: { cls: "text-warning", Icon: Pause },
  Concluido: { cls: "text-success", Icon: CheckCircle2 },
  "Concluída": { cls: "text-success", Icon: CheckCircle2 },
  "Concluído": { cls: "text-success", Icon: CheckCircle2 },
};

const STATUS_FILTER_OPTIONS = [
  "Todos",
  "Backlog",
  "A fazer",
  "Em progresso",
  "Em revisao",
  "Bloqueado",
  "Concluída",
];

const priorityClr: Record<string, string> = {
  Critica: "bg-destructive/15 text-destructive",
  Alta: "bg-warning/15 text-warning",
  Media: "bg-info/15 text-info",
  Baixa: "bg-muted text-muted-foreground",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function TimeEntryDialog({
  activity,
  open,
  onOpenChange,
}: {
  activity: Activity;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const [hours, setHours] = useState("");
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState("");

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      return saveActivityTimeEntry(
        {
          activityId: activity.id,
          collaboratorId: user.id,
          date,
          hours: Number(hours),
          workDescription: description,
        },
        {
          mode: "create",
          activity: { id: activity.id, project: activity.project ?? null },
          collaborator: user,
        },
      );
    },
    onSuccess: () => {
      toast.success("Tempo registrado com sucesso.");
      onOpenChange(false);
      setHours("");
      setDate(todayIso());
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["activity-time-entries"] });
      void queryClient.invalidateQueries({ queryKey: ["activity-time-entries-today"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao registrar tempo.";
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar tempo</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground line-clamp-1 -mt-1">{activity.title}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Horas *</Label>
              <Input
                type="number"
                min={0.25}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="Ex: 1.5"
              />
            </div>
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que foi feito..."
              className="min-h-[70px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={saveMutation.isPending || !hours || Number(hours) <= 0 || !date}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivitiesPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { team: teamParam, kind } = Route.useSearch();
  const queryClient = useQueryClient();
  const user = getStoredUser();

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: () => listActivities(),
  });

  // Contexto de equipe: atividade pertence à equipe se o responsável é membro
  // ou está numa sprint da equipe. Bugs/Tarefas separam por tipo.
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: listTeams, enabled: Boolean(teamParam) });
  const { data: allSprints = [] } = useQuery({ queryKey: ["sprints"], queryFn: () => listSprints(), enabled: Boolean(teamParam) });
  const selectedTeam = teams.find((t) => t.id === teamParam);
  const memberIds = new Set((selectedTeam?.members ?? []).map((m) => String(m.user)));
  const teamSprintIds = new Set(
    allSprints.filter((s) => String((s as { team?: string | null }).team || "") === teamParam).map((s) => String(s.id)),
  );
  const belongsToTeam = (a: Activity) =>
    !teamParam ||
    (a.assignee && memberIds.has(String(a.assignee))) ||
    (a.assignees || []).some((id) => memberIds.has(String(id))) ||
    (a.sprint && teamSprintIds.has(String(a.sprint)));

  const rows = allRows.filter((a: Activity) => {
    if (kind === "bug" && !isBugActivity(a)) return false;
    if (kind === "task" && isBugActivity(a)) return false;
    return belongsToTeam(a);
  });

  // Today's time entries for the summary card
  const today = todayIso();
  const { data: todayEntries = [] } = useQuery({
    queryKey: ["activity-time-entries-today"],
    queryFn: () => listActivityTimeEntries(),
    select: (entries) => entries.filter((e) => e.date === today && (!user?.id || e.collaboratorId === user.id)),
  });

  const hoursToday = todayEntries.reduce((sum, e) => sum + (e.hours ?? 0), 0);

  const [timeEntryActivity, setTimeEntryActivity] = useState<Activity | null>(null);
  const [detailActivityId, setDetailActivityId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [projectFilter, setProjectFilter] = useState("all");

  const projectOptions = Array.from(
    new Map(
      rows
        .filter((r: Activity) => r.project && r.project_name)
        .map((r: Activity) => [r.project as string, r.project_name as string]),
    ).entries(),
  );

  const filteredRows = rows.filter((row: Activity) => {
    const matchesSearch =
      !searchTerm ||
      (row.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.assignee_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const status = row.status || "";
    const matchesStatus =
      statusFilter === "Todos" ||
      status === statusFilter ||
      (statusFilter === "Concluída" && ["Concluido", "Concluído", "Done"].includes(status));
    const matchesProject = projectFilter === "all" || row.project === projectFilter;
    return matchesSearch && matchesStatus && matchesProject;
  });

  const pag = usePagination(filteredRows, `${searchTerm}|${statusFilter}|${projectFilter}`);

  if (pathname !== "/activities") {
    return <Outlet />;
  }


  const pageTitle = kind === "bug" ? "Bugs" : kind === "task" ? "Tarefas" : "Atividades";
  const itemNoun = kind === "bug" ? "bugs" : kind === "task" ? "tarefas" : "atividades";

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: pageTitle }]}
          title={
            teamParam ? (
              <span className="flex items-center gap-2.5">
                {pageTitle}
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedTeam?.color || "#94a3b8" }} />
                  {selectedTeam?.name || "Equipe"}
                </span>
              </span>
            ) : (
              pageTitle
            )
          }
          subtitle={
            isLoading
              ? `Carregando ${itemNoun}...`
              : `${rows.length} ${itemNoun}${teamParam ? ` da equipe ${selectedTeam?.name || ""}` : " cadastradas entre backlog e projetos"}`
          }
          actions={
            <Can permission="activities.create">
              <Button
                asChild
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                <a href="/activities/new">
                  <Plus className="h-4 w-4" /> Nova atividade
                </a>
              </Button>
            </Can>
          }
        />

        {/* Meu tempo hoje */}
        <div className="glass flex items-center gap-4 rounded-2xl px-5 py-3 shadow-card">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Clock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Meu tempo hoje</p>
            <p className="text-lg font-bold leading-tight">
              {hoursToday > 0 ? formatHoursLabel(hoursToday) : "Nenhum apontamento"}
            </p>
          </div>
          {todayEntries.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{todayEntries.length} apontamento(s)</span>
          )}
        </div>

        {/* Filtros */}
        <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 shadow-card">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título ou responsável..."
            className="h-9 max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            {STATUS_FILTER_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === "Todos" ? "Todos os status" : s}</option>
            ))}
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="all">Todos os projetos</option>
            {projectOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredRows.length} de {rows.length} atividade(s)
          </span>
        </div>

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <div className="grid grid-cols-12 gap-3 border-b border-border px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1 flex items-center gap-2">
              <span>ID</span>
            </div>
            <div className="col-span-3">Atividade</div>
            <div className="col-span-2">Projeto</div>
            <div className="col-span-1">Sprint</div>
            <div className="col-span-1">Resp.</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Estimativa</div>
            <div className="col-span-1 text-right">Tempo</div>
          </div>

          {pag.pageRows.map((row: Activity, index) => {
            const status = statusMap[row.status || "Backlog"] || statusMap.Backlog;

            return (
              <div
                key={row.id}
                className="animate-fade-in-up grid grid-cols-12 items-center gap-3 border-b border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="col-span-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailActivityId(row.id)}
                    className="font-mono text-xs text-muted-foreground hover:text-primary"
                  >
                    {row.id.slice(0, 8)}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailActivityId(row.id)}
                  className="col-span-3 truncate text-left hover:text-primary"
                >
                  {row.title}
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      priorityClr[formatPriorityLabel(row.priority) || "Media"]
                    }`}
                  >
                    {formatPriorityLabel(row.priority || "Media")}
                  </span>
                </button>
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
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTimeEntryActivity(row);
                    }}
                    title="Registrar tempo"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Timer className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          <TablePagination
            page={pag.page}
            totalPages={pag.totalPages}
            total={pag.total}
            pageSize={pag.pageSize}
            onPageChange={pag.setPage}
            onPageSizeChange={pag.setPageSize}
          />
        </div>
      </div>

      <WorkItemModal
        workRef={detailActivityId ? { type: "project_activity", id: detailActivityId } : null}
        open={Boolean(detailActivityId)}
        onOpenChange={(v) => { if (!v) setDetailActivityId(null); }}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: ["activities"] })}
      />

      {/* Time entry dialog */}
      {timeEntryActivity && (
        <TimeEntryDialog
          activity={timeEntryActivity}
          open={Boolean(timeEntryActivity)}
          onOpenChange={(v) => { if (!v) setTimeEntryActivity(null); }}
        />
      )}
    </AppShell>
  );
}
