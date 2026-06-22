import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Mail, Pencil, Phone, Shield } from "lucide-react";
import { toast } from "sonner";

import type { Project } from "@/lib/types";
import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRoleLabel } from "@/lib/auth";
import {
  flattenGrantedPermissions,
  getPermissionBlocks,
  getPermissionLabel,
  getPermissionSummary,
  hasAnyPermission,
} from "@/lib/permissions";
import { listActivities } from "@/services/activityService";
import { getStoredUser } from "@/services/authService";
import { listProjects } from "@/services/projectService";
import { listSprints } from "@/services/sprintService";
import { listTickets } from "@/services/ticketService";
import { deleteUser, getUser } from "@/services/userService";
import { formatCurrency } from "@/services/utils";

export const Route = createFileRoute("/teams/$id")({
  head: () => ({ meta: [{ title: "Detalhes do usuário · NimbusDesk" }] }),
  component: MemberDetail,
});

function MemberDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentUser = getStoredUser();
  const canViewUsers = hasAnyPermission(currentUser, [
    "users.view",
    "users.manage",
    "users.managePermissions",
  ]);
  const userQuery = useQuery({
    queryKey: ["user", id],
    queryFn: () => getUser(id),
    enabled: canViewUsers,
  });
  const results = useQueries({
    queries: [
      { queryKey: ["user-tickets", id], queryFn: () => listTickets(), enabled: canViewUsers },
      { queryKey: ["user-projects", id], queryFn: () => listProjects(), enabled: canViewUsers },
      { queryKey: ["user-sprints", id], queryFn: () => listSprints(), enabled: canViewUsers },
      { queryKey: ["user-activities", id], queryFn: () => listActivities(), enabled: canViewUsers },
    ],
  });

  const user = userQuery.data;
  const tickets = (results[0].data || []).filter((ticket) => ticket.technicians?.includes(id));
  const projects = ((results[1].data || []) as Project[]).filter(
    (project) => project !== null && (project.owner === id || project.team?.includes(id)),
  );
  const sprints = (results[2].data || []).filter((sprint) => sprint.lead === id);
  const activities = (results[3].data || []).filter((activity) => activity.assignee === id);

  if (pathname !== `/teams/${id}`) {
    return <Outlet />;
  }

  if (userQuery.isLoading) {
    return (
      <AppShell>
        <div className="rounded-2xl p-6 text-sm text-muted-foreground glass">
          Carregando usuário...
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="rounded-2xl p-6 text-sm text-destructive glass">
          Usuário não encontrado.
        </div>
      </AppShell>
    );
  }

  const name =
    user.name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username ||
    "Usuário";
  const available = user.total_hours ?? 0;
  const used = user.used_hours ?? 0;
  const canEditUsers = hasAnyPermission(currentUser, ["users.managePermissions", "users.manage"]);
  const canDeleteUsers = hasAnyPermission(currentUser, ["users.delete", "users.manage"]);
  const permissionBlocks = getPermissionBlocks(user);
  const grantedPermissionKeys = flattenGrantedPermissions(user.granted_permissions).concat(
    user.granted_permissions ? [] : user.permissions_json || [],
  ).filter((value, index, list) => list.indexOf(value) === index);
  const deniedPermissionKeys = flattenGrantedPermissions(user.denied_permissions);
  const permissionSummary = getPermissionSummary(user).filter(
    (item) => item.granted || item.deniedDirectly,
  );

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Usuários", to: "/teams" }, { label: name }]}
          title={
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground">
                {name
                  .split(" ")
                  .map((segment) => segment[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              {name}
            </span>
          }
          subtitle={`${getRoleLabel(user.role)}${user.job_title ? ` · ${user.job_title}` : ""}${user.specialty || user.technical_group ? ` · ${user.specialty || user.technical_group}` : ""}`}
          badges={
            <span className="rounded bg-success/15 px-2 py-1 text-[11px] text-success">
              {user.is_active === false ? "Inativo" : "Ativo"}
            </span>
          }
          actions={
            <>
              {canEditUsers ? (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`/teams/${id}/edit`}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </a>
                </Button>
              ) : null}
              {canDeleteUsers ? (
                <ConfirmDelete
                  onConfirm={async () => {
                    await deleteUser(id);
                    toast.success("Usuário excluído");
                    navigate({ to: "/teams" });
                  }}
                />
              ) : null}
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Chamados" value={String(tickets.length)} />
          <Stat label="Projetos" value={String(projects.length)} />
          <Stat label="Atividades" value={String(activities.length)} />
          <Stat label="Horas semana" value={`${used}h / ${available}h`} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs defaultValue="tickets" className="space-y-4">
              <TabsList className="border border-border bg-muted/40">
                <TabsTrigger value="tickets">Chamados</TabsTrigger>
                <TabsTrigger value="projects">Projetos</TabsTrigger>
                <TabsTrigger value="sprints">Sprints</TabsTrigger>
                <TabsTrigger value="activities">Atividades</TabsTrigger>
              </TabsList>

              <TabsContent value="tickets" className="space-y-2">
                {tickets.length === 0 && <EmptyPanel text="Nenhum chamado atribuído." />}
                {tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    to="/tickets/$id"
                    params={{ id: ticket.id }}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3 transition hover:border-primary/40"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {ticket.code || ticket.id.slice(0, 8)}
                    </span>
                    <span className="mx-3 flex-1 text-sm">{ticket.title}</span>
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                      {ticket.status || "Triagem"}
                    </span>
                  </Link>
                ))}
              </TabsContent>

              <TabsContent value="projects" className="space-y-2">
                {projects.length === 0 && <EmptyPanel text="Nenhum projeto vinculado." />}
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    to="/projects/$id"
                    params={{ id: project.id }}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3 transition hover:border-primary/40"
                  >
                    <span className="text-sm">{project.name}</span>
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                      {project.status || "Planejado"}
                    </span>
                  </Link>
                ))}
              </TabsContent>

              <TabsContent value="sprints" className="space-y-2">
                {sprints.length === 0 && <EmptyPanel text="Nenhuma sprint como responsável." />}
                {sprints.map((sprint) => (
                  <Link
                    key={sprint.id}
                    to="/sprints/$id"
                    params={{ id: sprint.id }}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3 transition hover:border-primary/40"
                  >
                    <span className="text-sm">{sprint.name}</span>
                    <span className="rounded bg-success/15 px-2 py-0.5 text-[11px] text-success">
                      {sprint.status || "Planejada"}
                    </span>
                  </Link>
                ))}
              </TabsContent>

              <TabsContent value="activities" className="space-y-2">
                {activities.length === 0 && <EmptyPanel text="Nenhuma atividade atribuída." />}
                {activities.map((activity) => (
                  <Link
                    key={activity.id}
                    to="/activities/$id"
                    params={{ id: activity.id }}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3 transition hover:border-primary/40"
                  >
                    <span className="text-sm">{activity.title}</span>
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                      {activity.status || "Backlog"}
                    </span>
                  </Link>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl p-5 shadow-card glass">
              <h3 className="mb-3 text-sm font-semibold">Contato</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {user.email || "Não informado"}
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {user.phone || "Não informado"}
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted-foreground">Custo/hora:</span>
                  {formatCurrency(user.hourly_cost ?? 0)} / hora
                </li>
              </ul>
            </div>

            <div className="rounded-2xl p-5 shadow-card glass">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Shield className="h-4 w-4" /> Permissões
              </h3>

              <div className="space-y-4 text-sm">
                <PermissionSection
                  title="Blocos aplicados"
                  emptyText="Nenhum bloco aplicado."
                  items={permissionBlocks.map((block) => block.name)}
                  tone="primary"
                />
                <PermissionSection
                  title="Permissões extras"
                  emptyText="Nenhuma permissão extra cadastrada."
                  items={grantedPermissionKeys.map(getPermissionLabel)}
                  tone="success"
                />
                <PermissionSection
                  title="Permissões removidas"
                  emptyText="Nenhuma permissão removida."
                  items={deniedPermissionKeys.map(getPermissionLabel)}
                  tone="destructive"
                />

                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Permissões finais
                  </div>
                  <div className="space-y-2">
                    {permissionSummary.length ? (
                      permissionSummary.map((item) => (
                        <div
                          key={item.permission}
                          className="rounded-xl border border-border bg-muted/20 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span>{item.label}</span>
                            <span
                              className={
                                item.granted
                                  ? "rounded-md bg-success/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success"
                                  : "rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive"
                              }
                            >
                              {item.granted ? "Permitido" : "Negado"}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">Nenhuma permissão final ativa.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function PermissionSection({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: "primary" | "success" | "destructive";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "success"
        ? "bg-success/10 text-success"
        : "bg-destructive/10 text-destructive";

  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span
              key={`${title}-${item}`}
              className={`rounded-md px-2 py-1 text-[11px] ${toneClass}`}
            >
              {item}
            </span>
          ))
        ) : (
          <span className="text-muted-foreground">{emptyText}</span>
        )}
      </div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-2xl p-5 text-sm text-muted-foreground shadow-card glass">{text}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-4 glass">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
