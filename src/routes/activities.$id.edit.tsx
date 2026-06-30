import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ActivityForm } from "@/components/forms/ActivityForm";
import { getActivity, toActivityFormData } from "@/services/activityService";

export const Route = createFileRoute("/activities/$id/edit")({
  head: () => ({ meta: [{ title: "Editar atividade - NimbusDesk" }] }),
  component: EditActivity,
});

function EditActivity() {
  const { id } = Route.useParams();
  const { data: activity, isLoading, isError } = useQuery({
    queryKey: ["activity", id],
    queryFn: () => getActivity(id),
  });
  const initial = activity ? toActivityFormData(activity) : undefined;

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[
            { label: "Atividades", to: "/activities" },
            { label: id, to: `/activities/${id}` },
            { label: "Editar" },
          ]}
          title="Editar atividade"
          subtitle="Atualize os dados base da atividade. Planejamento e apontamentos ficam nas telas especificas."
        />
        {isLoading ? (
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
            Carregando atividade...
          </div>
        ) : null}
        {isError ? (
          <div className="glass rounded-2xl p-6 text-sm text-destructive">
            Nao foi possivel carregar a atividade.
          </div>
        ) : null}
        {activity && initial ? (
          <ActivityForm
            mode="edit"
            entityId={id}
            onCancelHref={`/activities/${id}`}
            initial={initial}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
