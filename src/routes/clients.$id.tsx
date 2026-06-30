import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Mail, Pencil, Phone } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteClient, getClient } from "@/services/clientService";
import { listProjects } from "@/services/projectService";
import { listTickets } from "@/services/ticketService";
import { formatCurrency, formatDate } from "@/services/utils";

export const Route = createFileRoute("/clients/$id")({
  head: () => ({ meta: [{ title: "Detalhes da organização · Stratos Suite" }] }),
  component: OrganizationDetail,
});

function OrganizationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const clientQuery = useQuery({ queryKey: ["client", id], queryFn: () => getClient(id) });
  const ticketsQuery = useQuery({
    queryKey: ["client-tickets", id],
    queryFn: () => listTickets({ client: id }),
  });
  const projectsQuery = useQuery({
    queryKey: ["client-projects", id],
    queryFn: () => listProjects({ client: id }),
  });

  const organization = clientQuery.data;
  const tickets = ticketsQuery.data || [];
  const projects = projectsQuery.data || [];

  if (pathname !== `/clients/${id}`) {
    return <Outlet />;
  }

  if (clientQuery.isLoading) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
          Carregando organização...
        </div>
      </AppShell>
    );
  }

  if (!organization) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-destructive">
          Organização não encontrada.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Organizações", to: "/clients" }, { label: organization.name }]}
          title={
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground">
                {organization.name
                  .split(" ")
                  .map((segment) => segment[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              {organization.name}
            </span>
          }
          subtitle={`${organization.sector || "Sem setor"} · ${organization.organization_type || organization.type || "Organização"}`}
          badges={
            <span className="rounded bg-success/15 px-2 py-1 text-[11px] text-success">
              {organization.status || "Ativo"}
            </span>
          }
          actions={
            <>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to="/clients/$id/edit" params={{ id }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Link>
              </Button>
              <ConfirmDelete
                onConfirm={async () => {
                  await deleteClient(id);
                  toast.success("Organização excluída");
                  navigate({ to: "/clients" });
                }}
              />
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Chamados" value={String(tickets.length)} />
          <Stat label="Projetos" value={String(projects.length)} />
          <Stat label="MRR" value={formatCurrency(organization.mrr)} />
          <Stat label="Criado em" value={formatDate(organization.created_at)} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs defaultValue="tickets" className="space-y-4">
              <TabsList className="border border-border bg-muted/40">
                <TabsTrigger value="tickets">Chamados</TabsTrigger>
                <TabsTrigger value="projects">Projetos</TabsTrigger>
                <TabsTrigger value="summary">Resumo</TabsTrigger>
              </TabsList>
              <TabsContent value="tickets" className="space-y-2">
                {tickets.length === 0 ? (
                  <EmptyPanel text="Nenhum chamado vinculado a esta organização." />
                ) : (
                  tickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      to="/tickets/$id"
                      params={{ id: ticket.id }}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3 transition hover:border-primary/40"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {ticket.code || ticket.id.slice(0, 8)}
                      </span>
                      <span className="mx-3 flex-1 text-sm">{ticket.title}</span>
                      <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                        {ticket.status || "Triagem"}
                      </span>
                    </Link>
                  ))
                )}
              </TabsContent>
              <TabsContent value="projects" className="space-y-2">
                {projects.length === 0 ? (
                  <EmptyPanel text="Nenhum projeto vinculado a esta organização." />
                ) : (
                  projects.filter(Boolean).map((project) => (
                    <Link
                      key={project!.id}
                      to="/projects/$id"
                      params={{ id: project!.id }}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3 transition hover:border-primary/40"
                    >
                      <span className="text-sm">{project!.name}</span>
                      <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                        {project!.status || "Planejado"}
                      </span>
                    </Link>
                  ))
                )}
              </TabsContent>
              <TabsContent value="summary">
                <div className="glass space-y-3 rounded-2xl p-5 shadow-card">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Observações</h3>
                    <p className="text-sm text-muted-foreground">
                      {organization.notes || "Nenhuma observação cadastrada."}
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Contato principal</h3>
                    <p className="text-sm text-muted-foreground">
                      {organization.contact_name || "Não informado."}
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Documento</h3>
                    <p className="text-sm text-muted-foreground">
                      {organization.document || "Não informado."}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <div className="glass rounded-2xl p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold">Contato</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> {organization.email || "Não informado"}
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" /> {organization.phone || "Não informado"}
                </li>
                <li className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />{" "}
                  {organization.contact_name || "Sem contato principal"}
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="glass rounded-2xl p-5 text-sm text-muted-foreground shadow-card">{text}</div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
