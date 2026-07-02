import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock, ExternalLink, Flag, Tag, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TicketTimeline } from "@/components/tickets/TicketTimeline";
import { formatPriorityLabel, formatTicketStatusLabel } from "@/lib/labels";
import type { TicketVisibility } from "@/lib/types";
import { getTicket } from "@/services/ticketService";
import { createTicketTimelineComment, listTicketTimeline } from "@/services/ticketTimelineService";
import { formatDateTime } from "@/services/utils";

function InfoItem({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: typeof Tag }) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium" title={value || undefined}>
        {value || "—"}
      </div>
    </div>
  );
}

export function TicketDetailDialog({
  ticketId,
  open,
  onOpenChange,
}: {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const ticketQuery = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicket(ticketId!),
    enabled: open && Boolean(ticketId),
  });

  const timelineQuery = useQuery({
    queryKey: ["ticket-timeline", ticketId],
    queryFn: () => listTicketTimeline(ticketId!),
    enabled: open && Boolean(ticketId),
  });

  const ticket = ticketQuery.data;

  const publishComment = async (payload: { message: string; visibility: TicketVisibility }) => {
    if (!ticket) return;
    await createTicketTimelineComment({
      ticket: ticket.id,
      message: payload.message,
      visibility: payload.visibility,
    });
    await queryClient.invalidateQueries({ queryKey: ["ticket-timeline", ticketId] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {ticketQuery.isLoading || !ticket ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando chamado...</div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
                <DialogTitle className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                    {ticket.code}
                  </span>
                  <span className="text-base">{ticket.title}</span>
                </DialogTitle>
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link to="/tickets/$id" params={{ id: ticket.id }}>
                    <ExternalLink className="h-3.5 w-3.5" /> Tela completa
                  </Link>
                </Button>
              </div>
            </DialogHeader>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-info/15 px-2.5 py-1 text-xs font-medium text-info">
                {formatTicketStatusLabel(ticket.status || "")}
              </span>
              <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
                <Flag className="mr-1 inline h-3 w-3" />
                {formatPriorityLabel(ticket.priority)}
              </span>
              {ticket.sla_due_at ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Clock className="mr-1 inline h-3 w-3" />
                  SLA: {formatDateTime(ticket.sla_due_at)}
                </span>
              ) : null}
            </div>

            {/* Grid de informações */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <InfoItem label="Cliente" value={ticket.client_name || ticket.organization_name} icon={UserIcon} />
              <InfoItem label="Solicitante" value={ticket.requester_name || ticket.requester_user_name} icon={UserIcon} />
              <InfoItem label="Técnico" value={ticket.responsible_technician_name} icon={UserIcon} />
              <InfoItem label="Categoria" value={ticket.category_name || ticket.category} icon={Tag} />
              <InfoItem label="Tipo" value={ticket.type} icon={Tag} />
              <InfoItem label="Aberto em" value={ticket.created_at ? formatDateTime(ticket.created_at) : undefined} icon={Clock} />
            </div>

            {/* Descrição */}
            {ticket.description ? (
              <div className="rounded-xl border border-border bg-muted/10 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Descrição</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
              </div>
            ) : null}

            {/* Conversa */}
            <TicketTimeline
              events={timelineQuery.data ?? []}
              title="Conversa"
              allowComposer
              composerLabel="Responder"
              submitHelpText="A resposta entra na timeline do chamado."
              onCommentSubmit={publishComment}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
