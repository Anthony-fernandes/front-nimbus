import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ClipboardCheck,
  History,
  MessageSquareWarning,
  Workflow,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canApproveTickets } from "@/lib/permissions";
import type { Ticket, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { listProjects } from "@/services/projectService";
import { listSprints } from "@/services/sprintService";
import {
  approveTicket,
  convertTicketToActivity,
  listTicketApprovals,
  rejectTicket,
  requestTicketChanges,
} from "@/services/ticketApprovalService";

const APPROVAL_BADGE: Record<string, string> = {
  "Aguardando Aprovacao": "bg-warning/15 text-warning",
  Aprovado: "bg-success/15 text-success",
  Reprovado: "bg-destructive/15 text-destructive",
  "Ajustes Solicitados": "bg-info/15 text-info",
  "Nao requerido": "bg-muted text-muted-foreground",
};

const DECISION_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  AJUSTES: "Ajustes solicitados",
};

function canDecide(ticket: Ticket, user: User | null) {
  const awaiting =
    ticket.approval_status === "Aguardando Aprovacao" ||
    ticket.approval_status === "Ajustes Solicitados";
  if (!awaiting) return false;
  if (user && ticket.current_approver && ticket.current_approver === user.id) return true;
  if (ticket.approval_route === "SERVICE_DESK" && Boolean(user?.is_service_desk_approver)) return true;
  return canApproveTickets(user);
}

export function TicketApprovalPanel({
  ticket,
  currentUser,
  onChanged,
}: {
  ticket: Ticket;
  currentUser: User | null;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const approvalStatus = ticket.approval_status || "Nao requerido";
  const showDecision = canDecide(ticket, currentUser);
  const canConvert =
    !ticket.converted_activity &&
    ticket.status !== "Convertido em Atividade de Projeto" &&
    canApproveTickets(currentUser);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["ticket", ticket.id] });
    void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    onChanged?.();
  }

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
      toast.success(`Chamado ${label}.`);
      setComment("");
      refresh();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a decisão."),
  });

  if (approvalStatus === "Nao requerido" && !ticket.converted_activity) {
    // Sem aprovação exigida e não convertido: nada a mostrar aqui.
    return null;
  }

  return (
    <div className="glass space-y-4 rounded-2xl p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
            <ClipboardCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Aprovação</p>
            <p className="text-[11px] text-muted-foreground">
              {ticket.approval_reason || "Fluxo de aprovação do chamado."}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-medium",
            APPROVAL_BADGE[approvalStatus] || APPROVAL_BADGE["Nao requerido"],
          )}
        >
          {approvalStatus}
        </span>
      </div>

      {ticket.converted_activity ? (
        <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          {ticket.conversion_reason || "Chamado convertido em atividade de projeto."}
        </div>
      ) : null}

      {showDecision ? (
        <div className="space-y-3">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Comentário da decisão (opcional)"
            className="min-h-[64px] text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={decisionMutation.isPending}
              onClick={() => decisionMutation.mutate({ decision: "approve" })}
            >
              <Check className="h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={decisionMutation.isPending}
              onClick={() => decisionMutation.mutate({ decision: "changes" })}
            >
              <MessageSquareWarning className="h-3.5 w-3.5" /> Solicitar ajustes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              disabled={decisionMutation.isPending}
              onClick={() => decisionMutation.mutate({ decision: "reject" })}
            >
              <X className="h-3.5 w-3.5" /> Reprovar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-muted-foreground"
          onClick={() => setHistoryOpen(true)}
        >
          <History className="h-3.5 w-3.5" /> Histórico de aprovação
        </Button>
        {canConvert ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setConvertOpen(true)}
          >
            <Workflow className="h-3.5 w-3.5" /> Converter em atividade
          </Button>
        ) : null}
      </div>

      <ApprovalHistoryDialog
        ticketId={ticket.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <ConvertDialog
        ticket={ticket}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={refresh}
      />
    </div>
  );
}

function ApprovalHistoryDialog({
  ticketId,
  open,
  onOpenChange,
}: {
  ticketId: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const historyQuery = useQuery({
    queryKey: ["ticket-approvals", ticketId],
    queryFn: () => listTicketApprovals(ticketId),
    enabled: open,
  });

  const entries = historyQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Histórico de aprovação</DialogTitle>
          <DialogDescription>Todas as decisões registradas para este chamado.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {historyQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma decisão registrada.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border bg-muted/10 px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {DECISION_LABEL[entry.decision || "PENDENTE"] || entry.decision}
                  </span>
                  <span className="text-muted-foreground">
                    {entry.decided_at
                      ? new Date(entry.decided_at).toLocaleString("pt-BR")
                      : "Pendente"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {entry.approver_name || "Equipe de chamados"}
                  {entry.comment ? ` · ${entry.comment}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({
  ticket,
  open,
  onOpenChange,
  onConverted,
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onConverted: () => void;
}) {
  const [projectId, setProjectId] = useState<string>(ticket.project || "");
  const [sprintId, setSprintId] = useState<string>("");

  const projectsQuery = useQuery({
    queryKey: ["projects", "convert"],
    queryFn: () => listProjects(),
    enabled: open,
  });
  const sprintsQuery = useQuery({
    queryKey: ["sprints", "convert"],
    queryFn: () => listSprints(),
    enabled: open,
  });

  const sprints = useMemo(() => {
    const all = sprintsQuery.data ?? [];
    if (!projectId) return all;
    return all.filter((sprint) => !sprint.project || sprint.project === projectId);
  }, [sprintsQuery.data, projectId]);

  const convertMutation = useMutation({
    mutationFn: () =>
      convertTicketToActivity(ticket.id, {
        project: projectId || null,
        sprint: sprintId || null,
      }),
    onSuccess: () => {
      toast.success("Chamado convertido em atividade de projeto.");
      onOpenChange(false);
      onConverted();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível converter o chamado."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Converter em atividade de projeto</DialogTitle>
          <DialogDescription>
            Comentários, anexos e horas serão transferidos. O chamado será encerrado como
            "Convertido em Atividade de Projeto".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {(projectsQuery.data ?? []).map((project) =>
                  project ? (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ) : null,
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sprint (opcional)</label>
            <Select value={sprintId} onValueChange={setSprintId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem sprint" />
              </SelectTrigger>
              <SelectContent>
                {sprints.map((sprint) => (
                  <SelectItem key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={convertMutation.isPending}
            onClick={() => convertMutation.mutate()}
          >
            Converter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
