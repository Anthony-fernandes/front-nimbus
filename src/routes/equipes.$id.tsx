import { useState } from "react";
import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Users, Zap } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { deleteTeam, getTeam, listTeamMembers } from "@/services/teamService";

export const Route = createFileRoute("/equipes/$id")({
  head: () => ({ meta: [{ title: "Detalhes da equipe · NimbusDesk" }] }),
  component: EquipeDetail,
});

function EquipeDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const teamQ = useQuery({ queryKey: ["team", id], queryFn: () => getTeam(id) });
  const membersQ = useQuery({ queryKey: ["team-members", id], queryFn: () => listTeamMembers(id) });
  const queryClient = useQueryClient();

  if (pathname !== `/equipes/${id}`) return <Outlet />;

  const team = teamQ.data;
  const members = membersQ.data ?? [];

  if (teamQ.isLoading) {
    return <AppShell><div className="glass rounded-2xl p-8 text-sm text-muted-foreground">Carregando equipe…</div></AppShell>;
  }
  if (!team) {
    return <AppShell><div className="glass rounded-2xl p-8 text-sm text-destructive">Equipe não encontrada.</div></AppShell>;
  }

  const icon = team.icon || team.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const memberCount = members.length;

  return (
    <AppShell>
      <div className="max-w-5xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Equipes", to: "/equipes" }, { label: team.name }]}
          title={
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: team.color || "#6366f1" }}>
                {icon}
              </span>
              {team.name}
            </span>
          }
          subtitle={team.description || undefined}
          badges={
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${team.status === "Ativa" ? "bg-success/15 text-success" : team.status === "Inativa" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
              {team.status || "Ativa"}
            </span>
          }
          actions={
            <>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/equipes/$id/editar" params={{ id }}><Pencil className="h-3.5 w-3.5" /> Editar</Link>
              </Button>
              <ConfirmDelete onConfirm={async () => {
                await deleteTeam(id);
                await queryClient.invalidateQueries({ queryKey: ["teams"] });
                toast.success("Equipe excluída.");
                navigate({ to: "/equipes" });
              }} />
            </>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Membros" value={String(memberCount)} />
          <StatCard label="Líder" value={team.leader_name || "—"} />
          <StatCard label="Capacidade padrão" value={team.default_capacity ? `${team.default_capacity}h` : "—"} />
          <StatCard label="Status" value={team.status || "Ativa"} />
        </div>

        {/* Content */}
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          {/* Members list */}
          <div className="glass rounded-2xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-semibold text-foreground">Membros</h3>
              <span className="text-xs text-muted-foreground">{memberCount} membro{memberCount !== 1 ? "s" : ""}</span>
            </div>
            {members.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/equipes/$id/editar" params={{ id }}>Adicionar membros</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members.map((m) => {
                  const name = m.user_name || String(m.user);
                  const ini = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                        {ini}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {m.user_email && <p className="text-xs text-muted-foreground truncate">{m.user_email}</p>}
                      </div>
                      {m.role && <span className="text-xs text-muted-foreground">{m.role}</span>}
                      {m.default_capacity ? (
                        <span className="text-xs font-semibold text-muted-foreground">{m.default_capacity}h</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Side info */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5 shadow-card space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Sobre a equipe</h3>
              {team.description ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{team.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Sem descrição.</p>
              )}
            </div>

            <div className="glass rounded-2xl p-5 shadow-card space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Zap className="h-4 w-4" /> Distribuição de membros</h3>
              <div className="space-y-2">
                {members.slice(0, 6).map((m) => {
                  const name = m.user_name || String(m.user);
                  const ini = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
                  return (
                    <div key={m.id} className="flex items-center gap-2">
                      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-primary text-[9px] font-bold text-primary-foreground">
                        {ini}
                      </div>
                      <span className="flex-1 text-xs truncate">{name}</span>
                      {m.default_hours_per_day && (
                        <span className="text-[10px] text-muted-foreground">{m.default_hours_per_day}h/d</span>
                      )}
                    </div>
                  );
                })}
                {memberCount > 6 && <p className="text-xs text-muted-foreground">+{memberCount - 6} mais…</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4 shadow-card animate-fade-in-up">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold truncate">{value}</div>
    </div>
  );
}
