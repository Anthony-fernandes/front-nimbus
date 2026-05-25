import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientForm } from "@/components/forms/ClientForm";
import { getClient, toClientFormData } from "@/services/clientService";

export const Route = createFileRoute("/clients/$id/edit")({
  head: () => ({ meta: [{ title: "Editar cliente · Stratos Suite" }] }),
  component: EditClient,
});

function EditClient() {
  const { id } = Route.useParams();
  const { data: client, isLoading, isError } = useQuery({
    queryKey: ["client", id],
    queryFn: () => getClient(id),
  });

  return (
    <AppShell>
      <div className="space-y-5 max-w-7xl">
        <PageHeader crumbs={[{ label: "Clientes", to: "/clients" }, { label: id, to: `/clients/${id}` }, { label: "Editar" }]} title="Editar cliente" />
        {isLoading && <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando cliente...</div>}
        {isError && <div className="glass rounded-2xl p-6 text-sm text-destructive">Não foi possível carregar o cliente.</div>}
        {client && <ClientForm mode="edit" entityId={id} onCancelHref={`/clients/${id}`} initial={toClientFormData(client)} />}
      </div>
    </AppShell>
  );
}
