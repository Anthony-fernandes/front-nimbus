import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Home,
  ListFilter,
  MessageCircle,
  MoreHorizontal,
  Send,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Activity, Ticket, TicketTimelineEvent, TicketVisibility } from "@/lib/types";
import { getActivity, updateActivity } from "@/services/activityService";
import {
  createActivityTimelineComment,
  listActivityTimeline,
} from "@/services/activityTimelineService";
import { getTicket, updateTicket } from "@/services/ticketService";
import {
  createTicketTimelineComment,
  listTicketTimeline,
} from "@/services/ticketTimelineService";
import { formatDateTime } from "@/services/utils";

export type WorkItemUpdatesDialogItem = {
  type: "ticket" | "activity";
  id: string;
  code?: string;
  title?: string;
  status?: string;
  priority?: string;
  typeLabel?: string;
  description?: string;
  responsibleNames?: string[];
  plannedHours?: string | number;
  doneHours?: string | number;
  storyPoints?: string | number;
  sprintName?: string;
  plannedEndDate?: string;
  subtitle?: string;
};

type WorkItemDetail = Ticket | Activity;
type ActiveTab = "details" | "log";
type UpdatesTab = "response" | "comment";
type TimelineRecordKind = "response" | "comment" | "system";

type WorkItemUpdatesDialogProps = {
  open: boolean;
  item: WorkItemUpdatesDialogItem | null;
  onOpenChange: (open: boolean) => void;
};

function getInitials(name?: string) {
  const parts = (name || "ND").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ND";
}

