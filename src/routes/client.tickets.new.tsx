import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientScopeNotice } from "@/components/client/ClientScopeNotice";
import { ClientTicketRequestForm } from "@/components/forms/ClientTicketRequestForm";
import { getUserClientId } from "@/lib/auth";
import type { User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";

export const Route = createFileRoute("/client/tickets/new")({
  head: () => ({ meta: [{ title: "Abrir chamado · NimbusDesk" }] }),
  component: ClientTicketNewPage,
});

function ClientTicketNewPage() {
  const user = getStoredUser<User>();
  const clientId = getUserClientId(user);

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[
            { label: "Portal", to: "/client" },
            { label: "Chamados", to: "/client/tickets" },
            { label: "Novo" },
          ]}
          title="Abrir chamado"
          subtitle="Envie uma nova solicitacao para a equipe acompanhar pelo portal."
        />
        {clientId ? <ClientTicketRequestForm /> : <ClientScopeNotice />}
      </div>
    </AppShell>
  );
}
