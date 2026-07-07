import { useState } from "react";
import { CheckCircle2, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  isWorkItemFinished,
  workItemResolutionTypes,
  type WorkItem,
  type WorkItemTimeLog,
} from "@/lib/workItem";
import { formatDateTime } from "@/services/utils";
import { WorkItemFinishDialog } from "./WorkItemDialogs";

export function WorkItemResolution({
  item,
  timeLogs,
  resolving,
  openSubTickets = 0,
  onResolve,
  onRequestReopen,
}: {
  item: WorkItem;
  timeLogs: WorkItemTimeLog[];
  resolving: boolean;
  /** Subchamados ainda abertos bloqueiam a finalização. */
  openSubTickets?: number;
  onResolve: (payload: {
    resolutionType: string;
    resolutionNotes: string;
    messageToRequester?: string;
    sendToRequester?: boolean;
  }) => Promise<void>;
  onRequestReopen: () => void;
}) {
  const finished = isWorkItemFinished(item);
  const types = workItemResolutionTypes(item);
  const hasRequester = item.backend === "ticket";

  const [resolutionType, setResolutionType] = useState(types[0]);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [messageToRequester, setMessageToRequester] = useState("");
  const [sendToRequester, setSendToRequester] = useState(hasRequester);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const totalHours = timeLogs.reduce((sum, log) => sum + log.hours, 0);
  const pendingRequired = item.subtasks.filter((s) => s.required && !s.done);
  const started = ["Em atendimento", "Em progresso", "Em andamento", "Validacao", "Em revisao", "Aguardando cliente", "Pausado", "Bloqueado"].includes(item.status);
  const blocked = !started || pendingRequired.length > 0 || openSubTickets > 0;

  // ── Item já finalizado: resolução imutável + opção de reabrir ──
  if (finished) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-success/30 bg-success/[0.06] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" />
            Item finalizado{item.resolvedAt ? ` em ${formatDateTime(item.resolvedAt)}` : ""}
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo de conclusão</p>
              <p className="font-medium">{item.resolutionType || item.status}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Resolução aplicada</p>
              <p className="whitespace-pre-wrap leading-relaxed">
                {item.resolutionNotes || "Sem registro de resolução (item finalizado antes do fluxo atual)."}
              </p>
            </div>
            {item.resolvedByName ? (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Finalizado por</p>
                <p className="font-medium">{item.resolvedByName}</p>
              </div>
            ) : null}
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tempo gasto total</p>
              <p className="font-medium">{totalHours.toFixed(2).replace(/\.00$/, "")}h</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> A resolução registrada não pode ser editada. Para retomar o trabalho, reabra o item.
          </p>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={onRequestReopen}>
          <RotateCcw className="h-4 w-4" /> Reabrir item
        </Button>
      </div>
    );
  }

  // ── Formulário de finalização ──
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Finalizar com resolução documentada
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Todo item precisa registrar o que foi feito antes de ser concluído.
        </p>

        {!started && (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            ⚠ Inicie o atendimento antes de finalizar este item.
          </div>
        )}
        {pendingRequired.length > 0 && (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            ⚠ Subtarefas obrigatórias pendentes: {pendingRequired.map((s) => s.text).join(", ")}.
            Conclua-as acima antes de finalizar.
          </div>
        )}
        {openSubTickets > 0 && (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            ⚠ {openSubTickets} subchamado(s) ainda aberto(s). Encerre-os antes de finalizar o chamado principal.
          </div>
        )}

        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Tipo de conclusão *</label>
            <select
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value)}
              className="h-9 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm"
            >
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Resolução aplicada *</label>
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder="Descreva objetivamente o que foi feito, a causa identificada e a solução aplicada."
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Tempo gasto registrado: <span className="font-semibold text-foreground">{totalHours.toFixed(2).replace(/\.00$/, "")}h</span>
            {totalHours === 0 && <span>· aponte o tempo na aba Execução</span>}
          </div>

          {hasRequester && (
            <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={sendToRequester}
                  onChange={(e) => setSendToRequester(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Enviar mensagem final ao solicitante
              </label>
              {sendToRequester && (
                <Textarea
                  value={messageToRequester}
                  onChange={(e) => setMessageToRequester(e.target.value)}
                  rows={2}
                  placeholder="Mensagem que o solicitante vai receber junto da finalização."
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          className="gap-1.5 bg-success text-white hover:bg-success/90"
          disabled={resolving || !resolutionNotes.trim() || blocked}
          onClick={() => setConfirmOpen(true)}
        >
          <CheckCircle2 className="h-4 w-4" /> Finalizar item
        </Button>
      </div>

      <WorkItemFinishDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        resolutionType={resolutionType}
        saving={resolving}
        onConfirm={() => {
          void (async () => {
            try {
              await onResolve({
                resolutionType,
                resolutionNotes: resolutionNotes.trim(),
                messageToRequester: messageToRequester.trim(),
                sendToRequester,
              });
              setConfirmOpen(false);
            } catch (error) {
              const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
              toast.error(detail || "Não foi possível finalizar o item.");
            }
          })();
        }}
      />
    </div>
  );
}
