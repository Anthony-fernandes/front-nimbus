import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  X,
  MessageSquare,
  Info,
  History,
  Copy,
  Check,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TicketTimeline } from "@/components/tickets/TicketTimeline";
import { getTicket, updateTicket } from "@/services/ticketService";
import { getActivity, updateActivity } from "@/services/activityService";
import { listTicketTimeline, createTicketTimelineComment } from "@/services/ticketTimelineService";
import { listUsers } from "@/services/userService";
import { listSprints } from "@/services/sprintService";
import { buildTicketTimeline as _buildTicketTimeline } from "@/lib/tickets";
import { formatTicketStatusLabel, formatPriorityLabel } from "@/lib/labels";
import { useItemDrawer, type ActivityDrawerTab, type TicketDrawerTab } from "@/context/ItemDrawerContext";
import type { Ticket, Activity } from "@/lib/types";
import { formatDateTime } from "@/services/utils";
import { createActivityTimelineComment, listActivityTimeline } from "@/services/activityTimelineService";

const NO_SELECTION = "__none__";

const TICKET_STATUSES = [
  "Triagem",
  "Em atendimento",
  "Aguardando cliente",
  "Validação",
  "Pausado",
  "Finalizado",
];

const PRIORITIES = ["Crítica", "Alta", "Média", "Baixa"];

const STATUS_COLORS: Record<string, string> = {
  Triagem: "bg-muted text-muted-foreground",
  "Em atendimento": "bg-primary/15 text-primary",
  "Aguardando cliente": "bg-warning/15 text-warning",
  "Validação": "bg-accent/15 text-accent",
  Pausado: "bg-info/15 text-info",
  Finalizado: "bg-success/15 text-success",
};

const PRIORITY_COLORS: Record<string, string> = {
  Crítica: "bg-destructive/15 text-destructive",
  Alta: "bg-warning/15 text-warning",
  Média: "bg-info/15 text-info",
  Baixa: "bg-muted text-muted-foreground",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
}

function TechnicianAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = getInitials(name);
  const dim = size === "md" ? "h-8 w-8 text-xs" : "h-7 w-7 text-[11px]";
  return (
    <div
      title={name}
      className={`${dim} shrink-0 grid place-items-center rounded-full bg-gradient-primary font-semibold text-primary-foreground ring-2 ring-background`}
    >
      {initials}
    </div>
  );
}

