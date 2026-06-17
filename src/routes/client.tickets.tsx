import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientScopeNotice } from "@/components/client/ClientScopeNotice";
import { formatTicketStatusLabel, formatUrgencyLabel } from "@/lib/labels";
import { hasPermission } from "@/lib/permissions";
import { getTicketStatusClass } from "@/lib/tickets";
import { getUserClientId } from "@/lib/auth";
import type { User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { listTickets } from "@/services/ticketService";
import { formatDate } from "@/services/utils";

export const Route = createFileRoute("/client/tickets")({
  head: () => ({ meta: [{ title: "Chamados do cliente · Stratos Suite" }] }),
  component: ClientTicketsPage,
});

function ClientTicketsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const user = getStoredUser<User>();
  const clientId = getUserClientId(user);
  const canCreateTickets = hasPermission(user, "tickets.create");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["client-tickets-list", clientId],
    queryFn: () => listTickets({ client: clientId }),
    enabled: Boolean(clientId),
  });

  if (pathname !== "/client/tickets") {
    return <Outlet />;
  }

  if (!clientId) {
    return (
      <AppShell>
        <ClientScopeNotice />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          crumbs={[{ label: "Portal", to: "/client" }, { label: "Chamados" }]}
          title="Meus chamados"
          subtitle={isLoading ? "Carregando chamados..." : `${tickets.length} chamados da sua conta`}
          actions={
            canCreateTickets ? (
              <a
                href="/client/tickets/new"
                className="inline-flex h-9 items-center justify-center rounded-md bg-gradient-primary px-4 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Abrir chamado
              </a>
            ) : null
          }
        />

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <div className="grid grid-cols-12 gap-3 border-b border-border px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div className="col-span-2">Código</div>
            <div className="col-span-4">Título</div>
            <div className="col-span-2">Categoria</div>
            <div className="col-span-1">Urgência</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Prazo</div>
          </div>

          {tickets.length === 0 && !isLoading && (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Nenhum chamado encontrado para sua conta.
            </div>
          )}

          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to="/client/tickets/$id"
              params={{ id: ticket.id }}
              className="grid grid-cols-12 items-center gap-3 border-b border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/30 last:border-0"
            >
              <div className="col-span-2 font-mono text-xs text-muted-foreground">
                {ticket.code || ticket.id.slice(0, 8)}
              </div>
              <div className="col-span-4 truncate font-medium">{ticket.title}</div>
              <div className="col-span-2 truncate text-muted-foreground">
                {ticket.category_name || ticket.category || "Sem categoria"}
              </div>
              <div className="col-span-1 text-xs">{formatUrgencyLabel(ticket.urgency || "Media")}</div>
              <div className="col-span-2">
                <span className={`rounded-md px-2 py-1 text-[11px] ${getTicketStatusClass(ticket.status)}`}>
                  {formatTicketStatusLabel(ticket.status || "Aberto")}
                </span>
              </div>
              <div className="col-span-1 text-right text-xs text-muted-foreground">
                {formatDate(ticket.due_at)}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
