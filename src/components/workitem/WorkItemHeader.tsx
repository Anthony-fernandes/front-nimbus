import { Clock, Flag, MoreHorizontal, Pause, Play, RotateCcw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  WORK_ITEM_TYPE_LABELS,
  isWorkItemFinished,
  workItemStatuses,
  type WorkItem,
} from "@/lib/workItem";
import { formatPriorityLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

function slaState(item: WorkItem): "breached" | "warning" | null {
  if (!item.slaDueAt || isWorkItemFinished(item)) return null;
  const due = new Date(item.slaDueAt).getTime();
  if (due < Date.now()) return "breached";
  if (due < Date.now() + 60 * 60 * 1000) return "warning";
  return null;
}

export function WorkItemHeader({
  item,
  onStart,
  onPause,
  onSendToValidation,
  onGoToResolution,
  onRequestReopen,
  onChangeStatus,
}: {
  item: WorkItem;
  onStart: () => void;
  onPause: () => void;
  onSendToValidation: () => void;
  onGoToResolution: () => void;
  onRequestReopen: () => void;
  onChangeStatus: (status: string) => void;
}) {
  const finished = isWorkItemFinished(item);
  const sla = slaState(item);
  const inProgress = ["Em atendimento", "Em progresso", "Em andamento"].includes(item.status);
  const validationStatus = item.backend === "ticket" ? "Validacao" : "Em revisao";

  return (
    <div className="space-y-2.5 border-b border-border bg-background/95 px-5 pb-3 pt-4 backdrop-blur">
      {/* Código + título */}
      <div className="flex items-start justify-between gap-3 pr-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
              #{item.code}
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {WORK_ITEM_TYPE_LABELS[item.ref.type]}
            </span>
          </div>
          <h2 className="mt-1 truncate text-base font-semibold leading-snug" title={item.title}>
            {item.title}
          </h2>
        </div>
      </div>

      {/* Badges de contexto */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn(
          "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
          finished ? "bg-success/15 text-success" : "bg-info/15 text-info",
        )}>
          {item.status}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-medium text-warning">
          <Flag className="h-3 w-3" /> {formatPriorityLabel(item.priority)}
        </span>
        {sla === "breached" && (
          <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
            <Clock className="h-3 w-3" /> SLA estourado
          </span>
        )}
        {sla === "warning" && (
          <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-semibold text-warning">
            <Clock className="h-3 w-3" /> SLA em risco
          </span>
        )}
        {item.sprintName && (
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] text-accent">{item.sprintName}</span>
        )}
        {item.projectName && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{item.projectName}</span>
        )}
        {item.responsibleName && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
            {item.responsibleName}
          </span>
        )}
      </div>

      {/* Ações rápidas */}
      <div className="flex flex-wrap items-center gap-1.5">
        {finished ? (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onRequestReopen}>
            <RotateCcw className="h-3.5 w-3.5" /> Reabrir
          </Button>
        ) : (
          <>
            {!inProgress && (
              <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onStart}>
                <Play className="h-3.5 w-3.5" /> Iniciar atendimento
              </Button>
            )}
            {inProgress && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onPause}>
                <Pause className="h-3.5 w-3.5" /> Pausar
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onSendToValidation}>
              <Send className="h-3.5 w-3.5" /> Enviar p/ validação
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-success/40 text-xs text-success hover:bg-success/10 hover:text-success"
              onClick={onGoToResolution}
            >
              ✓ Finalizar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {workItemStatuses(item)
                  .filter((s) => s !== item.status)
                  .map((status) => (
                    <DropdownMenuItem key={status} onClick={() => onChangeStatus(status)}>
                      Mover para: {status === validationStatus ? `${status} (revisão)` : status}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
