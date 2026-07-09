import { createFileRoute } from "@tanstack/react-router";

import { TeamWorkspace } from "@/components/app/TeamWorkspace";

export const Route = createFileRoute("/teams/$id/bugs")({
  head: () => ({ meta: [{ title: "Bugs da equipe · NimbusDesk" }] }),
  component: TeamBugs,
});

function TeamBugs() {
  const { id } = Route.useParams();
  return <TeamWorkspace teamId={id} section="bugs" />;
}
