import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ProjectForm } from "@/components/forms/ProjectForm";
import type { Project } from "@/lib/types";
import { getProject, toProjectFormData } from "@/services/projectService";

export const Route = createFileRoute("/projects/$id/edit")({
  head: () => ({ meta: [{ title: "Editar projeto · NimbusDesk" }] }),
  component: EditProject,
});

function EditProject() {
  const { id } = Route.useParams();
  const { data: project, isLoading, isError } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  });

  return (
    <AppShell>
      <div className="space-y-5 max-w-7xl">
        <PageHeader crumbs={[{ label: "Projetos", to: "/projects" }, { label: id, to: `/projects/${id}` }, { label: "Editar" }]} title="Editar projeto" subtitle="Atualize escopo, custos e equipe." />
        {isLoading && <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando projeto...</div>}
        {isError && <div className="glass rounded-2xl p-6 text-sm text-destructive">Não foi possível carregar o projeto.</div>}
        {project && <ProjectForm mode="edit" entityId={id} onCancelHref={`/projects/${id}`} initial={toProjectFormData(project as Project)} />}
      </div>
    </AppShell>
  );
}
