import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, Zap } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { listTeams } from "@/services/teamService";

export const Route = createFileRoute("/equipes")({
  head: () => ({ meta: [{ title: "Equipes · NimbusDesk" }] }),
  component: EquipesPage,
});

function EquipesPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: teams = [], isLoading } = useQuery({ queryKey: ["teams"], queryFn: listTeams });

  if (pathname !== "/equipes") return <Outlet />;

  const active = teams.filter((t) => t.status === "Ativa");
  const totalMembers = teams.reduce((s, t) => s + (t.member_count ?? t.members?.length ?? 0), 0);

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Equipes</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Carregando equipes…" : `${teams.length} equipe${teams.length !== 1 ? "s" : ""} cadastrada${teams.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button asChild className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            <Link to="/equipes/nova"><Plus className="h-4 w-4" /> Nova equipe</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total de equipes" value={String(teams.length)} icon={<Users className="h-4 w-4 text-primary" />} />
          <StatCard label="Equipes ativas" value={String(active.length)} icon={<Zap className="h-4 w-4 text-success" />} />
          <StatCard label="Total de membros" value={String(totalMembers)} icon={<Users className="h-4 w-4 text-accent" />} />
          <StatCard label="Média de membros" value={teams.length ? (totalMembers / teams.length).toFixed(1) : "—"} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
        </div>

        {/* Teams grid */}
        {isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground shadow-card">Carregando equipes…</div>
        ) : teams.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center shadow-card space-y-3">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma equipe cadastrada.</p>
            <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
              <Link to="/equipes/nova"><Plus className="h-3.5 w-3.5 mr-1" /> Criar primeira equipe</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {[{ tipo: "equipe", label: "Equipes" }, { tipo: "grupo", label: "Grupos de Atendimento" }].map(({ tipo, label }) => {
              const filtered = teams.filter((t) => (t.tipo ?? "equipe") === tipo);
              if (filtered.length === 0) return null;
              return (
                <div key={tipo}>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((team) => {
              const memberCount = team.member_count ?? team.members?.length ?? 0;
              const icon = team.icon || (team.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""));
              return (
                <Link key={team.id} to="/equipes/$id" params={{ id: team.id }}
                  className="glass rounded-2xl p-5 shadow-card space-y-4 hover:border-primary/30 border border-border transition-colors group animate-fade-in-up">
                  {/* Team header */}
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow" style={{ backgroundColor: team.color || "#6366f1" }}>
                      {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{team.name}</p>
                      {team.leader_name && <p className="text-xs text-muted-foreground truncate">Líder: {team.leader_name}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${team.status === "Ativa" ? "bg-success/15 text-success" : team.status === "Inativa" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
                        {team.status || "Ativa"}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${tipo === "grupo" ? "bg-amber-500/10 text-amber-400" : "bg-primary/10 text-primary"}`}>
                        {tipo === "grupo" ? "Grupo" : "Equipe"}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {team.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{team.description}</p>
                  )}

                  {/* Member avatars */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {(team.members ?? []).slice(0, 5).map((m, i) => {
                        const name = m.user_name || String(m.user);
                        const ini = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
                        return (
                          <div key={m.id} title={name}
                            className={`${i > 0 ? "-ml-2" : ""} grid h-7 w-7 place-items-center rounded-full bg-gradient-primary text-[9px] font-bold text-primary-foreground ring-2 ring-background`}>
                            {ini}
                          </div>
                        );
                      })}
                      {memberCount > 5 && (
                        <div className="-ml-2 grid h-7 w-7 place-items-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground ring-2 ring-background">
                          +{memberCount - 5}
                        </div>
                      )}
                      {memberCount === 0 && <span className="text-xs text-muted-foreground">Sem membros</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{memberCount} membro{memberCount !== 1 ? "s" : ""}</span>
                  </div>
                </Link>
              );
            })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-card animate-fade-in-up">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
