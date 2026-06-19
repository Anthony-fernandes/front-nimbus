import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { SprintForm } from "@/components/forms/SprintForm";
import { getSprint, toSprintFormData } from "@/services/sprintService";

export const Route = createFileRoute("/sprints/$id/edit")({
  head: () => ({ meta: [{ title: "Editar sprint · NimbusDesk" }] }),
  component: EditSprint,
});

function EditSprint() {
  const { id } = Route.useParams();
  const { data: sprint, isLoading, isError } = useQuery({
    queryKey: ["sprint", id],
    queryFn: () => getSprint(id),
  });

  return (
    <AppShell>
      <div className="space-y-5 max-w-7xl">
        <PageHeader crumbs={[{ label: "Sprints", to: "/sprints" }, { label: id, to: `/sprints/${id}` }, { label: "Editar" }]} title="Editar sprint" />
        {isLoading && <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando sprint...</div>}
        {isError && <div className="glass rounded-2xl p-6 text-sm text-destructive">Não foi possível carregar a sprint.</div>}
        {sprint && <SprintForm mode="edit" entityId={id} onCancelHref={`/sprints/${id}`} initial={toSprintFormData(sprint)} />}
      </div>
    </AppShell>
  );
}
