import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, Pencil, Plus } from "lucide-react";

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
import { getRoleLabel } from "@/lib/auth";
import {
  countEnabledPermissions,
  hasAnyPermission,
  resolveUserPermissions,
} from "@/lib/permissions";
import type { User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { listUsers } from "@/services/userService";

export const Route = createFileRoute("/teams")({
  head: () => ({ meta: [{ title: "Usuários e acessos · NimbusDesk" }] }),
  component: TeamsPage,
});

function TeamsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentUser = getStoredUser<User>();
  const canViewUsers = hasAnyPermission(currentUser, [
    "users.view",
    "users.manage",
    "users.managePermissions",
  ]);
  const { data: team = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
  });
  const canManageUserAccess = hasAnyPermission(currentUser, [
    "users.managePermissions",
    "users.manage",
  ]);

  if (pathname !== "/teams") {
    return <Outlet />;
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Usuários e acessos</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Carregando usuários..." : `${team.length} usuários cadastrados`}
            </p>
          </div>
          {canManageUserAccess ? (
            <Button
              asChild
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <a href="/teams/new">
                <Plus className="h-4 w-4" /> Novo usuário
              </a>
            </Button>
          ) : null}
        </div>

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground hover:bg-transparent">
                <TableHead className="px-4 py-2.5">Usuário</TableHead>
                <TableHead className="px-2 py-2.5">Tipo</TableHead>
                <TableHead className="px-2 py-2.5">Contato</TableHead>
                <TableHead className="px-2 py-2.5">Área</TableHead>
                <TableHead className="px-2 py-2.5">Disponível</TableHead>
                <TableHead className="px-2 py-2.5">Usadas</TableHead>
                <TableHead className="px-2 py-2.5">Blocos</TableHead>
                <TableHead className="px-2 py-2.5">Permissões</TableHead>
                <TableHead className="px-2 py-2.5">Ações</TableHead>
                <TableHead className="px-4 py-2.5 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((member: User) => {
                const name =
                  member.name ||
                  `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
                  member.email ||
                  "Usuário";
                const available = member.total_hours ?? 40;
                const used = member.used_hours ?? 0;
                const finalPermissions = resolveUserPermissions(member);
                const blockCount = member.permission_blocks_data?.length ?? 0;
                const finalPermissionCount = countEnabledPermissions(finalPermissions);

                return (
                  <TableRow key={member.id} className="border-border hover:bg-muted/30">
                    <TableCell className="px-4 py-3">
                      <div className="min-w-0">
                        <a href={`/teams/${member.id}`} className="truncate font-medium hover:text-primary">
                          {name}
                        </a>
                        <div className="text-[11px] text-muted-foreground">
                          {member.username || member.email || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <div>{getRoleLabel(member.role)}</div>
                      {member.organization_name || member.client_name ? (
                        <div className="text-[11px] text-muted-foreground">
                          {member.organization_name || member.client_name}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-2 py-3 text-muted-foreground">
                      <div>{member.email || "Não informado"}</div>
                      <div className="text-[11px]">{member.phone || "-"}</div>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-muted-foreground">
                      {member.specialty || member.technical_group || member.job_title || "-"}
                    </TableCell>
                    <TableCell className="px-2 py-3 font-medium">
                      {Math.max(0, available - used)}h
                    </TableCell>
                    <TableCell className="px-2 py-3">{used}h</TableCell>
                    <TableCell className="px-2 py-3">
                      {blockCount}
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      {finalPermissionCount}
                    </TableCell>
                    <TableCell className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/teams/${member.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          <Eye className="h-3.5 w-3.5" /> Detalhes
                        </a>
                        {canManageUserAccess ? (
                          <a
                            href={`/teams/${member.id}/edit`}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                        {member.is_active === false ? "Inativo" : "Ativo"}
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
