import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { TeamForm } from "@/components/forms/TeamForm";

export const Route = createFileRoute("/equipes/nova")({
  head: () => ({ meta: [{ title: "Nova equipe · NimbusDesk" }] }),
  component: () => (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          crumbs={[{ label: "Equipes", to: "/equipes" }, { label: "Nova" }]}
          title="Nova equipe"
          subtitle="Crie uma equipe, adicione membros e defina a capacidade padrão."
        />
        <TeamForm mode="create" />
      </div>
    </AppShell>
  ),
});
