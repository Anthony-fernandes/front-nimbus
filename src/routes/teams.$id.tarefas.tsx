import { createFileRoute } from "@tanstack/react-router";

import { TeamWorkspace } from "@/components/app/TeamWorkspace";

export const Route = createFileRoute("/teams/$id/tarefas")({
  head: () => ({ meta: [{ title: "Tarefas da equipe · NimbusDesk" }] }),
  component: TeamTarefas,
});

function TeamTarefas() {
  const { id } = Route.useParams();
  return <TeamWorkspace teamId={id} section="tarefas" />;
}
