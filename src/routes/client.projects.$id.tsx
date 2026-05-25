import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientScopeNotice } from "@/components/client/ClientScopeNotice";
import { getUserClientId } from "@/lib/auth";
import type { User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { getProject } from "@/services/projectService";
import { formatCurrency, formatDate } from "@/services/utils";

export const Route = createFileRoute("/client/projects/$id")({
  head: () => ({ meta: [{ title: "Projeto do cliente · Stratos Suite" }] }),
  component: ClientProjectDetailPage,
});

function ClientProjectDetailPage() {
  const { id } = Route.useParams();
  const user = getStoredUser<User>();
  const clientId = getUserClientId(user);

  const { data: project, isLoading } = useQuery({
    queryKey: ["client-project-detail", id],
    queryFn: () => getProject(id),
    enabled: Boolean(clientId),
  });

  if (!clientId) {
    return (
      <AppShell>
        <ClientScopeNotice />
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando projeto...</div>
      </AppShell>
    );
  }

  if (!project || (project.client && project.client !== clientId)) {
    return (
      <AppShell>
        <ClientScopeNotice
          title="Projeto não disponível"
          description="Esse projeto não está vinculado à sua conta no portal."
          actionHref="/client/projects"
          actionLabel="Voltar para projetos"
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[
            { label: "Portal", to: "/client" },
            { label: "Projetos", to: "/client/projects" },
            { label: project.name },
          ]}
          title={project.name}
          subtitle={`${project.status || "Planejado"} · entrega ${formatDate(project.due_at)}`}
          badges={
            <span className="rounded-md bg-primary/15 px-2 py-1 text-[11px] text-primary">
              {project.progress ?? 0}% concluido
            </span>
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat icon={FolderKanban} label="Status" value={project.status || "Planejado"} />
          <Stat icon={TriangleAlert} label="Risco" value={`${Math.max(0, 100 - Number(project.progress ?? 0))}%`} />
          <Stat icon={FolderKanban} label="Orçamento" value={formatCurrency(project.budget)} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="glass rounded-2xl p-5 shadow-card">
              <h3 className="mb-2 text-sm font-semibold">Resumo</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {project.description || "Sem descrição cadastrada para este projeto."}
              </p>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Progresso geral</span>
                  <span>{project.progress ?? 0}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-primary"
                    style={{ width: `${project.progress ?? 0}%` }}
                  />
                </div>
              </div>
            </div>

          </div>

          <aside className="space-y-4">
            <div className="glass rounded-2xl p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold">Detalhes</h3>
              <dl className="space-y-2 text-sm">
                {[
                  ["Responsavel", project.owner_name || "-"],
                  ["Inicio", formatDate(project.start_at)],
                  ["Entrega", formatDate(project.due_at)],
                  ["Custo realizado", formatCurrency(project.real_cost)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
