import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, Clock, Ticket } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientScopeNotice } from "@/components/client/ClientScopeNotice";
import { StatCard } from "@/components/dashboard/StatCard";
import { getUserClientId, getUserClientName } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getTicketStatusClass } from "@/lib/tickets";
import type { User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { getClient } from "@/services/clientService";
import { listTickets } from "@/services/ticketService";
import { formatDate } from "@/services/utils";

export const Route = createFileRoute("/client")({
  head: () => ({ meta: [{ title: "Portal do cliente · NimbusDesk" }] }),
  component: ClientPortalPage,
});

function ClientPortalPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const user = getStoredUser<User>();
  const clientId = getUserClientId(user);
  const clientName = getUserClientName(user) || "Sua conta";
  const canCreateTickets = hasPermission(user, "tickets.create");

  const { data: account } = useQuery({
    queryKey: ["client-portal-account", clientId],
    queryFn: () => getClient(clientId!),
    enabled: Boolean(clientId),
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["client-portal-tickets", clientId],
    queryFn: () => listTickets({ client: clientId }),
    enabled: Boolean(clientId),
  });

  if (pathname !== "/client") {
    return <Outlet />;
  }

  if (!clientId) {
    return (
      <AppShell>
        <ClientScopeNotice />
      </AppShell>
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const totalTickets = tickets.length;
  const openTickets = tickets.filter((t) => t.status !== "Finalizado" && t.status !== "Cancelado" && t.status !== "Reprovado").length;
  const awaitingResponseTickets = tickets.filter(
    (t) => t.status === "Aguardando cliente" || t.status === "Validacao / Avaliacao",
  ).length;
  const resolvedThisMonth = tickets.filter(
    (t) =>
      t.status === "Finalizado" &&
      t.finished_at != null &&
      t.finished_at >= startOfMonth,
  ).length;
  const recentTickets = tickets.slice(0, 5);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          crumbs={[{ label: "Portal do cliente" }]}
          title="Acompanhamento da sua conta"
          subtitle={account ? `${account.name} · ${account.sector || "Operacao em andamento"}` : clientName}
          actions={
            canCreateTickets ? (
              <a
                href="/client/tickets/new"
                className="inline-flex h-9 items-center justify-center rounded-md bg-gradient-primary px-4 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                Abrir chamado
              </a>
            ) : null
          }
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total de chamados" value={String(totalTickets)} icon={Ticket} accent="accent" />
          <StatCard label="Chamados abertos" value={String(openTickets)} icon={Ticket} accent="primary" />
          <StatCard label="Aguardando sua resposta" value={String(awaitingResponseTickets)} icon={Clock} accent="warning" />
          <StatCard
            label="Resolvidos este mes"
            value={String(resolvedThisMonth)}
            icon={CheckCircle2}
            accent="success"
          />
        </div>

        <div className="glass rounded-2xl p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Ultimos chamados</h3>
                <p className="text-xs text-muted-foreground">Atualizações mais recentes da sua conta</p>
              </div>
              <Link
                to="/client/tickets"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2">
              {recentTickets.length === 0 && (
                <div className="rounded-xl border border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                  Nenhum chamado aberto ainda.
                </div>
              )}
              {recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to="/client/tickets/$id"
                  params={{ id: ticket.id }}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {ticket.code || ticket.id.slice(0, 8)}
                    </div>
                    <div className="truncate text-sm font-medium">{ticket.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {ticket.category_name || ticket.category || "Sem categoria"} · prazo {formatDate(ticket.due_at)}
                    </div>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[11px] ${getTicketStatusClass(ticket.status)}`}>
                    {ticket.status || "Aberto"}
                  </span>
                </Link>
              ))}
            </div>
        </div>
      </div>
    </AppShell>
  );
}
