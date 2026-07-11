import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isSubTicketFinished,
  isWorkItemFinished,
  type WorkItemNoteType,
  type WorkItemRef,
  type WorkItemSubtask,
} from "@/lib/workItem";
import {
  createWorkItemComment,
  getWorkItem,
  getWorkItemAvailableActions,
  linkWorkItemSubTicket,
  listWorkItemComments,
  listWorkItemHistory,
  listWorkItemSubTickets,
  listWorkItemTimeLogs,
  logWorkItemTime,
  reopenWorkItem,
  resolveWorkItem,
  updateWorkItemResponsible,
  updateWorkItemDueAt,
  updateWorkItemStatus,
  updateWorkItemSubtasks,
} from "@/services/workItemService";
import { parseApiError } from "@/services/utils";
import { TicketForm } from "@/components/forms/TicketForm";
import type { Ticket } from "@/lib/types";

import { WorkItemHeader } from "./WorkItemHeader";
import { WorkItemConversation } from "./WorkItemConversation";
import { WorkItemDescription } from "./WorkItemDescription";
import { WorkItemExecution } from "./WorkItemExecution";
import { WorkItemResolution } from "./WorkItemResolution";
import { WorkItemHistoryTimeline } from "./WorkItemHistoryTimeline";
import { WorkItemContextPanel } from "./WorkItemContextPanel";
import { WorkItemBlockDialog, WorkItemReopenDialog } from "./WorkItemDialogs";
import { TicketWorkflowDialog } from "@/components/tickets/TicketWorkflowDialog";
import { useTicketWorkflow } from "@/hooks/useTicketWorkflow";
import { getTicketWorkflowActionLabel, type TicketWorkflowActionId } from "@/lib/ticketWorkflow";

type TabId = "descricao" | "conversa" | "notas" | "internos" | "execucao" | "historico";

// Ações de comentário não entram no histórico — ele guarda só eventos automáticos.
const HISTORY_EXCLUDED_ACTIONS = ["comment"];

// Ações específicas de chamado que o header genérico NÃO cobre (triagem/aprovação/
// categorização/aguardar cliente). O header já trata iniciar/pausar/finalizar/reabrir.
const TICKET_EXTRA_ACTIONS = new Set<TicketWorkflowActionId>([
  "categorize",
  "approve",
  "reject",
  "wait_customer",
]);

