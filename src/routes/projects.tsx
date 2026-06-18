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
  head: () => ({ meta: [{ title: "Projetos · Stratos Suite" }] }),
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

function ProjectsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
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
              <Link
                to="/projects"
                className="rounded-lg bg-gradient-primary px-3 py-1.5 text-primary-foreground shadow-glow"
              >
                Lista
              </Link>
              <Link
                to="/kanban"
                className="glass rounded-lg px-3 py-1.5 transition-colors hover:border-primary/40"
              >
                Kanban
              </Link>
              <span
                title="Timeline em breve"
                className="glass cursor-not-allowed rounded-lg px-3 py-1.5 text-muted-foreground/80"
              >
                Timeline
              </span>
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

        <div className="glass overflow-hidden rounded-2xl shadow-card">
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
        </div>
      </div>
    </AppShell>
  );
}
