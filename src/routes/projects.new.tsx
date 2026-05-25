import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ProjectForm } from "@/components/forms/ProjectForm";

export const Route = createFileRoute("/projects/new")({
  head: () => ({ meta: [{ title: "Novo projeto · Nimbus" }] }),
  component: () => (
    <AppShell>
      <div className="space-y-5 max-w-7xl">
        <PageHeader crumbs={[{label:"Projetos",to:"/projects"},{label:"Novo"}]} title="Novo projeto" subtitle="Defina escopo, equipe e cronograma." />
        <ProjectForm mode="create" />
      </div>
    </AppShell>
  ),
});