function TechnicianAvatarGroup({ names, max = 3 }: { names: string[]; max?: number }) {
  if (!names.length) return null;
  const visible = names.slice(0, max);
  const overflow = names.length - max;
  return (
    <div className="flex items-center">
      {visible.map((name, i) => (
        <div key={i} className={i > 0 ? "-ml-2" : ""}>
          <TechnicianAvatar name={name} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          title={names.slice(max).join(", ")}
          className="-ml-2 h-7 w-7 shrink-0 grid place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-background"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copiar link"
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

/* ─── Ticket drawer content ─── */
function TicketDrawerContent({ id, initialTab = "info" }: { id: string; initialTab?: TicketDrawerTab }) {
  const queryClient = useQueryClient();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket-drawer", id],
    queryFn: () => getTicket(id),
  });

  const { data: timelineRaw = [] } = useQuery({
    queryKey: ["ticket-timeline-drawer", id],
    queryFn: () => listTicketTimeline(id),
  });

  const { data: users = [] } = useQuery({ queryKey: ["form-users"], queryFn: listUsers });
  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints-list"],
    queryFn: () => listSprints(),
  });

  const sprintList = Array.isArray(sprints)
    ? sprints
    : (sprints as { results?: unknown[] }).results ?? [];

  // Raw timeline events from API used directly (no ticket object needed for chat)
  const timelineEvents: import("@/lib/types").TicketTimelineEvent[] = Array.isArray(timelineRaw) ? timelineRaw : [];

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<Ticket>) => updateTicket(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ticket-drawer", id] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const publishComment = async (payload: { message: string; visibility: import("@/lib/types").TicketVisibility }) => {
    await createTicketTimelineComment({ ticket: id, message: payload.message, visibility: payload.visibility });
    await queryClient.invalidateQueries({ queryKey: ["ticket-timeline-drawer", id] });
  };

  const saveTitle = () => {
    setEditingTitle(false);
    if (titleDraft.trim() && ticket && titleDraft.trim() !== ticket.title) {
      updateMutation.mutate({ title: titleDraft.trim() });
    }
  };

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  if (isLoading) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (!ticket) return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      Chamado não encontrado.
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 px-6 pt-2 pb-1">
        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {ticket.code || ticket.id?.slice(0, 8)}
        </span>
        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Chamado</Badge>
        {ticket.client_name && (
          <span className="text-[11px] text-muted-foreground">{ticket.client_name}</span>
        )}
        {ticket.status && (
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[ticket.status] ?? "bg-muted text-muted-foreground"}`}>
            {formatTicketStatusLabel(ticket.status)}
          </span>
        )}
        {ticket.priority && (
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[ticket.priority] ?? "bg-muted text-muted-foreground"}`}>
            {formatPriorityLabel(ticket.priority)}
          </span>
        )}
        {ticket.sla && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> SLA {ticket.sla}
          </span>
        )}
      </div>

      {/* Editable title */}
      <div className="px-6 py-2">
        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
            className="w-full rounded-lg border border-primary/40 bg-muted/40 px-3 py-1.5 text-lg font-semibold outline-none focus:border-primary"
          />
        ) : (
          <h2
            className="cursor-text text-lg font-semibold leading-snug hover:text-primary transition-colors"
            onClick={() => { setTitleDraft(ticket.title ?? ""); setEditingTitle(true); }}
            title="Clique para editar"
          >
            {ticket.title || "Sem título"}
          </h2>
        )}
      </div>

      {/* Body: main tabs + right sidebar */}
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        {/* Main tabs */}
        <Tabs defaultValue={initialTab} className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-border px-6">
            <TabsList className="h-9 rounded-none bg-transparent p-0 gap-1">
              <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 text-xs">
                <Info className="h-3.5 w-3.5 mr-1" /> Informações
              </TabsTrigger>
              <TabsTrigger value="conversa" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 text-xs">
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Conversa
              </TabsTrigger>
              <TabsTrigger value="historico" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 text-xs">
                <History className="h-3.5 w-3.5 mr-1" /> Histórico
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Informações */}
          <TabsContent value="info" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <Select value={ticket.status ?? ""} onValueChange={v => updateMutation.mutate({ status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{formatTicketStatusLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prioridade">
                <Select value={ticket.priority ?? ""} onValueChange={v => updateMutation.mutate({ priority: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Responsável">
                <div className="flex items-center gap-2">
                  {(ticket.technician_names ?? (ticket.responsible_technician_name ? [ticket.responsible_technician_name] : [])).length > 0 && (
                    <TechnicianAvatarGroup
                      names={ticket.technician_names ?? (ticket.responsible_technician_name ? [ticket.responsible_technician_name] : [])}
                      max={3}
                    />
                  )}
                  <Select
                    value={String(ticket.responsible_technician ?? ticket.technicians?.[0] ?? "")}
                    onValueChange={v => updateMutation.mutate({ responsible_technician: v } as Partial<Ticket>)}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="— sem responsável —" /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                          {u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
              <Field label="Sprint">
                <Select
                  value={ticket.sprint ? String(ticket.sprint) : NO_SELECTION}
                  onValueChange={v => updateMutation.mutate({ sprint: v === NO_SELECTION ? null : v } as Partial<Ticket>)}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="— sem sprint —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SELECTION} className="text-xs">— sem sprint —</SelectItem>
                    {(sprintList as { id: string | number; name?: string; title?: string }[]).map(s => (
                      <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                        {s.name ?? s.title ?? String(s.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Horas estimadas">
                <input
                  type="number" min="0" step="0.5"
                  defaultValue={ticket.est_hours ?? 0}
                  onBlur={e => updateMutation.mutate({ est_hours: Number(e.target.value) } as Partial<Ticket>)}
                  className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label="Horas realizadas">
                <span className="text-sm font-medium">{ticket.done_hours ?? 0}h</span>
              </Field>
              {ticket.category_name && <Field label="Categoria"><span>{ticket.category_name}</span></Field>}
              {ticket.type && <Field label="Tipo"><span>{ticket.type}</span></Field>}
              {ticket.requester_name && <Field label="Solicitante"><span>{ticket.requester_name}</span></Field>}
              {ticket.organization_name && <Field label="Empresa"><span>{ticket.organization_name}</span></Field>}
              {ticket.created_at && (
                <Field label="Criado em"><span className="text-xs text-muted-foreground">{formatDateTime(ticket.created_at)}</span></Field>
              )}
              {ticket.due_at && (
                <Field label="Prazo"><span className="text-xs text-muted-foreground">{formatDateTime(ticket.due_at)}</span></Field>
              )}
            </div>

            {ticket.description && (
              <div className="mt-6">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Descrição</p>
                <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {ticket.description}
                </div>
              </div>
            )}

            {(ticket.tags ?? []).length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {(ticket.tags ?? []).map(tag => (
                    <span key={tag} className="rounded border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Conversa */}
          <TabsContent value="conversa" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
            <TicketTimeline
              events={timelineEvents}
              allowComposer
              composerLabel="Novo comentário"
              onCommentSubmit={publishComment}
            />
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            ) : (
              <ol className="relative border-l border-border pl-6 space-y-4">
                {[...timelineEvents].reverse().map((ev, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                    <p className="text-xs font-medium leading-snug">{ev.message ?? ev.type ?? "Evento"}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {ev.author_name && `${ev.author_name} · `}
                      {ev.created_at ? formatDateTime(ev.created_at) : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>

        </Tabs>

        {/* Right sidebar */}
        <div className="w-52 shrink-0 border-l border-border overflow-y-auto px-4 py-4 space-y-4">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Detalhes</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[ticket.status ?? ""] ?? "bg-muted"}`}>
                  {formatTicketStatusLabel(ticket.status)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prioridade</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[ticket.priority ?? ""] ?? "bg-muted"}`}>
                  {ticket.priority ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horas est.</span>
                <span className="font-medium">{ticket.est_hours ?? 0}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horas real.</span>
                <span className="font-medium">{ticket.done_hours ?? 0}h</span>
              </div>
              {ticket.sla && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SLA</span>
                  <span className="font-medium">{ticket.sla}</span>
                </div>
              )}
              {ticket.created_at && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Criado</span>
                  <span className="text-[10px]">{formatDateTime(ticket.created_at)}</span>
                </div>
              )}
              {ticket.updated_at && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Atualizado</span>
                  <span className="text-[10px]">{formatDateTime(ticket.updated_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Activity drawer content ─── */
function ActivityDrawerContent({ id, initialTab = "info" }: { id: string; initialTab?: ActivityDrawerTab }) {
  const queryClient = useQueryClient();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity-drawer", id],
    queryFn: () => getActivity(id),
  });

  const { data: timelineRaw = [] } = useQuery({
    queryKey: ["activity-timeline-drawer", id],
    queryFn: () => listActivityTimeline(id),
  });

  const { data: users = [] } = useQuery({ queryKey: ["form-users"], queryFn: listUsers });

  const timelineEvents: import("@/lib/types").TicketTimelineEvent[] = Array.isArray(timelineRaw) ? timelineRaw : [];

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<Activity>) => updateActivity(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["activity-drawer", id] });
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const saveTitle = () => {
    setEditingTitle(false);
    if (titleDraft.trim() && activity && titleDraft.trim() !== activity.title) {
      updateMutation.mutate({ title: titleDraft.trim() });
    }
  };

  const publishComment = async (payload: { message: string; visibility: import("@/lib/types").TicketVisibility }) => {
    await createActivityTimelineComment({ activity: id, message: payload.message, visibility: payload.visibility });
    await queryClient.invalidateQueries({ queryKey: ["activity-timeline-drawer", id] });
  };

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  if (isLoading) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (!activity) return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      Atividade não encontrada.
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-6 pt-2 pb-1">
        <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20 text-[10px]">Atividade</Badge>
        {activity.status && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{activity.status}</span>
        )}
        {activity.priority && (
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[activity.priority] ?? "bg-muted text-muted-foreground"}`}>
            {activity.priority}
          </span>
        )}
      </div>

      <div className="px-6 py-2">
        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
            className="w-full rounded-lg border border-primary/40 bg-muted/40 px-3 py-1.5 text-lg font-semibold outline-none focus:border-primary"
          />
        ) : (
          <h2
            className="cursor-text text-lg font-semibold leading-snug hover:text-primary transition-colors"
            onClick={() => { setTitleDraft(activity.title ?? ""); setEditingTitle(true); }}
            title="Clique para editar"
          >
            {activity.title || "Sem título"}
          </h2>
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Tabs defaultValue={initialTab} className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-border px-6">
            <TabsList className="h-9 rounded-none bg-transparent p-0 gap-1">
              <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 text-xs">
                <Info className="h-3.5 w-3.5 mr-1" /> Informações
              </TabsTrigger>
              <TabsTrigger value="conversa" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 text-xs">
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Conversa
              </TabsTrigger>
              <TabsTrigger value="historico" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 text-xs">
                <History className="h-3.5 w-3.5 mr-1" /> Historico
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="info" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <Select value={activity.status ?? ""} onValueChange={v => updateMutation.mutate({ status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Backlog", "Em andamento", "Revisão", "Concluída", "Cancelada"].map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prioridade">
                <Select value={activity.priority ?? ""} onValueChange={v => updateMutation.mutate({ priority: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Responsável">
                <div className="flex items-center gap-2">
                  {(activity.assignee_names ?? (activity.assignee_name ? [activity.assignee_name] : [])).length > 0 && (
                    <TechnicianAvatarGroup
                      names={activity.assignee_names ?? (activity.assignee_name ? [activity.assignee_name] : [])}
                      max={3}
                    />
                  )}
                  <Select
                    value={String(activity.assignee ?? "")}
                    onValueChange={v => updateMutation.mutate({ assignee: v } as Partial<Activity>)}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="— sem responsável —" /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                          {u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
              <Field label="Story Points">
                <input
                  type="number" min="0"
                  defaultValue={activity.story_points ?? 0}
                  onBlur={e => updateMutation.mutate({ story_points: Number(e.target.value) } as Partial<Activity>)}
                  className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label="Horas estimadas">
                <input
                  type="number" min="0" step="0.5"
                  defaultValue={activity.est_hours ?? 0}
                  onBlur={e => updateMutation.mutate({ est_hours: Number(e.target.value) } as Partial<Activity>)}
                  className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label="Horas realizadas">
                <span className="text-sm font-medium">{activity.done_hours ?? 0}h</span>
              </Field>
              {activity.due_at && (
                <Field label="Prazo">
                  <span className="text-xs text-muted-foreground">{formatDateTime(activity.due_at)}</span>
                </Field>
              )}
              {activity.created_at && (
                <Field label="Criado em">
                  <span className="text-xs text-muted-foreground">{formatDateTime(activity.created_at)}</span>
                </Field>
              )}
            </div>

            {activity.description && (
              <div className="mt-6">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Descrição</p>
                <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {activity.description}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="conversa" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
            <TicketTimeline
              events={timelineEvents}
              title="Conversa da atividade"
              emptyText="Nenhuma interacao registrada nesta atividade."
              allowComposer
              composerLabel="Nova resposta"
              submitHelpText="Esse registro entra na timeline da atividade."
              onCommentSubmit={publishComment}
            />
          </TabsContent>

          <TabsContent value="historico" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            ) : (
              <ol className="relative border-l border-border pl-6 space-y-4">
                {[...timelineEvents].reverse().map((ev, i) => (
                  <li key={ev.id ?? i} className="relative">
                    <span className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                    <p className="text-xs font-medium leading-snug">{ev.message ?? ev.type ?? "Evento"}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {ev.author_name && `${ev.author_name} · `}
                      {ev.created_at ? formatDateTime(ev.created_at) : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>

        <div className="w-52 shrink-0 border-l border-border overflow-y-auto px-4 py-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Detalhes</p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-[11px]">{activity.status ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SP</span>
              <span className="font-medium">{activity.story_points ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas est.</span>
              <span className="font-medium">{activity.est_hours ?? 0}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horas real.</span>
              <span className="font-medium">{activity.done_hours ?? 0}h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Header avatar strip: reads from React Query cache (no extra request) ─── */
function DrawerHeaderAvatars({ item }: { item: { type: "ticket" | "activity"; id: string } }) {
  const queryClient = useQueryClient();

  let names: string[] = [];
  if (item.type === "ticket") {
    const ticket = queryClient.getQueryData<import("@/lib/types").Ticket>(["ticket-drawer", item.id]);
    const nameList = ticket?.technician_names ?? [];
    const fallback = ticket?.responsible_technician_name;
    names = nameList.length ? nameList : fallback ? [fallback] : [];
  } else {
    const activity = queryClient.getQueryData<import("@/lib/types").Activity>(["activity-drawer", item.id]);
    const nameList = activity?.assignee_names ?? [];
    const fallback = activity?.assignee_name;
    names = nameList.length ? nameList : fallback ? [fallback] : [];
  }

  if (!names.length) return null;
  return <TechnicianAvatarGroup names={names} max={4} />;
}

/* ─── Main ItemDrawer ─── */
export function ItemDrawer() {
  const { state, goNext, goPrev, close } = useItemDrawer();
  const { item, list, index } = state;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const open = item !== null;
  const canPrev = index > 0;
  const canNext = index < list.length - 1;

  const pageUrl = item
    ? `${window.location.origin}/${item.type === "ticket" ? "tickets" : "activities"}/${item.id}`
    : "";

  useEffect(() => {
    if (!moreOpen) return;
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) close(); }}>
      <SheetContent
        className="flex flex-col p-0 gap-0 w-[65vw] sm:max-w-none border-l border-border"
        side="right"
      >
        {/* Drawer header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          {/* Nav: prev/next */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canPrev}
              title="Anterior"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              title="Próximo"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {list.length > 1 && (
              <span className="ml-1 text-[11px] text-muted-foreground">{index + 1} / {list.length}</span>
            )}
          </div>

          {/* Responsible avatars (from cache) */}
          {item && <DrawerHeaderAvatars item={item} />}

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            {pageUrl && <CopyLinkButton url={pageUrl} />}
            {item && (
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir página completa"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <div ref={moreRef} className="relative">
              <button
                type="button"
                title="Mais opções"
                onClick={() => setMoreOpen(v => !v)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-9 z-50 min-w-[160px] rounded-xl border border-border bg-background py-1 shadow-xl">
                  {pageUrl && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      onClick={() => { void navigator.clipboard.writeText(pageUrl); setMoreOpen(false); }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar link
                    </button>
                  )}
                  {item && (
                    <a
                      href={pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      onClick={() => setMoreOpen(false)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba
                    </a>
                  )}
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {item?.type === "ticket" && <TicketDrawerContent key={`${item.id}-${item.initialTab ?? "info"}`} id={item.id} initialTab={item.initialTab} />}
          {item?.type === "activity" && <ActivityDrawerContent key={`${item.id}-${item.initialTab ?? "info"}`} id={item.id} initialTab={item.initialTab} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
