import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientForm } from "@/components/forms/ClientForm";

export const Route = createFileRoute("/clients/new")({
  head: () => ({ meta: [{ title: "Nova organização · Nimbus" }] }),
  component: () => (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Organizações", to: "/clients" }, { label: "Nova" }]}
          title="Nova organização"
          subtitle="Cadastre uma nova organização atendida no workspace."
        />
        <ClientForm mode="create" />
      </div>
    </AppShell>
  ),
});
