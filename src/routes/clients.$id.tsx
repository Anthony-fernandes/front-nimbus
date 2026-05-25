import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Mail, Phone, Building2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClient, deleteClient } from "@/services/clientService";
import { listTickets } from "@/services/ticketService";
import { listProjects } from "@/services/projectService";
import { formatCurrency, formatDate } from "@/services/utils";

export const Route = createFileRoute("/clients/$id")({
  head: () => ({ meta: [{ title: "Detalhes do cliente · Stratos Suite" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const clientQuery = useQuery({ queryKey: ["client", id], queryFn: () => getClient(id) });
  const ticketsQuery = useQuery({ queryKey: ["client-tickets", id], queryFn: () => listTickets({ client: id }) });
  const projectsQuery = useQuery({ queryKey: ["client-projects", id], queryFn: () => listProjects({ client: id }) });

  const client = clientQuery.data;
  const tickets = ticketsQuery.data || [];
  const projects = projectsQuery.data || [];

  if (pathname !== `/clients/${id}`) {
    return <Outlet />;
  }

  if (clientQuery.isLoading) {
    return <AppShell><div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando cliente...</div></AppShell>;
  }

  if (!client) {
    return <AppShell><div className="glass rounded-2xl p-6 text-sm text-destructive">Cliente não encontrado.</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-5 max-w-7xl">
        <PageHeader
          crumbs={[{ label: "Clientes", to: "/clients" }, { label: client.name }]}
          title={<span className="flex items-center gap-3"><span className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center text-sm font-semibold text-primary-foreground">{client.name.split(" ").map((segment) => segment[0]).slice(0, 2).join("")}</span>{client.name}</span>}
          subtitle={`${client.sector || "Sem setor"} · Plano ${client.plan || "Pro"}`}
          badges={<span className="text-[11px] px-2 py-1 rounded bg-success/15 text-success">{client.status || "Ativo"}</span>}
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
                  toast.success("Cliente excluído");
                  navigate({ to: "/clients" });
                }}
              />
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Chamados" value={String(tickets.length)} />
          <Stat label="Projetos" value={String(projects.length)} />
          <Stat label="MRR" value={formatCurrency(client.mrr)} />
          <Stat label="Criado em" value={formatDate(client.created_at)} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Tabs defaultValue="tickets" className="space-y-4">
              <TabsList className="bg-muted/40 border border-border">
                <TabsTrigger value="tickets">Chamados</TabsTrigger>
                <TabsTrigger value="projects">Projetos</TabsTrigger>
                <TabsTrigger value="summary">Resumo</TabsTrigger>
              </TabsList>
              <TabsContent value="tickets" className="space-y-2">
                {tickets.length === 0 && <EmptyPanel text="Nenhum chamado vinculado a este cliente." />}
                {tickets.map((ticket) => (
                  <Link key={ticket.id} to="/tickets/$id" params={{ id: ticket.id }} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border hover:border-primary/40 transition">
                    <span className="font-mono text-xs text-muted-foreground">{ticket.code || ticket.id.slice(0, 8)}</span>
                    <span className="text-sm flex-1 mx-3">{ticket.title}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-primary/15 text-primary">{ticket.status || "Triagem"}</span>
                  </Link>
                ))}
              </TabsContent>
              <TabsContent value="projects" className="space-y-2">
                {projects.length === 0 && <EmptyPanel text="Nenhum projeto vinculado a este cliente." />}
                {projects.map((project) => (
                  <Link key={project.id} to="/projects/$id" params={{ id: project.id }} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border hover:border-primary/40 transition">
                    <span className="text-sm">{project.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-primary/15 text-primary">{project.status || "Planejado"}</span>
                  </Link>
                ))}
              </TabsContent>
              <TabsContent value="summary">
                <div className="glass rounded-2xl p-5 shadow-card space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Observações</h3>
                    <p className="text-sm text-muted-foreground">{client.notes || "Nenhuma observação cadastrada."}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Contato principal</h3>
                    <p className="text-sm text-muted-foreground">{client.contact_name || "Não informado."}</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <aside className="space-y-4">
            <div className="glass rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-semibold mb-3">Contato</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {client.email || "Não informado"}</li>
                <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {client.phone || "Não informado"}</li>
                <li className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> {client.contact_name || "Sem contato principal"}</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="glass rounded-2xl p-5 shadow-card text-sm text-muted-foreground">{text}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="glass rounded-xl p-4"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="text-xl font-semibold mt-1">{value}</div></div>;
}