export function WorkItemModal({
  workRef,
  open,
  onOpenChange,
  /** "resolucao" (legado, ex.: drag p/ Concluído) abre a Execução, onde a resolução vive. */
  initialTab,
  /** Chamado após qualquer mutação para o chamador invalidar suas listas. */
  onChanged,
}: {
  workRef: WorkItemRef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "conversa" | "descricao" | "execucao" | "resolucao" | "historico";
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const resolvedInitialTab: TabId = initialTab === "resolucao" ? "execucao" : (initialTab as TabId) || "descricao";
  const [tab, setTab] = useState<TabId>(resolvedInitialTab);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  // Navegação para dentro de um subchamado sem fechar o popup
  const [innerRef, setInnerRef] = useState<WorkItemRef | null>(null);
  // Popup de criação de subchamado (formulário completo de chamado)
  const [subTicketFormOpen, setSubTicketFormOpen] = useState(false);
  const [subTicketBlocksParent, setSubTicketBlocksParent] = useState(true);

  useEffect(() => {
    if (open) {
      setTab(resolvedInitialTab);
      setInnerRef(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab, workRef?.id]);

  const effRef = innerRef ?? workRef;
  const enabled = open && Boolean(effRef);
  const keyBase = effRef ? [effRef.type, effRef.id] : ["none"];

  const itemQuery = useQuery({
    queryKey: ["work-item", ...keyBase],
    queryFn: () => getWorkItem(effRef!),
    enabled,
  });
  const commentsQuery = useQuery({
    queryKey: ["work-item-comments", ...keyBase],
    queryFn: () => listWorkItemComments(effRef!),
    enabled,
  });
  const timeLogsQuery = useQuery({
    queryKey: ["work-item-time", ...keyBase],
    queryFn: () => listWorkItemTimeLogs(effRef!),
    enabled,
  });
  const subTicketsQuery = useQuery({
    queryKey: ["work-item-subtickets", ...keyBase],
    queryFn: () => listWorkItemSubTickets(effRef!),
    enabled: enabled && effRef?.type === "ticket",
  });
  const availableActionsQuery = useQuery({
    queryKey: ["work-item-actions", ...keyBase],
    queryFn: () => getWorkItemAvailableActions(effRef!),
    enabled,
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: ["work-item-history", ...keyBase],
    queryFn: () => listWorkItemHistory(effRef!),
    enabled: enabled && tab === "historico",
  });

  const item = itemQuery.data;
  const comments = commentsQuery.data ?? [];
  const subTickets = subTicketsQuery.data ?? [];

  // Fluxo de chamado (mesma orquestração da tela de Chamados). Surge as ações
  // específicas de chamado que o header genérico não cobre (triagem/aprovação/
  // categorização/aguardar cliente), reusando o TicketWorkflowDialog.
  const ticketWorkflow = useTicketWorkflow();
  const ticketRaw = item?.backend === "ticket" ? (item.raw as Ticket) : null;
  const ticketExtraActions = ticketRaw
    ? ticketWorkflow.availableActions(ticketRaw).filter((a) => TICKET_EXTRA_ACTIONS.has(a.id))
    : [];
  // Só subchamados marcados como bloqueantes impedem a finalização do pai.
  const openSubTickets = subTickets.filter((s) => s.blocksParent && !isSubTicketFinished(s)).length;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["work-item", ...keyBase] }),
      queryClient.invalidateQueries({ queryKey: ["work-item-comments", ...keyBase] }),
      queryClient.invalidateQueries({ queryKey: ["work-item-time", ...keyBase] }),
      queryClient.invalidateQueries({ queryKey: ["work-item-subtickets", ...keyBase] }),
      queryClient.invalidateQueries({ queryKey: ["work-item-history", ...keyBase] }),
      queryClient.invalidateQueries({ queryKey: ["work-item-actions", ...keyBase] }),
    ]);
    onChanged?.();
  };

  const runMutation = async (fn: () => Promise<void>, successMessage?: string) => {
    setMutating(true);
    try {
      await fn();
      await refresh();
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível concluir a ação."));
      throw error;
    } finally {
      setMutating(false);
    }
  };

  const changeStatus = (status: string, reason?: string, message?: string) =>
    runMutation(() => updateWorkItemStatus(effRef!, status, reason), message || `Status alterado para ${status}.`);

  const startStatus = item?.backend === "ticket" ? "Em atendimento" : "Em progresso";
  const validationStatus = item?.backend === "ticket" ? "Validacao" : "Em revisao";
  const pauseStatus = item?.backend === "ticket" ? "Pausado" : "Bloqueado";

  const sendComment = async (payload: { body: string; noteType: WorkItemNoteType }) => {
    await createWorkItemComment(effRef!, payload);
    await refresh();
  };

  const saveSubtasks = async (subtasks: WorkItemSubtask[]) => {
    await updateWorkItemSubtasks(effRef!, subtasks);
    await refresh();
  };

  const logTime = async (payload: { date: string; hours: number; description: string }) => {
    await logWorkItemTime(effRef!, {
      ...payload,
      sprintId: item?.sprintId,
      projectId: item?.projectId,
    });
    await refresh();
  };

  const historyEvents = (historyQuery.data ?? []).filter(
    (e) => !HISTORY_EXCLUDED_ACTIONS.some((x) => e.action.includes(x)),
  );

  const conversationTitle = item?.backend === "ticket" ? "Conversa" : "Comentários";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Detalhe do item de trabalho</DialogTitle>

        {!item || itemQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Carregando item...
          </div>
        ) : (
          <>
            {/* Voltar do subchamado ao principal */}
            {innerRef && (
              <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-5 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-primary"
                  onClick={() => { setInnerRef(null); setTab("execucao"); }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao chamado principal
                </Button>
                <span className="text-[11px] text-muted-foreground">Você está em um subchamado</span>
              </div>
            )}

            {/* Aviso de status sem regras configuradas no workflow */}
            {availableActionsQuery.data && availableActionsQuery.data.configured === false && (
              <div className="border-b border-warning/30 bg-warning/10 px-5 py-2 text-xs text-warning">
                {availableActionsQuery.data.detail ||
                  `O status "${item.status}" não possui regras configuradas. Configure este status no workflow em Configurações para liberar as ações.`}
              </div>
            )}

            {/* Header fixo */}
            <WorkItemHeader
              item={item}
              serverActions={availableActionsQuery.data ?? null}
              onStart={() => void changeStatus(startStatus, undefined, "Atendimento iniciado.")}
              onPause={() => setPauseOpen(true)}
              onSendToValidation={() => void changeStatus(validationStatus, undefined, "Enviado para validação.")}
              onGoToResolution={() => setTab("execucao")}
              onRequestReopen={() => setReopenOpen(true)}
              onChangeStatus={(status) => {
                if (["Pausado", "Bloqueado", "Cancelado"].includes(status)) {
                  setPauseOpen(true);
                  return;
                }
                void changeStatus(status);
              }}
            />

            {/* Ações específicas de chamado (triagem/aprovação/categorização/aguardar
                cliente) — mesmas regras/formulários da tela de Chamados. */}
            {ticketRaw && ticketExtraActions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-5 pb-3">
                {ticketExtraActions.map((action) => (
                  <Button
                    key={action.id}
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    disabled={mutating || ticketWorkflow.saving}
                    onClick={() => ticketWorkflow.requestAction(ticketRaw, action.id)}
                  >
                    {getTicketWorkflowActionLabel(action.id)}
                  </Button>
                ))}
              </div>
            )}

            {/* Corpo: abas + painel lateral */}
            <div className="flex min-h-0 flex-1">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="flex min-h-0 flex-1 flex-col">
                  <TabsList className="mx-5 mt-3 w-fit shrink-0 border border-border bg-muted/40">
                    <TabsTrigger value="descricao">Descrição</TabsTrigger>
                    <TabsTrigger value="conversa">{conversationTitle}</TabsTrigger>
                    <TabsTrigger value="notas">Notas Técnicas</TabsTrigger>
                    <TabsTrigger value="internos">Comentários Internos</TabsTrigger>
                    <TabsTrigger value="execucao" className={isWorkItemFinished(item) ? "text-success" : ""}>
                      Execução
                    </TabsTrigger>
                    <TabsTrigger value="historico">Histórico</TabsTrigger>
                  </TabsList>

                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <TabsContent value="descricao" className="m-0">
                      <WorkItemDescription item={item} />
                    </TabsContent>

                    <TabsContent value="conversa" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                      <WorkItemConversation
                        comments={comments}
                        loading={commentsQuery.isLoading}
                        mode="public"
                        onSend={sendComment}
                      />
                    </TabsContent>

                    <TabsContent value="notas" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                      <WorkItemConversation
                        comments={comments}
                        loading={commentsQuery.isLoading}
                        mode="technical"
                        onSend={sendComment}
                      />
                    </TabsContent>

                    <TabsContent value="internos" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                      <WorkItemConversation
                        comments={comments}
                        loading={commentsQuery.isLoading}
                        mode="internal"
                        onSend={sendComment}
                      />
                    </TabsContent>

                    <TabsContent value="execucao" className="m-0 space-y-4">
                      <WorkItemExecution
                        item={item}
                        timeLogs={timeLogsQuery.data ?? []}
                        timeLogsLoading={timeLogsQuery.isLoading}
                        subTickets={effRef?.type === "ticket" ? subTickets : undefined}
                        onSaveSubtasks={saveSubtasks}
                        onLogTime={logTime}
                        onOpenCreateSubTicket={
                          effRef?.type === "ticket"
                            ? () => { setSubTicketBlocksParent(true); setSubTicketFormOpen(true); }
                            : undefined
                        }
                        onOpenSubTicket={(ticketId) => {
                          setInnerRef({ type: "ticket", id: ticketId });
                          setTab("descricao");
                        }}
                      />

                      {/* Resolução no fim do fluxo de execução */}
                      <WorkItemResolution
                        item={item}
                        timeLogs={timeLogsQuery.data ?? []}
                        resolving={mutating}
                        openSubTickets={openSubTickets}
                        onResolve={(payload) =>
                          runMutation(() => resolveWorkItem(effRef!, payload), "Item finalizado com resolução registrada.")
                        }
                        onRequestReopen={() => setReopenOpen(true)}
                      />
                    </TabsContent>

                    <TabsContent value="historico" className="m-0">
                      <WorkItemHistoryTimeline
                        events={historyEvents}
                        loading={historyQuery.isLoading}
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>

              {/* Painel lateral de contexto */}
              <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-border bg-muted/[0.04] px-3 py-4 lg:block">
                <WorkItemContextPanel
                  item={item}
                  onChangeResponsible={(userId) =>
                    void runMutation(
                      () => updateWorkItemResponsible(effRef!, userId),
                      "Responsável atualizado.",
                    )
                  }
                  onChangeDueAt={
                    item.sprintId
                      ? (dueAt) =>
                          void runMutation(
                            () => updateWorkItemDueAt(effRef!, dueAt),
                            "Vencimento atualizado.",
                          )
                      : undefined
                  }
                />
              </aside>
            </div>
          </>
        )}

        {/* Criação de subchamado: formulário completo, já vinculado ao pai */}
        {item && (
          <Dialog open={subTicketFormOpen} onOpenChange={setSubTicketFormOpen}>
            <DialogContent className="max-h-[92vh] w-[96vw] max-w-6xl overflow-y-auto">
              <DialogTitle>
                Novo subchamado de <span className="font-mono text-primary">#{item.code}</span>
              </DialogTitle>
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={subTicketBlocksParent}
                  onChange={(e) => setSubTicketBlocksParent(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span>
                  O chamado atual só pode ser finalizado quando este subchamado for finalizado
                </span>
              </label>
              <TicketForm
                mode="create"
                initial={{
                  title: "",
                  description: `Subchamado de #${item.code} — ${item.title}`,
                }}
                onSaved={async (created) => {
                  await linkWorkItemSubTicket(effRef!, created.id, subTicketBlocksParent);
                  setSubTicketFormOpen(false);
                  await refresh();
                  toast.success("Subchamado criado e vinculado ao chamado principal.");
                }}
                onCancel={() => setSubTicketFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Diálogos de fluxo */}
        <WorkItemReopenDialog
          open={reopenOpen}
          onOpenChange={setReopenOpen}
          saving={mutating}
          onConfirm={(reason) => {
            void runMutation(() => reopenWorkItem(effRef!, reason), "Item reaberto.").then(() => {
              setReopenOpen(false);
              setTab("descricao");
            }).catch(() => undefined);
          }}
        />
        <WorkItemBlockDialog
          open={pauseOpen}
          onOpenChange={setPauseOpen}
          title={item?.backend === "ticket" ? "Pausar chamado" : "Bloquear atividade"}
          description="Informe o motivo — ele fica registrado no histórico do item."
          actionLabel={item?.backend === "ticket" ? "Pausar" : "Bloquear"}
          saving={mutating}
          onConfirm={(reason) => {
            void changeStatus(pauseStatus, reason, `${pauseStatus} com motivo registrado.`)
              .then(() => setPauseOpen(false))
              .catch(() => undefined);
          }}
        />

        {/* Formulários específicos de chamado (categorizar/aguardar cliente/aprovar/
            reprovar) — mesmos do fluxo da tela de Chamados. */}
        <TicketWorkflowDialog
          open={Boolean(ticketWorkflow.dialogState)}
          actionId={ticketWorkflow.dialogState?.actionId || null}
          ticket={ticketWorkflow.dialogState?.ticket || null}
          categories={ticketWorkflow.categories}
          users={ticketWorkflow.technicianUsers}
          saving={ticketWorkflow.saving}
          onOpenChange={(o) => { if (!o) ticketWorkflow.setDialogState(null); }}
          onSubmit={async (formData) => {
            if (!ticketWorkflow.dialogState) return;
            await ticketWorkflow.runAction(
              ticketWorkflow.dialogState.ticket,
              ticketWorkflow.dialogState.actionId,
              formData,
            );
            onChanged?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
