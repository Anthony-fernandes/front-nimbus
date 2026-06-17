import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientForm } from "@/components/forms/ClientForm";

export const Route = createFileRoute("/clients/new")({
  head: () => ({ meta: [{ title: "Nova organizacao · Nimbus" }] }),
  component: () => (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Organizacoes", to: "/clients" }, { label: "Nova" }]}
          title="Nova organizacao"
          subtitle="Cadastre uma nova organizacao atendida no workspace."
        />
        <ClientForm mode="create" />
      </div>
    </AppShell>
  ),
});
