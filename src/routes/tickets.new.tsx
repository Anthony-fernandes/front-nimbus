import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { TicketForm } from "@/components/forms/TicketForm";

export const Route = createFileRoute("/tickets/new")({
  head: () => ({ meta: [{ title: "Novo chamado · Nimbus" }] }),
  component: NewTicketPage,
});

function NewTicketPage() {
  return (
    <AppShell>
      <div className="space-y-5 max-w-7xl">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: "Chamados", to: "/tickets" }, { label: "Novo" }]}
          title="Novo chamado"
          subtitle="Abra um chamado preenchendo as informações abaixo."
        />
        <TicketForm mode="create" />
      </div>
    </AppShell>
  );
}