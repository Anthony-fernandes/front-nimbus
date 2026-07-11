import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, RotateCcw, Send, Ticket } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ClientScopeNotice } from "@/components/client/ClientScopeNotice";
import { TicketStatusTimeline } from "@/components/tickets/TicketStatusTimeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TicketTimelineEvent } from "@/lib/types";
import { buildTicketTimeline, getTicketPriorityClass, getTicketStatusClass } from "@/lib/tickets";
import type { User } from "@/lib/types";
import { getUserClientId } from "@/lib/auth";
import { getStoredUser } from "@/services/authService";
import { createTicketTimelineComment, listTicketTimeline } from "@/services/ticketTimelineService";
import { getTicket, transitionTicket } from "@/services/ticketService";
import { formatDate, formatDateTime , parseApiError} from "@/services/utils";

export const Route = createFileRoute("/client/tickets/$id")({
  head: () => ({ meta: [{ title: "Detalhes do chamado · NimbusDesk" }] }),
  component: ClientTicketDetailPage,
});

function ClientTicketDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const user = getStoredUser<User>();
  const clientId = getUserClientId(user);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["client-ticket-detail", id],
    queryFn: () => getTicket(id),
    enabled: Boolean(clientId),
  });
  const { data: timelineEvents = [] } = useQuery({
    queryKey: ["client-ticket-timeline", id],
    queryFn: () => listTicketTimeline(id),
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
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando chamado...</div>
      </AppShell>
    );
  }

  if (!ticket || (ticket.client && ticket.client !== clientId)) {
    return (
      <AppShell>
        <ClientScopeNotice
          title="Chamado não disponível"
          description="Esse chamado não está vinculado à sua conta no portal."
          actionHref="/client/tickets"
          actionLabel="Voltar para chamados"
        />
      </AppShell>
    );
  }

  const timeline = buildTicketTimeline(
    {
      ...ticket,
      timeline: [...(ticket.timeline || []), ...timelineEvents],
    },
    {},
  ).filter((event) => event.visibility !== "internal");

  const handleTransition = async (nextStatus: string, internalNotes: string) => {
    try {
      await transitionTicket(id, { status: nextStatus, internalNotes });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client-ticket-detail", id] }),
        queryClient.invalidateQueries({ queryKey: ["client-ticket-timeline", id] }),
        queryClient.invalidateQueries({ queryKey: ["client-tickets-list", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client-portal-tickets", clientId] }),
      ]);
      toast.success("Chamado atualizado.");
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível atualizar o chamado."));
    }
  };

  const publishComment = async ({
    message,
    visibility,
  }: {
    message: string;
    visibility: "internal" | "client";
  }) => {
    try {
      await createTicketTimelineComment({ ticket: id, message, visibility });
      await queryClient.invalidateQueries({ queryKey: ["client-ticket-timeline", id] });
      toast.success("Mensagem enviada para a equipe.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "A API atual ainda não suporta comentários independentes.",
      );
    }
  };

  const canValidate = ticket.status === "Validacao / Avaliacao";

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[
            { label: "Portal", to: "/client" },
            { label: "Chamados", to: "/client/tickets" },
            { label: ticket.code || id.slice(0, 8) },
          ]}
          title={ticket.title}
          subtitle={`${ticket.category_name || ticket.category || "Sem categoria"} · aberto em ${formatDate(ticket.opened_at)}`}
          badges={
            <span className="flex items-center gap-2">
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getTicketPriorityClass(ticket.priority)}`}
              >
                {ticket.priority || "Pendente"}
              </span>
              <span className={`rounded-md px-2 py-1 text-[11px] ${getTicketStatusClass(ticket.status)}`}>
                {ticket.status || "Aberto"}
              </span>
            </span>
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat icon={Ticket} label="Código" value={ticket.code || id.slice(0, 8)} />
          <Stat icon={Clock} label="Prazo" value={formatDate(ticket.due_at)} />
          <Stat icon={Clock} label="Atualizado em" value={formatDate(ticket.updated_at)} />
        </div>

        {canValidate && (
          <div className="glass rounded-2xl p-5 shadow-card space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Validação da solução</h3>
              <p className="text-xs text-muted-foreground">
                A equipe marcou o chamado como pronto para avaliação. Você pode aprovar ou devolver.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  handleTransition("Finalizado", "Cliente aprovou a solução no portal.")
                }
              >
                Aprovar solução
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  handleTransition("Em atendimento", "Cliente devolveu o chamado para novo atendimento.")
                }
              >
                Devolver para atendimento
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="glass rounded-2xl p-5 shadow-card space-y-4">
              <header className="space-y-1">
                <h3 className="text-sm font-semibold">Dados da solicitação</h3>
                <p className="text-xs text-muted-foreground">
                  Informações publicadas para acompanhamento do cliente.
                </p>
              </header>
              <dl className="grid gap-3 sm:grid-cols-2">
                <DataRow label="Tipo" value={ticket.type || "Solicitação"} />
                <DataRow label="Urgência informada" value={ticket.urgency || "Média"} />
                <DataRow label="Status" value={ticket.status || "Aberto"} />
                <DataRow label="Atualizado em" value={formatDateTime(ticket.updated_at)} />
              </dl>
              <div className="rounded-xl border border-border bg-muted/15 p-4 text-sm leading-relaxed">
                {ticket.description || "Sem descrição cadastrada."}
              </div>
            </section>

            {(ticket.resolution_description || ticket.status === "Finalizado") && (
              <section className="glass rounded-2xl p-5 shadow-card space-y-2">
                <header className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <h3 className="text-sm font-semibold">Resolução do chamado</h3>
                </header>
                <p className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm leading-relaxed">
                  {ticket.resolution_description || "A equipe finalizou o chamado, mas não registrou uma descrição de resolução."}
                </p>
                {ticket.finished_at && (
                  <p className="text-xs text-muted-foreground">Finalizado em {formatDateTime(ticket.finished_at)}</p>
                )}
              </section>
            )}

            <HistoryTable events={timeline} />

            <ClientChat onSend={(message) => publishComment({ message, visibility: "client" })} />
          </div>

          <aside className="space-y-4">
            <TicketStatusTimeline ticket={ticket} />

            <section className="glass rounded-2xl p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold">Detalhes</h3>
              <div className="space-y-2 text-sm">
                <DataRow label="Solicitante" value={ticket.requester || "-"} />
                <DataRow label="Categoria" value={ticket.category_name || ticket.category || "-"} />
                <DataRow label="SLA" value={ticket.sla || "8h"} />
                <DataRow label="Aberto em" value={formatDateTime(ticket.opened_at || ticket.created_at)} />
                <DataRow label="Finalizado em" value={formatDateTime(ticket.finished_at)} />
              </div>
            </section>

            {ticket.status === "Finalizado" && (
              <section className="glass rounded-2xl p-5 shadow-card">
                <h3 className="mb-3 text-sm font-semibold">Reabertura operacional</h3>
                <p className="text-sm text-muted-foreground">
                  Chamados finalizados não reabrem automaticamente. Se precisar de nova ação,
                  devolva pela avaliação quando disponível ou abra um novo chamado.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 gap-1.5"
                  asChild
                >
                  <a href="/client/tickets/new">
                    <RotateCcw className="h-4 w-4" />
                    Abrir novo chamado
                  </a>
                </Button>
              </section>
            )}
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

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/10 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{value || "-"}</dd>
    </div>
  );
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  created: "Abertura",
  status: "Status",
  comment: "Mensagem",
  response: "Resposta",
  system: "Sistema",
};

function eventKindLabel(type?: string) {
  const key = (type || "").toLowerCase();
  return EVENT_TYPE_LABEL[key] || (type ? type : "Evento");
}

function HistoryTable({ events }: { events: TicketTimelineEvent[] }) {
  const rows = [...events].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  );

  return (
    <section className="glass overflow-hidden rounded-2xl shadow-card">
      <header className="border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold">Histórico e conversa</h3>
        <p className="text-xs text-muted-foreground">Todas as interações públicas deste chamado.</p>
      </header>
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          Ainda não há histórico publicado para este chamado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Autor</th>
                <th className="px-4 py-2.5">Data/Hora</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Mensagem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((event) => (
                <tr key={event.id} className="align-top transition-colors hover:bg-muted/20">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">{event.author_name || "Sistema"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {event.created_at ? formatDateTime(event.created_at) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {eventKindLabel(event.type)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 leading-relaxed">{event.message || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ClientChat({ onSend }: { onSend: (message: string) => Promise<void> | void }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      await onSend(text);
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-5 shadow-card space-y-3">
      <h3 className="text-sm font-semibold">Fale com a equipe</h3>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escreva uma mensagem para a equipe de atendimento..."
        className="min-h-24"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void send();
          }
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Ctrl/⌘ + Enter para enviar</span>
        <Button type="button" onClick={() => void send()} disabled={sending || !message.trim()} className="gap-1.5">
          <Send className="h-4 w-4" />
          {sending ? "Enviando..." : "Enviar mensagem"}
        </Button>
      </div>
    </section>
  );
}
