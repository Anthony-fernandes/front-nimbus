import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Calendar, Clock, ExternalLink, Flag, FolderKanban, Tag, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TicketTimeline } from "@/components/tickets/TicketTimeline";
import { formatHoursLabel } from "@/lib/activityFlow";
import { formatActivityStatusLabel, formatPriorityLabel } from "@/lib/labels";
import type { TicketVisibility } from "@/lib/types";
import { getActivity } from "@/services/activityService";
import { createActivityTimelineComment, listActivityTimeline } from "@/services/activityTimelineService";
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

export function ActivityDetailDialog({
  activityId,
  open,
  onOpenChange,
}: {
  activityId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const activityQuery = useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => getActivity(activityId!),
    enabled: open && Boolean(activityId),
  });

  const timelineQuery = useQuery({
    queryKey: ["activity-timeline", activityId],
    queryFn: () => listActivityTimeline(activityId!),
    enabled: open && Boolean(activityId),
  });

  const activity = activityQuery.data;

  const publishComment = async (payload: { message: string; visibility: TicketVisibility }) => {
    if (!activity) return;
    await createActivityTimelineComment({
      activity: activity.id,
      message: payload.message,
      visibility: payload.visibility,
    });
    await queryClient.invalidateQueries({ queryKey: ["activity-timeline", activityId] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {activityQuery.isLoading || !activity ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando atividade...</div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
                <DialogTitle className="text-base">{activity.title}</DialogTitle>
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link to="/activities/$id" params={{ id: activity.id }}>
                    <ExternalLink className="h-3.5 w-3.5" /> Tela completa
                  </Link>
                </Button>
              </div>
            </DialogHeader>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-info/15 px-2.5 py-1 text-xs font-medium text-info">
                {formatActivityStatusLabel(activity.status || "Backlog")}
              </span>
              {activity.priority ? (
                <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
                  <Flag className="mr-1 inline h-3 w-3" />
                  {formatPriorityLabel(activity.priority)}
                </span>
              ) : null}
              {activity.story_points ? (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {activity.story_points} SP
                </span>
              ) : null}
            </div>

            {/* Grid de informações */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <InfoItem label="Projeto" value={activity.project_name} icon={FolderKanban} />
              <InfoItem label="Sprint" value={activity.sprint_name} icon={Calendar} />
              <InfoItem label="Responsável" value={activity.assignee_name} icon={UserIcon} />
              <InfoItem label="Tipo" value={activity.type} icon={Tag} />
              <InfoItem
                label="Estimativa"
                value={activity.est_hours ? formatHoursLabel(Number(activity.est_hours)) : undefined}
                icon={Clock}
              />
              <InfoItem
                label="Prazo"
                value={activity.due_at ? formatDateTime(activity.due_at) : undefined}
                icon={Calendar}
              />
            </div>

            {/* Descrição */}
            {activity.description ? (
              <div className="rounded-xl border border-border bg-muted/10 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Descrição</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{activity.description}</p>
              </div>
            ) : null}

            {/* Checklist resumido */}
            {activity.checklist && activity.checklist.length > 0 ? (
              <div className="rounded-xl border border-border bg-muted/10 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Checklist ({activity.checklist.filter((c) => c.done).length}/{activity.checklist.length})
                </p>
                <ul className="mt-1 space-y-1">
                  {activity.checklist.map((item, i) => (
                    <li key={i} className={`text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}>
                      {item.done ? "☑" : "☐"} {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Conversa */}
            <TicketTimeline
              events={timelineQuery.data ?? []}
              title="Conversa"
              allowComposer
              composerLabel="Comentar"
              submitHelpText="O comentário entra na timeline da atividade."
              onCommentSubmit={publishComment}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
