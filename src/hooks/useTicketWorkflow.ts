import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Ticket, User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { listUsers } from "@/services/userService";
import { listTicketCategories } from "@/services/ticketCategoryService";
import { listTicketWorkflowStatuses } from "@/services/ticketWorkflowService";
import { transitionTicket } from "@/services/ticketService";
import { parseApiError } from "@/services/utils";
import { isClientUser } from "@/lib/auth";
import {
  canApproveTickets,
  canCategorizeTickets,
  canFinalizeTickets,
  hasPermission,
} from "@/lib/permissions";
import {
  canTransitionTicket,
  getAvailableTicketActions,
  prepareTicketWorkflowAction,
  type TicketWorkflowActionId,
} from "@/lib/ticketWorkflow";
import type { TicketWorkflowDialogSubmitData } from "@/components/tickets/TicketWorkflowDialog";

// Ações que exigem formulário (motivo/resolução/categoria/mensagem) → abrem diálogo.
const MODAL_ACTIONS = new Set<TicketWorkflowActionId>([
  "categorize",
  "pause",
  "wait_customer",
  "finish",
  "cancel",
]);

/**
 * Orquestração ÚNICA do workflow de chamado (ações, transições, submit).
 * Fonte central reutilizada pela tela de Chamados e pelo WorkItemModal, para
 * que responder/mover/finalizar um chamado seja idêntico em qualquer tela.
 */
export function useTicketWorkflow() {
  const queryClient = useQueryClient();
  const currentUser = getStoredUser<User>();

  const { data: users = [] } = useQuery({ queryKey: ["workflow-users"], queryFn: () => listUsers() });
  const { data: categories = [] } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: () => listTicketCategories(),
  });
  const { data: statusConfigs = [] } = useQuery({
    queryKey: ["ticket-workflow-status-configs"],
    queryFn: () => listTicketWorkflowStatuses(),
  });

  const technicianUsers = users.filter((u) => !isClientUser(u));
  const workflowPermissions = {
    canApprove: canApproveTickets(currentUser),
    canCategorize: canCategorizeTickets(currentUser),
    canFinalize: canFinalizeTickets(currentUser),
    canEdit: hasPermission(currentUser, "tickets.edit"),
  };

  const [dialogState, setDialogState] = useState<{
    ticket: Ticket;
    actionId: TicketWorkflowActionId;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const availableActions = (ticket: Ticket) =>
    getAvailableTicketActions(ticket, statusConfigs, workflowPermissions);

  const runAction = async (
    ticket: Ticket,
    actionId: TicketWorkflowActionId,
    formData?: TicketWorkflowDialogSubmitData,
  ) => {
    const targetStatus = availableActions(ticket).find((a) => a.id === actionId)?.targetStatus;
    if (!targetStatus) return;
    if (!canTransitionTicket(ticket, targetStatus, statusConfigs)) {
      toast.error("Essa transição não é permitida para o status atual do chamado.");
      return;
    }
    const prepared = prepareTicketWorkflowAction({
      ticket,
      actionId,
      input: formData,
      statusConfigs,
      categories,
      users: technicianUsers,
      currentUser,
    });
    try {
      setSaving(true);
      await transitionTicket(ticket.id, prepared.transitionPayload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["ticket", ticket.id] }),
        queryClient.invalidateQueries({ queryKey: ["ticket-timeline", ticket.id] }),
        // Atualiza o WorkItemModal (item, ações e histórico) quando aberto.
        queryClient.invalidateQueries({ queryKey: ["work-item"] }),
        queryClient.invalidateQueries({ queryKey: ["work-item-actions"] }),
        queryClient.invalidateQueries({ queryKey: ["work-item-history"] }),
      ]);
      toast.success(prepared.successMessage);
      setDialogState(null);
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível atualizar o chamado."));
    } finally {
      setSaving(false);
    }
  };

  // Decide entre abrir diálogo (ações que exigem campos) ou executar direto.
  const requestAction = (ticket: Ticket, actionId: TicketWorkflowActionId) => {
    const def = availableActions(ticket).find((a) => a.id === actionId);
    if (!def) {
      toast.error("Essa ação não está disponível para o status atual.");
      return;
    }
    if (MODAL_ACTIONS.has(actionId)) {
      setDialogState({ ticket, actionId });
      return;
    }
    void runAction(ticket, actionId);
  };

  return {
    currentUser,
    technicianUsers,
    categories,
    statusConfigs,
    workflowPermissions,
    availableActions,
    runAction,
    requestAction,
    dialogState,
    setDialogState,
    saving,
  };
}
