import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isWorkItemFinished, type WorkItemNoteType, type WorkItemRef, type WorkItemSubtask } from "@/lib/workItem";
import {
  createWorkItemComment,
  getWorkItem,
  listWorkItemComments,
  listWorkItemHistory,
  listWorkItemTimeLogs,
  logWorkItemTime,
  reopenWorkItem,
  resolveWorkItem,
  updateWorkItemResponsible,
  updateWorkItemStatus,
  updateWorkItemSubtasks,
} from "@/services/workItemService";
import { parseApiError } from "@/services/utils";

import { WorkItemHeader } from "./WorkItemHeader";
import { WorkItemConversation } from "./WorkItemConversation";
import { WorkItemDescription } from "./WorkItemDescription";
import { WorkItemExecution } from "./WorkItemExecution";
import { WorkItemResolution } from "./WorkItemResolution";
import { WorkItemHistoryTimeline } from "./WorkItemHistoryTimeline";
import { WorkItemContextPanel } from "./WorkItemContextPanel";
import { WorkItemBlockDialog, WorkItemReopenDialog } from "./WorkItemDialogs";

export function WorkItemModal({
  workRef,
  open,
  onOpenChange,
  /** Abre direto na aba de resolução (ex.: drag para Concluído no kanban). */
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
  const [tab, setTab] = useState(initialTab || "conversa");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    if (open) setTab(initialTab || "conversa");
  }, [open, initialTab, workRef?.id]);

  const enabled = open && Boolean(workRef);
  const keyBase = workRef ? [workRef.type, workRef.id] : ["none"];

  const itemQuery = useQuery({
    queryKey: ["work-item", ...keyBase],
    queryFn: () => getWorkItem(workRef!),
    enabled,
  });
  const commentsQuery = useQuery({
    queryKey: ["work-item-comments", ...keyBase],
    queryFn: () => listWorkItemComments(workRef!),
    enabled,
  });
  const timeLogsQuery = useQuery({
    queryKey: ["work-item-time", ...keyBase],
    queryFn: () => listWorkItemTimeLogs(workRef!),
    enabled,
  });
  const historyQuery = useQuery({
    queryKey: ["work-item-history", ...keyBase],
    queryFn: () => listWorkItemHistory(workRef!),
    enabled: enabled && tab === "historico",
  });

  const item = itemQuery.data;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["work-item", ...keyBase] }),
      queryClient.invalidateQueries({ queryKey: ["work-item-comments", ...keyBase] }),
      queryClient.invalidateQueries({ queryKey: ["work-item-time", ...keyBase] }),
      queryClient.invalidateQueries({ queryKey: ["work-item-history", ...keyBase] }),
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
    runMutation(() => updateWorkItemStatus(workRef!, status, reason), message || `Status alterado para ${status}.`);

  const startStatus = item?.backend === "ticket" ? "Em atendimento" : "Em progresso";
  const validationStatus = item?.backend === "ticket" ? "Validacao" : "Em revisao";
  const pauseStatus = item?.backend === "ticket" ? "Pausado" : "Bloqueado";

  const sendComment = async (payload: { body: string; noteType: WorkItemNoteType }) => {
    await createWorkItemComment(workRef!, payload);
    await refresh();
  };

  const saveSubtasks = async (subtasks: WorkItemSubtask[]) => {
    await updateWorkItemSubtasks(workRef!, subtasks);
    await refresh();
  };

  const logTime = async (payload: { date: string; hours: number; description: string }) => {
    await logWorkItemTime(workRef!, {
      ...payload,
      sprintId: item?.sprintId,
      projectId: item?.projectId,
    });
    await refresh();
  };

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
            {/* Header fixo */}
            <WorkItemHeader
              item={item}
              onStart={() => void changeStatus(startStatus, undefined, "Atendimento iniciado.")}
              onPause={() => setPauseOpen(true)}
              onSendToValidation={() => void changeStatus(validationStatus, undefined, "Enviado para validação.")}
              onGoToResolution={() => setTab("resolucao")}
              onRequestReopen={() => setReopenOpen(true)}
              onChangeStatus={(status) => {
                if (["Pausado", "Bloqueado", "Cancelado"].includes(status)) {
                  setPauseOpen(true);
                  return;
                }
                void changeStatus(status);
              }}
            />

            {/* Corpo: abas + painel lateral */}
            <div className="flex min-h-0 flex-1">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex min-h-0 flex-1 flex-col">
                  <TabsList className="mx-5 mt-3 w-fit shrink-0 border border-border bg-muted/40">
                    <TabsTrigger value="conversa">Conversa</TabsTrigger>
                    <TabsTrigger value="descricao">Descrição</TabsTrigger>
                    <TabsTrigger value="execucao">Execução</TabsTrigger>
                    <TabsTrigger value="resolucao" className={isWorkItemFinished(item) ? "text-success" : ""}>
                      Resolução
                    </TabsTrigger>
                    <TabsTrigger value="historico">Histórico</TabsTrigger>
                  </TabsList>

                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <TabsContent value="conversa" className="m-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
                      <WorkItemConversation
                        comments={commentsQuery.data ?? []}
                        loading={commentsQuery.isLoading}
                        hasRequester={item.backend === "ticket"}
                        onSend={sendComment}
                      />
                    </TabsContent>
                    <TabsContent value="descricao" className="m-0">
                      <WorkItemDescription item={item} />
                    </TabsContent>
                    <TabsContent value="execucao" className="m-0">
                      <WorkItemExecution
                        item={item}
                        timeLogs={timeLogsQuery.data ?? []}
                        timeLogsLoading={timeLogsQuery.isLoading}
                        onSaveSubtasks={saveSubtasks}
                        onLogTime={logTime}
                      />
                    </TabsContent>
                    <TabsContent value="resolucao" className="m-0">
                      <WorkItemResolution
                        item={item}
                        timeLogs={timeLogsQuery.data ?? []}
                        resolving={mutating}
                        onResolve={(payload) =>
                          runMutation(() => resolveWorkItem(workRef!, payload), "Item finalizado com resolução registrada.")
                        }
                        onRequestReopen={() => setReopenOpen(true)}
                      />
                    </TabsContent>
                    <TabsContent value="historico" className="m-0">
                      <WorkItemHistoryTimeline
                        events={historyQuery.data ?? []}
                        loading={historyQuery.isLoading}
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>

              {/* Painel lateral de contexto (colapsa em telas menores) */}
              <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-border bg-muted/[0.04] px-3 py-4 lg:block">
                <WorkItemContextPanel
                  item={item}
                  onChangeResponsible={(userId) =>
                    void runMutation(
                      () => updateWorkItemResponsible(workRef!, userId),
                      "Responsável atualizado.",
                    )
                  }
                />
              </aside>
            </div>
          </>
        )}

        {/* Diálogos de fluxo */}
        <WorkItemReopenDialog
          open={reopenOpen}
          onOpenChange={setReopenOpen}
          saving={mutating}
          onConfirm={(reason) => {
            void runMutation(() => reopenWorkItem(workRef!, reason), "Item reaberto.").then(() => {
              setReopenOpen(false);
              setTab("conversa");
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
      </DialogContent>
    </Dialog>
  );
}
