import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientForm } from "@/components/forms/ClientForm";

export const Route = createFileRoute("/clients/new")({
  head: () => ({ meta: [{ title: "Novo cliente · Nimbus" }] }),
  component: () => (
    <AppShell><div className="space-y-5 max-w-7xl">
      <PageHeader crumbs={[{label:"Clientes",to:"/clients"},{label:"Novo"}]} title="Novo cliente" subtitle="Cadastre uma nova conta no workspace." />
      <ClientForm mode="create" />
    </div></AppShell>
  ),
});