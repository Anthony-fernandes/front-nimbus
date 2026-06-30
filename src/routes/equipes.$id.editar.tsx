import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { TeamForm } from "@/components/forms/TeamForm";
import { getTeam, listTeamMembers } from "@/services/teamService";

export const Route = createFileRoute("/equipes/$id/editar")({
  head: () => ({ meta: [{ title: "Editar equipe · Stratos Suite" }] }),
  component: EditarEquipe,
});

function EditarEquipe() {
  const { id } = Route.useParams();
  const { data: team, isLoading, isError } = useQuery({ queryKey: ["team", id], queryFn: () => getTeam(id) });
  const { data: members = [] } = useQuery({ queryKey: ["team-members", id], queryFn: () => listTeamMembers(id) });

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          crumbs={[{ label: "Equipes", to: "/equipes" }, { label: team?.name ?? id, to: `/equipes/${id}` }, { label: "Editar" }]}
          title="Editar equipe"
        />
        {isLoading && <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando…</div>}
        {isError && <div className="glass rounded-2xl p-6 text-sm text-destructive">Não foi possível carregar a equipe.</div>}
        {team && (
          <TeamForm
            mode="edit"
            entityId={id}
            onCancelHref={`/equipes/${id}`}
            initialMembers={members}
            initial={{
              name: team.name,
              description: team.description ?? "",
              leader: team.leader ?? "",
              status: team.status ?? "Ativa",
              color: team.color ?? "#6366f1",
              icon: team.icon ?? "",
              default_capacity: String(team.default_capacity ?? ""),
              tipo: (team.tipo as "equipe" | "grupo") ?? "equipe",
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
