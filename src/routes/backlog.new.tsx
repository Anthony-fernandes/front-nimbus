import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { BacklogItemForm } from "@/components/forms/BacklogItemForm";

export const Route = createFileRoute("/backlog/new")({
  head: () => ({ meta: [{ title: "Novo item de backlog · Stratos Suite" }] }),
  component: () => (
    <AppShell>
      <div className="space-y-5">
        <PageHeader crumbs={[{ label: "Workspace", to: "/" }, { label: "Backlog", to: "/backlog" }, { label: "Novo" }]} title="Novo item de backlog" subtitle="Cadastre uma história, tarefa ou bug para planejamento futuro." />
        <BacklogItemForm />
      </div>
    </AppShell>
  ),
});
