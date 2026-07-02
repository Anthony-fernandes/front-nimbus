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
          <div className="glass overflow-x-auto rounded-2xl shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Equipe</th>
                  <th className="px-2 py-2.5 text-left font-medium">Tipo</th>
                  <th className="hidden lg:table-cell px-2 py-2.5 text-left font-medium">Líder</th>
                  <th className="px-2 py-2.5 text-left font-medium">Membros</th>
                  <th className="px-2 py-2.5 text-left font-medium">Status</th>
                  <th className="hidden lg:table-cell px-4 py-2.5 text-left font-medium">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => {
                  const memberCount = team.member_count ?? team.members?.length ?? 0;
                  const tipo = team.tipo ?? "equipe";
                  const icon = team.icon || (team.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""));
                  return (
                    <tr
                      key={team.id}
                      className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-2.5">
                        <Link to="/equipes/$id" params={{ id: team.id }} className="flex items-center gap-3">
                          <div
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                            style={{ backgroundColor: team.color || "#6366f1" }}
                          >
                            {icon}
                          </div>
                          <span className="font-medium hover:text-primary">{team.name}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tipo === "grupo" ? "bg-amber-500/10 text-amber-400" : "bg-primary/10 text-primary"}`}>
                          {tipo === "grupo" ? "Grupo" : "Equipe"}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell px-2 py-2.5 text-muted-foreground">{team.leader_name || "—"}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            {(team.members ?? []).slice(0, 4).map((m, i) => {
                              const name = m.user_name || String(m.user);
                              const ini = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
                              return (
                                <div key={m.id} title={name}
                                  className={`${i > 0 ? "-ml-1.5" : ""} grid h-6 w-6 place-items-center rounded-full bg-gradient-primary text-[8px] font-bold text-primary-foreground ring-2 ring-background`}>
                                  {ini}
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-xs text-muted-foreground">{memberCount}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${team.status === "Ativa" ? "bg-success/15 text-success" : team.status === "Inativa" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
                          {team.status || "Ativa"}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell max-w-[280px] truncate px-4 py-2.5 text-xs text-muted-foreground">
                        {team.description || "—"}
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
