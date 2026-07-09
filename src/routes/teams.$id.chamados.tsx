import { createFileRoute } from "@tanstack/react-router";

import { TeamWorkspace } from "@/components/app/TeamWorkspace";

export const Route = createFileRoute("/teams/$id/chamados")({
  head: () => ({ meta: [{ title: "Chamados da equipe · NimbusDesk" }] }),
  component: TeamChamados,
});

function TeamChamados() {
  const { id } = Route.useParams();
  return <TeamWorkspace teamId={id} section="chamados" />;
}