function toNumber(value?: string | number | null, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

function formatHours(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = toNumber(value, Number.NaN);
  if (Number.isFinite(numeric)) return `${formatNumber(numeric)} h`;
  return String(value);
}

function sanitizeHoursInput(value: string) {
  const normalized = value.replace(/\./g, ",").replace(/[^\d,]/g, "");
  const [integerRaw, ...decimalParts] = normalized.split(",");
  const integer = integerRaw || (normalized.startsWith(",") ? "0" : "");
  const decimals = decimalParts.join("").slice(0, 2);

  if (decimalParts.length > 0 || normalized.endsWith(",")) {
    return `${integer},${decimals}`;
  }

  return integer;
}

function getResponseHourOptions(plannedHours: number, currentDoneHours: number) {
  const remainingHours = plannedHours > 0 ? Math.max(0, plannedHours - currentDoneHours) : 0;
  const options = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8];

  if (remainingHours > 0) {
    options.push(remainingHours);
  }

  return Array.from(new Set(options.filter((option) => option > 0).map((option) => formatNumber(option))));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function isTicket(item: WorkItemUpdatesDialogItem | null, detail?: WorkItemDetail): detail is Ticket {
  return item?.type === "ticket";
}

function getDetailResponsibleNames(item: WorkItemUpdatesDialogItem, detail?: WorkItemDetail) {
  if (item.responsibleNames?.length) return item.responsibleNames;

  if (isTicket(item, detail)) {
    return [
      detail?.responsible_technician_name,
      ...(detail?.technician_names || []),
    ].filter(Boolean) as string[];
  }

  const activity = detail as Activity | undefined;
  return [
    activity?.assignee_name,
    ...(activity?.assignee_names || []),
  ].filter(Boolean) as string[];
}

function getStatusTone(status?: string) {
  const normalized = (status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("final") || normalized.includes("conclu") || normalized.includes("feito")) {
    return "bg-emerald-400 text-emerald-950";
  }
  if (normalized.includes("aguard") || normalized.includes("bloque") || normalized.includes("paus")) {
    return "bg-amber-300 text-amber-950";
  }
  if (normalized.includes("atendimento") || normalized.includes("progres")) {
    return "bg-sky-400 text-sky-950";
  }
  return "bg-slate-500/40 text-slate-100";
}

function getPriorityTone(priority?: string) {
  const normalized = (priority || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("critic") || normalized.includes("alta")) return "bg-rose-200 text-rose-950";
  if (normalized.includes("baix")) return "bg-sky-300 text-sky-950";
  return "bg-amber-200 text-amber-950";
}

function getVisibilityLabel(visibility: TicketVisibility | undefined) {
  if (visibility === "client") return "Cliente pode ver";
  return "Somente tecnicos";
}

function getEventMessage(event: TicketTimelineEvent) {
  const entry = event as TicketTimelineEvent & {
    body?: string;
    content?: string;
    text?: string;
    comment?: string;
    description?: string;
  };

  return entry.message || entry.body || entry.content || entry.text || entry.comment || entry.description || "";
}

function getRelativeAge(value?: string) {
  if (!value) return "-";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "-";
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

function extractProgressFromEvent(event: TicketTimelineEvent) {
  const metadata = event.metadata || {};
  const metadataProgress = metadata.progressPercent ?? metadata.progress ?? metadata.percentual;
  const metadataNumber = toNumber(metadataProgress as string | number | undefined, Number.NaN);
  if (Number.isFinite(metadataNumber)) return clamp(metadataNumber, 0, 100);

  const match = getEventMessage(event).match(/Progresso:\s*([\d.,]+)\s*%/i);
  if (!match) return null;
  return clamp(toNumber(match[1], 0), 0, 100);
}

function extractAccumulatedHoursFromEvent(event: TicketTimelineEvent) {
  const metadata = event.metadata || {};
  const metadataHours = metadata.doneHours ?? metadata.accumulatedHours ?? metadata.horasAcumuladas;
  const metadataNumber = toNumber(metadataHours as string | number | undefined, Number.NaN);
  if (Number.isFinite(metadataNumber)) return metadataNumber;

  const match = getEventMessage(event).match(/Horas acumuladas:\s*([\d.,]+)\s*h/i);
  if (!match) return null;
  return toNumber(match[1], 0);
}

function getPreviousProgress(events: TicketTimelineEvent[], doneHours: number, plannedHours: number) {
  const sorted = [...events].sort((left, right) => {
    const leftTime = new Date(left.created_at || 0).getTime();
    const rightTime = new Date(right.created_at || 0).getTime();
    return rightTime - leftTime;
  });

  for (const event of sorted) {
    const progress = extractProgressFromEvent(event);
    if (progress !== null) return progress;
  }

  if (plannedHours > 0) {
    return clamp((doneHours / plannedHours) * 100, 0, 100);
  }

  return 0;
}

function buildResponseMessage({
  message,
  responseHours,
  accumulatedHours,
  plannedHours,
  progressPercent,
}: {
  message: string;
  responseHours: number;
  accumulatedHours: number;
  plannedHours: number;
  progressPercent: number;
}) {
  const lines = ["Resposta tecnica:"];
  if (message.trim()) lines.push(message.trim());
  lines.push(`Horas nesta resposta: ${formatNumber(responseHours)}h`);
  lines.push(
    plannedHours > 0
      ? `Horas acumuladas: ${formatNumber(accumulatedHours)}h de ${formatNumber(plannedHours)}h`
      : `Horas acumuladas: ${formatNumber(accumulatedHours)}h`,
  );
  lines.push(`Progresso: ${formatNumber(progressPercent)}%`);
  return lines.join("\n");
}

function buildCommentMessage(message: string, isInternal: boolean) {
  return [
    "Comentario:",
    message.trim(),
    `Visibilidade: ${getVisibilityLabel(isInternal ? "internal" : "client")}`,
  ].join("\n");
}

function isActivityLogEvent(event: TicketTimelineEvent) {
  const metadata = event.metadata || {};
  const eventType = String(event.type || "").toLowerCase();
  const message = getEventMessage(event);

  if (metadata.fromStatus || metadata.toStatus) return true;
  if (eventType.includes("status") || eventType.includes("sprint") || eventType.includes("history")) return true;
  if (eventType.includes("workflow") || eventType.includes("system")) return true;

  return /status|sprint|categoria|aprova|reprova|planejad|vinculad/i.test(message);
}

function getTimelineRecordKind(event: TicketTimelineEvent): TimelineRecordKind {
  const eventType = String(event.type || "").toLowerCase();
  const message = getEventMessage(event);

  if (/^\s*resposta tecnica:/i.test(message) || extractProgressFromEvent(event) !== null || extractAccumulatedHoursFromEvent(event) !== null) {
    return "response";
  }

  if (/^\s*comentario:/i.test(message) || eventType.includes("comment") || eventType.includes("coment")) {
    return "comment";
  }

  return isActivityLogEvent(event) ? "system" : "comment";
}

function getDisplayMessage(event: TicketTimelineEvent, kind: TimelineRecordKind) {
  const message = getEventMessage(event) || event.type || "Atualizacao registrada.";
  const lines = message.split(/\r?\n/);

  if (kind === "comment") {
    const commentLines = lines.filter((line) => !/^\s*comentario:\s*$/i.test(line) && !/^\s*visibilidade:/i.test(line));
    return commentLines.join("\n").trim() || "Comentario registrado.";
  }

  if (kind === "response") {
    const responseLines = lines.filter((line) => !/^\s*resposta tecnica:\s*$/i.test(line));
    return responseLines.join("\n").trim() || "Resposta tecnica registrada.";
  }

  return message;
}

function getLogDescriptor(event: TicketTimelineEvent) {
  const metadata = event.metadata || {};
  const fromStatus = typeof metadata.fromStatus === "string" ? metadata.fromStatus : "";
  const toStatus = typeof metadata.toStatus === "string" ? metadata.toStatus : "";
  const eventType = String(event.type || "").toLowerCase();
  const message = getEventMessage(event) || "Atualizacao registrada.";
  const progress = extractProgressFromEvent(event);
  const hours = extractAccumulatedHoursFromEvent(event);

  if (fromStatus || toStatus || eventType.includes("status")) {
    return {
      field: "Status",
      from: fromStatus || "-",
      to: toStatus || message,
      kind: "status" as const,
    };
  }

  if (eventType.includes("sprint") || /sprint/i.test(message)) {
    return {
      field: "Sprint",
      from: "-",
      to: message,
      kind: "text" as const,
    };
  }

  if (progress !== null || hours !== null) {
    return {
      field: "Resposta tecnica",
      from: "-",
      to: [
        hours !== null ? `${formatNumber(hours)}h` : null,
        progress !== null ? `${formatNumber(progress)}%` : null,
      ].filter(Boolean).join(" / "),
      kind: "text" as const,
    };
  }

  return {
    field: event.type || "Comentario",
    from: "-",
    to: message,
    kind: "text" as const,
  };
}

function FieldBox({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <div className="mb-1.5 text-xs font-semibold text-slate-300">{label}</div>
      <div className="flex min-h-10 items-center rounded-md border border-[#3a3d5f] bg-[#1a1d36] px-3 text-sm text-slate-100">
        {children}
      </div>
    </div>
  );
}

function ValuePill({ value, kind }: { value: string; kind?: "status" | "text" }) {
  if (!value || value === "-") {
    return <span className="text-slate-500">-</span>;
  }

  if (kind === "status") {
    return (
      <span className={`inline-flex min-h-7 min-w-40 items-center justify-center rounded px-3 text-xs font-semibold ${getStatusTone(value)}`}>
        {value}
      </span>
    );
  }

  return <span className="line-clamp-2 text-sm text-slate-200">{value}</span>;
}

function UpdateCard({ event, kind }: { event: TicketTimelineEvent; kind: TimelineRecordKind }) {
  const author = event.author_name || "Sistema";
  const progress = extractProgressFromEvent(event);
  const hours = extractAccumulatedHoursFromEvent(event);
  const displayMessage = getDisplayMessage(event, kind);

  return (
    <article className="rounded-xl border border-[#3a3d5f] bg-[#181b34]">
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-500 text-sm font-bold text-white">
            {getInitials(author)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-slate-100">{author}</span>
              <span className="text-xs text-slate-400">{event.created_at ? formatDateTime(event.created_at) : ""}</span>
              <span className="rounded bg-slate-700/70 px-2 py-0.5 text-[11px] text-slate-300">
                {event.visibility === "client" ? "Cliente" : "Interno"}
              </span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
              {displayMessage}
            </p>
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      {(progress !== null || hours !== null) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#3a3d5f] px-5 py-3 text-xs text-slate-300">
          {hours !== null && <span className="rounded bg-slate-700/70 px-2 py-1">Horas acumuladas: {formatNumber(hours)}h</span>}
          {progress !== null && <span className="rounded bg-blue-500/20 px-2 py-1 text-blue-200">Progresso: {formatNumber(progress)}%</span>}
        </div>
      )}
    </article>
  );
}

function ActivityLogRows({
  events,
  title,
  code,
}: {
  events: TicketTimelineEvent[];
  title: string;
  code: string;
}) {
  const sortedEvents = [...events].sort((left, right) => {
    const leftTime = new Date(left.created_at || 0).getTime();
    const rightTime = new Date(right.created_at || 0).getTime();
    return rightTime - leftTime;
  });

  return (
    <div className="p-5">
      <div className="mb-5 rounded-sm border border-[#3a3d5f] bg-[#343754] px-5 py-4 text-sm text-slate-200">
        Outras atividades
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <button type="button" className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 font-medium text-white">
          Log do filtro
          <ChevronDown className="h-4 w-4" />
        </button>
        <span className="inline-flex items-center gap-2">
          <UsersRound className="h-4 w-4" />
          Pessoa
        </span>
        <span className="inline-flex items-center gap-2">
          <ListFilter className="h-4 w-4" />
          Alimentado por IA
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#3a3d5f] bg-[#171a31]">
        {sortedEvents.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            Nenhum registro de atividade ainda.
          </div>
        ) : (
          sortedEvents.map((event) => {
            const descriptor = getLogDescriptor(event);
            const author = event.author_name || "Sistema";

            return (
              <div key={event.id} className="grid grid-cols-[72px_minmax(260px,1fr)_220px_minmax(120px,280px)_24px_minmax(120px,280px)_88px] items-center gap-4 border-b border-[#3a3d5f] px-4 py-3 last:border-b-0">
                <div className="flex items-center gap-1 text-sm text-slate-400">
                  <Clock3 className="h-4 w-4" />
                  {getRelativeAge(event.created_at)}
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500 text-xs font-bold text-white">
                    {getInitials(author)}
                  </div>
                  <span className="truncate text-sm font-medium text-slate-200">
                    {code ? `${code} - ` : ""}{title}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-300">{descriptor.field}</div>
                <ValuePill value={descriptor.from} kind={descriptor.kind} />
                <span className="text-center text-slate-500">›</span>
                <ValuePill value={descriptor.to} kind={descriptor.kind} />
                <button type="button" className="rounded border border-[#565a78] px-2 py-1 text-xs text-slate-400 opacity-70">
                  Desfazer
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function WorkItemUpdatesDialog({ open, item, onOpenChange }: WorkItemUpdatesDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>("details");
  const [updatesTab, setUpdatesTab] = useState<UpdatesTab>("response");
  const [responseMessage, setResponseMessage] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentIsInternal, setCommentIsInternal] = useState(true);
  const [responseHours, setResponseHours] = useState("");
  const [progressPercent, setProgressPercent] = useState("0");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["work-item-updates-detail", item?.type, item?.id],
    queryFn: async () => {
      if (!item) throw new Error("Item nao informado.");
      return item.type === "ticket" ? getTicket(item.id) : getActivity(item.id);
    },
    enabled: open && Boolean(item),
  });

  const timelineQuery = useQuery({
    queryKey: ["work-item-updates-timeline", item?.type, item?.id],
    queryFn: async () => {
      if (!item) return [];
      return item.type === "ticket" ? listTicketTimeline(item.id) : listActivityTimeline(item.id);
    },
    enabled: open && Boolean(item),
  });

  const detail = detailQuery.data;
  const responsibleNames = useMemo(
    () => item ? getDetailResponsibleNames(item, detail) : [],
    [detail, item],
  );

  const title = item?.title || detail?.title || "Item";
  const code = item?.code || (isTicket(item, detail) ? detail?.code : (detail as Activity | undefined)?.ticket_code) || item?.id?.slice(0, 8) || "";
  const status = detail?.status || item?.status || "Backlog";
  const priority = detail?.priority || item?.priority || "Media";
  const typeLabel = (isTicket(item, detail) ? detail?.type : (detail as Activity | undefined)?.type) || item?.typeLabel || (item?.type === "ticket" ? "Chamado" : "Atividade");
  const description = detail?.description || item?.description || "Sem descricao cadastrada.";
  const plannedHours = item?.plannedHours ?? (isTicket(item, detail) ? detail?.est_hours : (detail as Activity | undefined)?.est_hours);
  const doneHours = (isTicket(item, detail) ? detail?.done_hours : (detail as Activity | undefined)?.done_hours) ?? item?.doneHours;
  const sprintName = item?.sprintName || (isTicket(item, detail) ? detail?.sprint_name : (detail as Activity | undefined)?.sprint_name) || "-";
  const timeline = timelineQuery.data || [];
  const sortedTimeline = useMemo(() => [...timeline].sort((left, right) => {
    const leftTime = new Date(left.created_at || 0).getTime();
    const rightTime = new Date(right.created_at || 0).getTime();
    return rightTime - leftTime;
  }), [timeline]);
  const responseUpdateEvents = useMemo(
    () => sortedTimeline.filter((event) => getTimelineRecordKind(event) === "response"),
    [sortedTimeline],
  );
  const commentUpdateEvents = useMemo(
    () => sortedTimeline.filter((event) => getTimelineRecordKind(event) === "comment"),
    [sortedTimeline],
  );
  const visibleUpdateEvents = updatesTab === "response" ? responseUpdateEvents : commentUpdateEvents;
  const visibleUpdateKind: TimelineRecordKind = updatesTab === "response" ? "response" : "comment";
  const emptyUpdatesMessage = updatesTab === "response"
    ? "Nenhuma resposta tecnica registrada ainda."
    : "Nenhum comentario registrado ainda.";
  const plannedHoursNumber = toNumber(plannedHours, 0);
  const currentDoneHours = toNumber(doneHours, 0);
  const responseHoursListId = `response-hours-options-${item?.type || "item"}-${item?.id || "novo"}`;
  const responseHourOptions = useMemo(
    () => getResponseHourOptions(plannedHoursNumber, currentDoneHours),
    [plannedHoursNumber, currentDoneHours],
  );
  const responseHoursNumber = Math.max(0, toNumber(responseHours, 0));
  const accumulatedHours = currentDoneHours + responseHoursNumber;
  const previousProgress = getPreviousProgress(timeline, currentDoneHours, plannedHoursNumber);
  const progressNumber = clamp(toNumber(progressPercent, previousProgress), previousProgress, 100);
  const canSubmitResponse =
    Boolean(item)
    && !submittingResponse
    && (
      responseMessage.trim().length > 0
      || responseHoursNumber > 0
      || progressNumber !== previousProgress
    );
  const canSubmitComment = Boolean(item) && !submittingComment && commentMessage.trim().length > 0;

  useEffect(() => {
    if (!open || !item) return;
    setActiveTab("details");
    setUpdatesTab("response");
    setResponseMessage("");
    setCommentMessage("");
    setResponseHours("");
    setCommentIsInternal(true);
  }, [open, item?.type, item?.id]);

  useEffect(() => {
    if (!open || !item) return;
    setProgressPercent(String(Math.round(previousProgress)));
  }, [open, item?.type, item?.id, previousProgress]);

  const refreshAfterSubmit = async () => {
    if (!item) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["work-item-updates-timeline", item.type, item.id] }),
      queryClient.invalidateQueries({ queryKey: ["work-item-updates-detail", item.type, item.id] }),
      queryClient.invalidateQueries({ queryKey: [item.type === "ticket" ? "tickets" : "activities"] }),
      queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] }),
    ]);
  };

  const handleResponseSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!item || !canSubmitResponse) return;

    const messagePayload = buildResponseMessage({
      message: responseMessage,
      responseHours: responseHoursNumber,
      accumulatedHours,
      plannedHours: plannedHoursNumber,
      progressPercent: progressNumber,
    });

    setSubmittingResponse(true);
    try {
      if (item.type === "ticket") {
        await createTicketTimelineComment({
          ticket: item.id,
          message: messagePayload,
          visibility: "internal",
        });
        if (responseHoursNumber > 0) {
          await updateTicket(item.id, { done_hours: accumulatedHours });
        }
      } else {
        await createActivityTimelineComment({
          activity: item.id,
          message: messagePayload,
          visibility: "internal",
        });
        if (responseHoursNumber > 0) {
          await updateActivity(item.id, { done_hours: accumulatedHours });
        }
      }

      setResponseMessage("");
      setResponseHours("");
      setProgressPercent(String(Math.round(progressNumber)));
      await refreshAfterSubmit();
      toast.success("Resposta tecnica registrada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel registrar a resposta.");
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleCommentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!item || !canSubmitComment) return;

    const commentVisibility: TicketVisibility = commentIsInternal ? "internal" : "client";
    const messagePayload = buildCommentMessage(commentMessage, commentIsInternal);

    setSubmittingComment(true);
    try {
      if (item.type === "ticket") {
        await createTicketTimelineComment({
          ticket: item.id,
          message: messagePayload,
          visibility: commentVisibility,
        });
      } else {
        await createActivityTimelineComment({
          activity: item.id,
          message: messagePayload,
          visibility: commentVisibility,
        });
      }

      setCommentMessage("");
      await refreshAfterSubmit();
      toast.success("Comentario adicionado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel adicionar o comentario.");
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[86vh] max-h-[920px] w-[92vw] max-w-[1720px] overflow-hidden border-[#303454] bg-[#15182e] p-0 text-slate-100 shadow-2xl">
        <DialogTitle className="sr-only">{code} - {title}</DialogTitle>
        <DialogDescription className="sr-only">Atualizacoes e detalhes do item.</DialogDescription>

        <div className="flex h-full min-h-0 flex-col">
          <header className="shrink-0 border-b border-[#303454] bg-[#171a31] px-5 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold tracking-tight text-slate-100">
                  {code ? `${code} - ` : ""}{title}
                </h2>
                {item?.subtitle ? <p className="mt-1 text-sm text-slate-400">{item.subtitle}</p> : null}
              </div>
              <div className="mr-8 flex items-center gap-3 text-slate-300">
                <div className="flex -space-x-2">
                  {(responsibleNames.length ? responsibleNames : ["PL"]).slice(0, 3).map((name) => (
                    <div key={name} className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#171a31] bg-blue-500 text-xs font-bold text-white">
                      {getInitials(name)}
                    </div>
                  ))}
                </div>
                <MessageCircle className="h-4 w-4" />
                <button type="button" className="rounded-md border border-[#444869] p-2 hover:bg-white/5">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button type="button" className="rounded-md border border-[#444869] p-2 hover:bg-white/5">
                  <ChevronDown className="h-4 w-4" />
                </button>
                <MoreHorizontal className="h-5 w-5" />
              </div>
            </div>

            <nav className="mt-5 flex items-center gap-1 text-sm text-slate-300">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`flex items-center gap-1.5 border-b-2 px-3 pb-3 ${activeTab === "details" ? "border-blue-500 text-slate-100" : "border-transparent hover:text-white"}`}
              >
                <Home className="h-4 w-4" />
                Detalhes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("log")}
                className={`border-b-2 px-3 pb-3 ${activeTab === "log" ? "border-blue-500 text-slate-100" : "border-transparent hover:text-white"}`}
              >
                Log de atividade
              </button>
            </nav>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "log" ? (
              <ActivityLogRows events={timeline} title={title} code={code} />
            ) : (
              <div className="grid min-h-[calc(86vh-126px)] gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_560px]">
                <section className="space-y-4">
                  <div className="rounded-lg border border-[#3a3d5f] bg-[#171a31]">
                    <div className="flex items-center justify-between border-b border-[#3a3d5f] px-5 py-4">
                      <h3 className="text-lg font-semibold">Informacoes</h3>
                      <MoreHorizontal className="h-5 w-5 text-slate-400" />
                    </div>

                    <div className="grid gap-5 p-5 md:grid-cols-3">
                      <FieldBox label="Resp.">
                        <div className="flex items-center gap-2">
                          {responsibleNames.length === 0 ? (
                            <span className="text-slate-400">Nao definido</span>
                          ) : responsibleNames.slice(0, 3).map((name) => (
                            <span key={name} title={name} className="grid h-7 w-7 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                              {getInitials(name)}
                            </span>
                          ))}
                        </div>
                      </FieldBox>
                      <FieldBox label="Status">
                        <span className={`grid h-full min-h-8 w-full place-items-center rounded text-sm font-semibold ${getStatusTone(status)}`}>
                          {status}
                        </span>
                      </FieldBox>
                      <FieldBox label="Prioridade">
                        <span className={`grid h-full min-h-8 w-full place-items-center rounded text-sm font-semibold ${getPriorityTone(priority)}`}>
                          {priority}
                        </span>
                      </FieldBox>
                      <FieldBox label="Tipo">
                        <span className="grid h-full min-h-8 w-full place-items-center rounded bg-cyan-500 text-sm font-semibold text-white">
                          {typeLabel}
                        </span>
                      </FieldBox>
                      <FieldBox label="Horas planejadas">{formatHours(plannedHours)}</FieldBox>
                      <FieldBox label="Horas executadas">{formatHours(currentDoneHours)}</FieldBox>
                      <FieldBox label="Progresso atual">{formatNumber(previousProgress)}%</FieldBox>
                      <FieldBox label="ID da tarefa">{code || item?.id}</FieldBox>
                      <FieldBox label="Sprint">
                        <span className="rounded bg-slate-500/40 px-2 py-0.5 text-xs">{sprintName}</span>
                      </FieldBox>
                      <FieldBox label="Story points">{item?.storyPoints ?? "-"}</FieldBox>
                      <FieldBox label="Fim previsto">{formatDate(item?.plannedEndDate)}</FieldBox>
                      <FieldBox label="Ultima atualizacao">{formatDateTime(detail?.updated_at)}</FieldBox>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#3a3d5f] bg-[#171a31]">
                    <div className="flex items-center justify-between border-b border-[#3a3d5f] px-5 py-4">
                      <h3 className="text-lg font-semibold">Descricao</h3>
                      <MoreHorizontal className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="min-h-[220px] whitespace-pre-wrap px-8 py-9 text-sm leading-relaxed text-slate-200">
                      {description}
                    </div>
                  </div>
                </section>

                <aside className="min-h-0 rounded-lg border border-[#3a3d5f] bg-[#171a31]">
                  <div className="flex items-center justify-between border-b border-[#3a3d5f] px-5 pt-4">
                    <div className="flex items-center gap-6">
                      <button
                        type="button"
                        onClick={() => setUpdatesTab("response")}
                        className={`border-b-2 px-0 pb-3 text-sm font-semibold transition ${
                          updatesTab === "response"
                            ? "border-blue-500 text-white"
                            : "border-transparent text-slate-300 hover:text-white"
                        }`}
                      >
                        Resposta
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpdatesTab("comment")}
                        className={`border-b-2 px-0 pb-3 text-sm font-semibold transition ${
                          updatesTab === "comment"
                            ? "border-blue-500 text-white"
                            : "border-transparent text-slate-300 hover:text-white"
                        }`}
                      >
                        Comentario
                      </button>
                    </div>
                    <MoreHorizontal className="mb-3 h-5 w-5 text-slate-400" />
                  </div>

                  <div className="max-h-[calc(86vh-176px)] space-y-4 overflow-y-auto p-4">
                    {updatesTab === "response" ? (
                      <form onSubmit={handleResponseSubmit} className="rounded-xl border border-[#3a3d5f] bg-[#191c36] p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-100">Registrar resposta tecnica</p>
                            <p className="text-xs text-slate-400">
                              Progresso inicia em {formatNumber(previousProgress)}%, a porcentagem anterior registrada.
                            </p>
                          </div>
                        </div>

                        <textarea
                          value={responseMessage}
                          onChange={(event) => setResponseMessage(event.target.value)}
                          rows={4}
                          placeholder="Descreva a resposta tecnica, o que foi feito ou o que ainda falta."
                          className="min-h-24 w-full resize-none rounded-lg border border-[#3a3d5f] bg-[#15182e] px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-blue-500"
                        />

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-300">Horas nesta resposta</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              list={responseHoursListId}
                              value={responseHours}
                              onChange={(event) => setResponseHours(sanitizeHoursInput(event.target.value))}
                              placeholder="0"
                              className="h-10 w-full rounded-md border border-[#3a3d5f] bg-[#15182e] px-3 text-sm text-slate-100 outline-none focus:border-blue-500"
                            />
                            <datalist id={responseHoursListId}>
                              {responseHourOptions.map((option) => (
                                <option key={option} value={option} />
                              ))}
                            </datalist>
                          </label>
                          <label className="space-y-2">
                            <span className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-300">
                              <span>Progresso</span>
                              <strong className="text-slate-100">{formatNumber(progressNumber)}%</strong>
                            </span>
                            <input
                              type="range"
                              min={Math.round(previousProgress)}
                              max="100"
                              step="1"
                              value={Math.round(progressNumber)}
                              onChange={(event) => setProgressPercent(event.target.value)}
                              className="h-2 w-full cursor-pointer accent-blue-500"
                            />
                            <span className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>{formatNumber(previousProgress)}%</span>
                              <span>100%</span>
                            </span>
                          </label>
                        </div>

                        <div className="mt-3 rounded-lg border border-[#3a3d5f] bg-[#15182e] px-3 py-3 text-xs text-slate-300">
                          <div className="flex items-center justify-between gap-3">
                            <span>Horas acumuladas</span>
                            <strong className="text-slate-100">
                              {formatNumber(accumulatedHours)}h{plannedHoursNumber > 0 ? ` / ${formatNumber(plannedHoursNumber)}h` : ""}
                            </strong>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progressNumber}%` }} />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span>Tipo de registro</span>
                            <strong className="text-slate-100">Resposta tecnica</strong>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="submit"
                            disabled={!canSubmitResponse}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Send className="h-4 w-4" />
                            {submittingResponse ? "Salvando..." : "Salvar resposta"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleCommentSubmit} className="rounded-xl border border-[#3a3d5f] bg-[#191c36] p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-100">Adicionar comentario</p>
                            <p className="text-xs text-slate-400">
                              Comentario livre, sem alterar horas ou porcentagem da atividade.
                            </p>
                          </div>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#3a3d5f] bg-[#15182e] px-3 py-2 text-xs font-medium text-slate-100">
                            <input
                              type="checkbox"
                              checked={commentIsInternal}
                              onChange={(event) => setCommentIsInternal(event.target.checked)}
                              className="h-4 w-4 rounded border-[#4a4f7a] bg-[#111429] accent-blue-500"
                            />
                            <span>Mensagem interna dos tecnicos</span>
                          </label>
                        </div>

                        <textarea
                          value={commentMessage}
                          onChange={(event) => setCommentMessage(event.target.value)}
                          rows={3}
                          placeholder="Escreva um comentario, observacao ou alinhamento sem apontar horas."
                          className="min-h-20 w-full resize-none rounded-lg border border-[#3a3d5f] bg-[#15182e] px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-blue-500"
                        />

                        <div className="mt-4 flex justify-end">
                          <button
                            type="submit"
                            disabled={!canSubmitComment}
                            className="inline-flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Send className="h-4 w-4" />
                            {submittingComment ? "Enviando..." : "Adicionar comentario"}
                          </button>
                        </div>
                      </form>
                    )}

                    {timelineQuery.isLoading ? (
                      <div className="rounded-xl border border-[#3a3d5f] bg-[#181b34] px-5 py-8 text-center text-sm text-slate-400">
                        Carregando atualizacoes...
                      </div>
                    ) : visibleUpdateEvents.length === 0 ? (
                      <div className="rounded-xl border border-[#3a3d5f] bg-[#181b34] px-5 py-8 text-center text-sm text-slate-400">
                        {emptyUpdatesMessage}
                      </div>
                    ) : (
                      visibleUpdateEvents.map((event) => (
                        <UpdateCard key={event.id} event={event} kind={visibleUpdateKind} />
                      ))
                    )}
                  </div>
                </aside>
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
