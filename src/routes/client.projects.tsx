import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientScopeNotice } from "@/components/client/ClientScopeNotice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getUserClientId } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { Project, User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { listProjects } from "@/services/projectService";

export const Route = createFileRoute("/client/projects")({
  head: () => ({ meta: [{ title: "Projetos do cliente · Stratos Suite" }] }),
  component: ClientProjectsPage,
});

function ClientProjectsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const user = getStoredUser<User>();
  const clientId = getUserClientId(user);
  const canViewProjects = hasPermission(user, "projects.view");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["client-projects-list", clientId],
    queryFn: () => listProjects({ client: clientId }),
    enabled: Boolean(clientId) && canViewProjects,
  });

  if (pathname !== "/client/projects") {
    return <Outlet />;
  }

  if (!clientId) {
    return (
      <AppShell>
        <ClientScopeNotice />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          crumbs={[{ label: "Portal", to: "/client" }, { label: "Projetos" }]}
          title="Meus projetos"
          subtitle={
            isLoading
              ? "Carregando projetos..."
              : `${projects.length} projetos vinculados a sua conta`
          }
        />

        {projects.length === 0 && !isLoading && (
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
            Nenhum projeto vinculado a esta conta.
          </div>
        )}

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground hover:bg-transparent">
                <TableHead className="px-4 py-2.5">Projeto</TableHead>
                <TableHead className="px-2 py-2.5">Status</TableHead>
                <TableHead className="px-2 py-2.5">Responsavel</TableHead>
                <TableHead className="px-2 py-2.5">Equipe</TableHead>
                <TableHead className="px-2 py-2.5">Progresso</TableHead>
                <TableHead className="px-2 py-2.5">Entrega</TableHead>
                <TableHead className="px-4 py-2.5 text-right">Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(projects.filter(Boolean) as Project[]).map((project) => {
                const projectRisk = Math.max(0, 100 - Number(project.progress ?? 0));

                return (
                  <TableRow key={project.id} className="border-border hover:bg-muted/30">
                    <TableCell className="px-4 py-3">
                      <div className="min-w-0">
                        <Link
                          to="/client/projects/$id"
                          params={{ id: project.id }}
                          className="truncate font-medium hover:text-primary"
                        >
                          {project.name}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                          {project.client_name || "Sua conta"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                        {project.status || "Planejado"}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-muted-foreground">
                      {project.owner_name || "-"}
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      {(project.team_names || []).length
                        ? `${project.team_names?.length ?? 0} pessoas`
                        : "Sem equipe"}
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
                    <TableCell className="px-2 py-3 text-muted-foreground">
                      {project.due_at
                        ? new Date(project.due_at).toLocaleDateString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] ${
                          projectRisk > 60
                            ? "text-destructive"
                            : projectRisk > 35
                              ? "text-warning"
                              : "text-success"
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" /> {projectRisk}%
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
