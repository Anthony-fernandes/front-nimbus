import { createFileRoute } from "@tanstack/react-router";

import { TeamWorkspace } from "@/components/app/TeamWorkspace";

export const Route = createFileRoute("/teams/$id/sprints")({
  head: () => ({ meta: [{ title: "Sprints da equipe · NimbusDesk" }] }),
  component: TeamSprints,
});

function TeamSprints() {
  const { id } = Route.useParams();
  return <TeamWorkspace teamId={id} section="sprints" />;
}
