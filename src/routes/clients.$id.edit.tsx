import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientForm } from "@/components/forms/ClientForm";
import { getClient, toClientFormData } from "@/services/clientService";

export const Route = createFileRoute("/clients/$id/edit")({
  head: () => ({ meta: [{ title: "Editar organização · Stratos Suite" }] }),
  component: EditOrganization,
});

function EditOrganization() {
  const { id } = Route.useParams();
  const { data: client, isLoading, isError } = useQuery({
    queryKey: ["client", id],
    queryFn: () => getClient(id),
  });

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[
            { label: "Organizações", to: "/clients" },
            { label: id, to: `/clients/${id}` },
            { label: "Editar" },
          ]}
          title="Editar organização"
        />
        {isLoading ? (
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
            Carregando organização...
          </div>
        ) : null}
        {isError ? (
          <div className="glass rounded-2xl p-6 text-sm text-destructive">
            Não foi possível carregar a organização.
          </div>
        ) : null}
        {client ? (
          <ClientForm
            mode="edit"
            entityId={id}
            onCancelHref={`/clients/${id}`}
            initial={toClientFormData(client)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
