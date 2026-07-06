import { History } from "lucide-react";

import type { WorkItemHistoryEvent } from "@/lib/workItem";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/services/utils";

function dotColor(action: string) {
  if (action.includes("resolved") || action.includes("closed")) return "bg-success";
  if (action.includes("reopened")) return "bg-warning";
  if (action.includes("deleted")) return "bg-destructive";
  if (action === "status_change" || action.includes("status")) return "bg-info";
  if (action.includes("time")) return "bg-accent";
  if (action.includes("comment")) return "bg-primary";
  return "bg-muted-foreground/50";
}

export function WorkItemHistoryTimeline({
  events,
  loading,
}: {
  events: WorkItemHistoryEvent[];
  loading?: boolean;
}) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando histórico...</p>;
  }
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <History className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
      </div>
    );
  }
  return (
    <ol className="relative space-y-0 pl-1">
      {events.map((event, i) => (
        <li key={event.id} className="relative flex gap-3 pb-4">
          {/* Linha vertical */}
          {i < events.length - 1 && (
            <span className="absolute left-[5px] top-4 h-full w-px bg-border" aria-hidden />
          )}
          <span className={cn("relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background", dotColor(event.action))} />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">
              <span className="font-medium">{event.actorName}</span>{" "}
              <span className="text-muted-foreground">{event.description}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(event.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
