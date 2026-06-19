import { useState } from "react";
import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Plus } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatProjectStatusLabel } from "@/lib/labels";
import type { Project } from "@/lib/types";
import { listProjects } from "@/services/projectService";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Projetos · NimbusDesk" }] }),
  component: ProjectsPage,
});

function risk(project: Project) {
  return Math.max(0, Math.min(100, 100 - Number(project.progress ?? 0)));
}

function daysUntil(date?: string | null) {
  if (!date) return "Sem prazo";
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return diff < 0 ? `${Math.abs(diff)} dias de atraso` : `${diff} dias`;
}

function ProjectTimeline({ projects }: { projects: Project[] }) {
  const projectsWithDates = projects.filter((p) => p.start_at || p.due_at);
  if (projectsWithDates.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
        Nenhum projeto com datas definidas para exibir na timeline.
      </div>
    );
  }

  const allDates = projectsWithDates.flatMap((p) => [p.start_at, p.due_at].filter(Boolean) as string[]);
  const minDate = new Date(Math.min(...allDates.map((d) => new Date(d).getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => new Date(d).getTime())));
  const totalMs = maxDate.getTime() - minDate.getTime() || 1;

  const statusColors: Record<string, string> = {
    "Em andamento": "bg-blue-500",
    "Planejado": "bg-slate-400",
    "Concluído": "bg-green-500",
    "Em risco": "bg-orange-500",
    "Cancelado": "bg-red-400",
  };

  return (
    <div className="glass overflow-hidden rounded-2xl shadow-card">
      <div className="overflow-x-auto p-4">
        <div className="min-w-[600px] space-y-2">
          {projectsWithDates.map((project) => {
            const start = project.start_at ? new Date(project.start_at) : minDate;
            const end = project.due_at ? new Date(project.due_at) : start;
            const left = ((start.getTime() - minDate.getTime()) / totalMs) * 100;
            const width = Math.max(1, ((end.getTime() - start.getTime()) / totalMs) * 100);
            const color = statusColors[project.status || ""] || "bg-primary";

            return (
              <div key={project.id} className="flex items-center gap-3">
                <Link
                  to="/projects/$id"
                  params={{ id: project.id }}
                  className="w-40 shrink-0 truncate text-xs font-medium hover:text-primary"
                >
                  {project.name}
                </Link>
                <div className="relative flex-1 h-6">
                  <div className="absolute inset-y-0 w-full rounded bg-muted/40" />
                  <div
                    className={`absolute inset-y-1 rounded ${color} opacity-80`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${project.start_at || "?"} → ${project.due_at || "?"}`}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-[10px] text-muted-foreground">
                  {project.progress ?? 0}%
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between text-[10px] text-muted-foreground min-w-[600px] pl-44 pr-16">
          <span>{minDate.toLocaleDateString("pt-BR")}</span>
          <span>{maxDate.toLocaleDateString("pt-BR")}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [view, setView] = useState<"list" | "timeline">("list");
  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  if (pathname !== "/projects") {
    return <Outlet />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
            <p className="text-sm text-muted-foreground">
              Portfolio · {isLoading ? "carregando..." : `${projects.length} projetos`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <a href="/projects/new">
                <Plus className="h-4 w-4" /> Novo projeto
              </a>
            </Button>
            <div className="flex gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${view === "list" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "glass hover:border-primary/40"}`}
              >
                Lista
              </button>
              <Link
                to="/kanban"
                className="glass rounded-lg px-3 py-1.5 transition-colors hover:border-primary/40"
              >
                Kanban
              </Link>
              <button
                type="button"
                onClick={() => setView("timeline")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${view === "timeline" ? "bg-gradient-primary text-primary-foreground shadow-glow" : "glass hover:border-primary/40"}`}
              >
                Timeline
              </button>
            </div>
          </div>
        </div>

        {isError ? (
          <div className="glass rounded-2xl p-4 text-sm text-destructive">
            Nao foi possivel carregar os projetos.
          </div>
        ) : null}

        {!isLoading && projects.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
            Nenhum projeto cadastrado.
          </div>
        ) : null}

        {view === "timeline" && <ProjectTimeline projects={projects.filter(Boolean) as Project[]} />}

        {view === "list" && <div className="glass overflow-hidden rounded-2xl shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground hover:bg-transparent">
                <TableHead className="px-4 py-2.5">Projeto</TableHead>
                <TableHead className="px-2 py-2.5">Organizacao atendida</TableHead>
                <TableHead className="px-2 py-2.5">Status</TableHead>
                <TableHead className="px-2 py-2.5">Progresso</TableHead>
                <TableHead className="px-2 py-2.5">Equipe</TableHead>
                <TableHead className="px-2 py-2.5">Entrega</TableHead>
                <TableHead className="px-4 py-2.5 text-right">Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(projects.filter(Boolean) as Project[]).map((project) => (
                <TableRow key={project.id} className="border-border hover:bg-muted/30">
                  <TableCell className="px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        to="/projects/$id"
                        params={{ id: project.id }}
                        className="truncate font-medium hover:text-primary"
                      >
                        {project.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        {project.owner_name || project.leader_name || "Sem lider definido"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-3 text-muted-foreground">
                    {project.organization_name || project.client_name || "Nao informado"}
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                      {formatProjectStatusLabel(project.status || "Planejado")}
                    </span>
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    <div className="flex min-w-[150px] items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-primary"
                          style={{ width: `${project.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="w-10 text-xs text-muted-foreground">
                        {project.progress ?? 0}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    {(project.team_names || []).length
                      ? `${project.team_names?.length ?? 0} pessoas`
                      : "Sem equipe"}
                  </TableCell>
                  <TableCell className="px-2 py-3 text-muted-foreground">
                    {daysUntil(project.due_at)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] ${
                        risk(project) > 60
                          ? "text-destructive"
                          : risk(project) > 35
                            ? "text-warning"
                            : "text-success"
                      }`}
                    >
                      <AlertTriangle className="h-3 w-3" /> {risk(project)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>}
      </div>
    </AppShell>
  );
}
