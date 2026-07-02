import { useState } from "react";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Search } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hasAnyPermission } from "@/lib/permissions";
import type { User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { listDepartments } from "@/services/orgService";
import { listUsers } from "@/services/userService";

export const Route = createFileRoute("/teams")({
  head: () => ({ meta: [{ title: "Usuários e acessos · NimbusDesk" }] }),
  component: TeamsPage,
});

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function stringToColor(str: string) {
  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#0ea5e9", "#3b82f6",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  ADMIN: { label: "Admin", cls: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" },
  TECHNICIAN: { label: "Técnico", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  CLIENT: { label: "Cliente", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
};

function TeamsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentUser = getStoredUser<User>();
  const canViewUsers = hasAnyPermission(currentUser, [
    "users.view",
    "users.manage",
    "users.managePermissions",
  ]);
  const canManage = hasAnyPermission(currentUser, [
    "users.managePermissions",
    "users.manage",
  ]);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
    enabled: canViewUsers,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
    enabled: canViewUsers,
  });

  if (pathname !== "/teams") {
    return <Outlet />;
  }

  const filtered = users.filter((u) => {
    const name = (
      u.name ||
      `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
      u.email ||
      ""
    ).toLowerCase();
    const email = (u.email || "").toLowerCase();
    const q = search.toLowerCase();

    if (q && !name.includes(q) && !email.includes(q)) return false;
    if (roleFilter !== "all" && u.role?.toUpperCase() !== roleFilter) return false;
    if (deptFilter !== "all" && u.department !== deptFilter) return false;
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Usuários e acessos</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Carregando..."
                : `${filtered.length} de ${users.length} usuário${users.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {canManage && (
            <Button
              asChild
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <a href="/teams/new">
                <Plus className="h-4 w-4" /> Novo usuário
              </a>
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="TECHNICIAN">Técnico</SelectItem>
              <SelectItem value="CLIENT">Cliente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os departamentos</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela de usuários */}
        {isLoading ? (
          <div className="glass h-64 animate-pulse rounded-2xl" />
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl py-16 text-center text-muted-foreground">
            Nenhum usuário encontrado
          </div>
        ) : (
          <div className="glass overflow-x-auto rounded-2xl shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Usuário</th>
                  <th className="px-2 py-2.5 text-left font-medium">Tipo</th>
                  <th className="hidden lg:table-cell px-2 py-2.5 text-left font-medium">Departamento</th>
                  <th className="hidden lg:table-cell px-2 py-2.5 text-left font-medium">Cargo</th>
                  <th className="hidden lg:table-cell px-2 py-2.5 text-left font-medium">Equipes</th>
                  <th className="px-2 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => {
                  const name =
                    member.name ||
                    `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
                    member.email ||
                    "Usuário";
                  const role = member.role?.toUpperCase() || "TECHNICIAN";
                  const badge = ROLE_BADGE[role] || ROLE_BADGE.TECHNICIAN;
                  return (
                    <tr key={member.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                            style={{ backgroundColor: stringToColor(name) }}
                          >
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0">
                            <a href={`/teams/${member.id}`} className="block truncate font-medium hover:text-primary">
                              {name}
                            </a>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {member.email || member.username || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell px-2 py-2.5 text-muted-foreground">
                        {member.department_name || "—"}
                      </td>
                      <td className="hidden lg:table-cell px-2 py-2.5 text-muted-foreground">
                        {member.position_name || member.job_title || "—"}
                      </td>
                      <td className="hidden lg:table-cell px-2 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(member.teams_data ?? []).slice(0, 3).map((team) => (
                            <span
                              key={team.id}
                              className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                              style={{ borderColor: `${team.color}60`, backgroundColor: `${team.color}15`, color: team.color }}
                            >
                              {team.name}
                            </span>
                          ))}
                          {(member.teams_data?.length ?? 0) === 0 && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            member.is_active === false
                              ? "bg-muted text-muted-foreground"
                              : "bg-success/15 text-success"
                          }`}
                        >
                          {member.is_active === false ? "Inativo" : "Ativo"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <a
                            href={`/teams/${member.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                          >
                            <Eye className="h-3.5 w-3.5" /> Detalhes
                          </a>
                          {canManage && (
                            <a
                              href={`/teams/${member.id}/edit`}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
