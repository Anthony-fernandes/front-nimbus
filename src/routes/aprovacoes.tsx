import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, ClipboardCheck, Clock, MessageSquareWarning, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatPriorityLabel } from "@/lib/labels";
import { getTicketPriorityClass } from "@/lib/tickets";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  approveTicket,
  rejectTicket,
  requestTicketChanges,
} from "@/services/ticketApprovalService";
import { listTickets } from "@/services/ticketService";

export const Route = createFileRoute("/aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovações · Stratos Suite" }] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const approvalsQuery = useQuery({
    queryKey: ["tickets", "pending-approval"],
    queryFn: () => listTickets({ approval_status: "Aguardando Aprovacao", ordering: "-created_at" }),
  });

  const historyApprovedQuery = useQuery({
    queryKey: ["tickets", "approval-history", "approved"],
    queryFn: () => listTickets({ approval_status: "Aprovado", ordering: "-updated_at" }),
    enabled: activeTab === "history",
  });
  const historyRejectedQuery = useQuery({
    queryKey: ["tickets", "approval-history", "reprovado"],
    queryFn: () => listTickets({ approval_status: "Reprovado", ordering: "-updated_at" }),
    enabled: activeTab === "history",
  });

  const tickets = approvalsQuery.data ?? [];
  const historyTickets = [
    ...(historyApprovedQuery.data ?? []),
    ...(historyRejectedQuery.data ?? []),
  ].sort((a, b) => new Date(b.updated_at ?? "").getTime() - new Date(a.updated_at ?? "").getTime());

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["tickets", "pending-approval"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
  }

  return (
    <AppShell>
      <div className="max-w-4xl space-y-5">
        <PageHeader
          title="Aprovações de chamados"
          subtitle="Chamados que aguardam a sua decisão como aprovador."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <ClipboardCheck className="h-4 w-4" />
            </span>
          }
        />

        {/* Tab navigation */}
        <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "pending" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            Pendentes
            {tickets.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary font-semibold">
                {tickets.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Histórico
          </button>
        </div>

        {activeTab === "history" ? (
          <div className="glass divide-y divide-border rounded-2xl shadow-card">
            {(historyApprovedQuery.isLoading || historyRejectedQuery.isLoading) ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : historyTickets.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum histórico encontrado.</div>
            ) : historyTickets.map((t) => {
              const statusIcon = t.approval_status === "Aprovado"
                ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                : t.approval_status === "Reprovado"
                  ? <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  : <Clock className="h-4 w-4 text-warning shrink-0" />;
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  {statusIcon}
                  <Link
                    to="/tickets/$id"
                    params={{ id: t.id }}
                    className="flex-1 text-sm font-medium hover:text-primary transition-colors"
                  >
                    {t.title}
                  </Link>
                  <span className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    t.approval_status === "Aprovado"
                      ? "bg-success/15 text-success"
                      : t.approval_status === "Reprovado"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-warning/15 text-warning",
                  )}>
                    {t.approval_status}
                  </span>
                  {t.approved_by_name && (
                    <span className="text-xs text-muted-foreground shrink-0">por {t.approved_by_name}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {activeTab === "pending" && approvalsQuery.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Carregando aprovações...
          </div>
        ) : tickets.length === 0 ? (
          <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum chamado aguardando a sua aprovação.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <ApprovalCard key={ticket.id} ticket={ticket} onDecided={invalidate} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ApprovalCard({ ticket, onDecided }: { ticket: Ticket; onDecided: () => void }) {
  const [comment, setComment] = useState("");

  const decisionMutation = useMutation({
    mutationFn: ({ decision }: { decision: "approve" | "reject" | "changes" }) => {
      if (decision === "approve") return approveTicket(ticket.id, comment);
      if (decision === "reject") return rejectTicket(ticket.id, comment);
      return requestTicketChanges(ticket.id, comment);
    },
    onSuccess: (_data, variables) => {
      const label =
        variables.decision === "approve"
          ? "aprovado"
          : variables.decision === "reject"
            ? "reprovado"
            : "devolvido para ajustes";
      toast.success(`Chamado ${ticket.code || ""} ${label}.`);
      setComment("");
      onDecided();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
    },
  });

  const pending = decisionMutation.isPending;

  return (
    <div className="glass space-y-3 rounded-2xl p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{ticket.code}</span>
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                getTicketPriorityClass(ticket.priority),
              )}
            >
              {formatPriorityLabel(ticket.priority || "Media")}
            </span>
          </div>
          <Link
            to="/tickets/$id"
            params={{ id: ticket.id }}
            className="mt-1 block text-sm font-semibold hover:text-primary"
          >
            {ticket.title}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {ticket.organization_name || ticket.client_name || "Sem organização"} ·{" "}
            {ticket.requester_user_name || ticket.requester || "Sem solicitante"}
          </p>
          {ticket.approval_reason ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Rota: {ticket.approval_reason}
            </p>
          ) : null}
        </div>
      </div>

      {ticket.description ? (
        <p className="line-clamp-3 rounded-xl border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
          {ticket.description}
        </p>
      ) : null}

      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Comentário da decisão (opcional, obrigatório recomendado para reprovações/ajustes)"
        className="min-h-[72px] text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          disabled={pending}
          onClick={() => decisionMutation.mutate({ decision: "approve" })}
        >
          <Check className="h-3.5 w-3.5" /> Aprovar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={pending}
          onClick={() => decisionMutation.mutate({ decision: "changes" })}
        >
          <MessageSquareWarning className="h-3.5 w-3.5" /> Solicitar ajustes
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() => decisionMutation.mutate({ decision: "reject" })}
        >
          <X className="h-3.5 w-3.5" /> Reprovar
        </Button>
      </div>
    </div>
  );
}
