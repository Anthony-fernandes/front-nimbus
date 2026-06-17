import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Ticket } from "@/lib/types";

const MAIN_STEPS = [
  "Aberto",
  "Triagem / Categorizacao",
  "Em atendimento",
  "Validacao / Avaliacao",
  "Finalizado",
] as const;

const APPROVAL_STEPS = [
  "Aberto",
  "Aguardando aprovacao",
  "Aprovado",
  "Triagem / Categorizacao",
  "Em atendimento",
  "Validacao / Avaliacao",
  "Finalizado",
] as const;

const CANCELLED_STATUSES = ["Cancelado", "Reprovado"];

function stepIndex(steps: readonly string[], status: string | undefined): number {
  if (!status) return 0;
  const idx = steps.indexOf(status);
  if (idx !== -1) return idx;
  // Map similar statuses to closest step
  if (status === "Aguardando cliente") return steps.indexOf("Em atendimento");
  if (status === "Pausado") return steps.indexOf("Em atendimento");
  return -1;
}

export function TicketStatusTimeline({ ticket }: { ticket: Ticket }) {
  const isCancelled = CANCELLED_STATUSES.includes(ticket.status || "");
  const needsApproval = ticket.approval_required || ticket.approval?.status === "pending" || ticket.approval?.status === "approved";
  const steps = needsApproval ? APPROVAL_STEPS : MAIN_STEPS;

  const currentStatus = ticket.status || "Aberto";
  const isFinished = currentStatus === "Finalizado";
  const currentIdx = stepIndex(steps, currentStatus);

  return (
    <div className="glass rounded-2xl p-5 shadow-card space-y-1">
      <p className="text-sm font-semibold mb-3">Acompanhamento</p>
      <div className="space-y-0">
        {steps.map((step, i) => {
          const isCurrent = !isCancelled && currentStatus === step;
          // A step is completed if ticket passed through it (index is before current)
          const isCompleted = !isCancelled && (
            isFinished
              ? true
              : currentIdx > i
          );
          const isPending = !isCompleted && !isCurrent;

          return (
            <div key={step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs",
                    isCompleted && "border-success bg-success text-success-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary",
                    isPending && "border-border bg-background text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn("w-0.5 flex-1 my-0.5", isCompleted ? "bg-success" : "bg-border")}
                    style={{ minHeight: 20 }}
                  />
                )}
              </div>
              <div className="pb-4 pt-0.5">
                <p
                  className={cn(
                    "text-sm",
                    isCurrent
                      ? "font-semibold text-foreground"
                      : isPending
                        ? "text-muted-foreground"
                        : "text-foreground",
                  )}
                >
                  {step}
                </p>
                {step === "Aberto" && ticket.created_at && (
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleString("pt-BR")}
                  </p>
                )}
                {step === "Finalizado" && ticket.finished_at && (
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(ticket.finished_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {isCancelled && (
          <div className="flex gap-3 mt-1">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-destructive bg-destructive/10 text-destructive">
              <span className="text-xs font-bold">×</span>
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-semibold text-destructive">{currentStatus}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
