import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { TicketForm } from "@/components/forms/TicketForm";
import { getTicket, toTicketFormData } from "@/services/ticketService";

export const Route = createFileRoute("/tickets/$id/edit")({
  head: () => ({ meta: [{ title: "Editar chamado - Stratos Suite" }] }),
  component: EditTicketPage,
});

function EditTicketPage() {
  const { id } = Route.useParams();
  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => getTicket(id),
  });

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[
            { label: "Chamados", to: "/tickets" },
            { label: id, to: `/tickets/${id}` },
            { label: "Editar" },
          ]}
          title={`Editar ${id}`}
          subtitle="Atualize informações, atribuicao e contexto. O status segue o workflow do chamado."
        />
        {isLoading ? (
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
            Carregando chamado...
          </div>
        ) : null}
        {isError ? (
          <div className="glass rounded-2xl p-6 text-sm text-destructive">
            Nao foi possivel carregar o chamado.
          </div>
        ) : null}
        {ticket ? (
          <TicketForm
            mode="edit"
            entityId={id}
            onCancelHref={`/tickets/${id}`}
            initial={toTicketFormData(ticket)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
