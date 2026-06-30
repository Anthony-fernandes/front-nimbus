import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { SprintForm } from "@/components/forms/SprintForm";

export const Route = createFileRoute("/sprints/new")({
  head: () => ({ meta: [{ title: "Nova sprint · NimbusDesk" }] }),
  component: () => (
    <AppShell>
      <div className="space-y-5 max-w-7xl">
        <PageHeader crumbs={[{label:"Sprints",to:"/sprints"},{label:"Nova"}]} title="Nova sprint" subtitle="Planeje objetivo, capacidade e itens do backlog." />
        <SprintForm mode="create" />
      </div>
    </AppShell>
  ),
});