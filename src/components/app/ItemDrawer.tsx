import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  X,
  MessageSquare,
  History,
  Copy,
  Check,
  MoreHorizontal,
  Send,
  Shield,
  UserRound,
  TrendingUp,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getTicket, updateTicket } from "@/services/ticketService";
import { getActivity, updateActivity } from "@/services/activityService";
import { listTicketTimeline, createTicketTimelineComment } from "@/services/ticketTimelineService";
import { listUsers } from "@/services/userService";
import { listSprints } from "@/services/sprintService";
import { formatTicketStatusLabel, formatPriorityLabel } from "@/lib/labels";
import { useItemDrawer, type ActivityDrawerTab, type TicketDrawerTab } from "@/context/ItemDrawerContext";
import type { Ticket, Activity, TicketTimelineEvent, TicketVisibility } from "@/lib/types";
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
  Triagem: "bg-muted text-muted-foreground border-border",
  "Em atendimento": "bg-primary/20 text-primary border-primary/30",
  "Aguardando cliente": "bg-warning/25 text-warning border-warning/30",
  "Validação": "bg-accent/20 text-accent border-accent/30",
  Pausado: "bg-info/20 text-info border-info/30",
  Finalizado: "bg-success/20 text-success border-success/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  Crítica: "bg-destructive/20 text-destructive border-destructive/30",
  Alta: "bg-warning/25 text-warning border-warning/30",
  Média: "bg-info/20 text-info border-info/30",
  Baixa: "bg-muted text-muted-foreground border-border",
};

/* ─── Helpers ─── */
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

/* ─── Right panel: Resposta técnica + Comentário ─── */
function TicketResponsePanel({
  ticket,
  events,
  onResponseSubmit,
  onCommentSubmit,
}: {
  ticket: Ticket;
  events: TicketTimelineEvent[];
  onResponseSubmit: (payload: { message: string; hours: number; progress: number }) => Promise<void>;
  onCommentSubmit: (payload: { message: string; visibility: TicketVisibility }) => Promise<void>;
}) {
  const est = Number(ticket.est_hours ?? 0);
  const done = Number(ticket.done_hours ?? 0);
  const currentProgress = est > 0 ? Math.round((done / est) * 100) : 0;

  const [responseText, setResponseText] = useState("");
  const [responseHours, setResponseHours] = useState(0);
  const [progressValue, setProgressValue] = useState(currentProgress);
  const [submittingResponse, setSubmittingResponse] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<TicketVisibility>("client");
  const [submittingComment, setSubmittingComment] = useState(false);

  const handleResponseSubmit = async () => {
    if (!responseText.trim()) return;
    setSubmittingResponse(true);
    try {
      await onResponseSubmit({ message: responseText.trim(), hours: responseHours, progress: progressValue });
      setResponseText("");
      setResponseHours(0);
    } catch {
      toast.error("Erro ao salvar resposta.");
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await onCommentSubmit({ message: commentText.trim(), visibility: commentVisibility });
      setCommentText("");
    } catch {
      toast.error("Erro ao publicar comentário.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const responses = events.filter(e => e.type === "resposta_tecnica" || e.type === "response");
  const comments = events.filter(e => e.type === "comment" || e.type === "comentario" || (!e.type && e.message));

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <Tabs defaultValue="resposta" className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-4 pt-3">
          <TabsList className="h-8 w-full rounded-none bg-transparent p-0 gap-4">
            <TabsTrigger
              value="resposta"
              className="rounded-none border-b-2 border-transparent pb-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-xs font-medium"
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Resposta
            </TabsTrigger>
            <TabsTrigger
              value="comentario"
              className="rounded-none border-b-2 border-transparent pb-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-xs font-medium"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Comentário
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Resposta técnica ── */}
        <TabsContent value="resposta" className="flex-1 overflow-y-auto mt-0 p-4 space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Registrar resposta técnica</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Progresso atual: {currentProgress}% · {done}h de {est}h
              </p>
            </div>

            <Textarea
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              rows={4}
              placeholder="Descreva a resposta técnica, o que foi feito ou o que ainda falta."
              className="resize-none bg-input text-sm placeholder:text-muted-foreground/60 focus-visible:ring-primary"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Horas nesta resposta
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={responseHours}
                  onChange={e => setResponseHours(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Progresso
                  </label>
                  <span className="text-[11px] font-semibold text-primary">{progressValue}%</span>
                </div>
                <input
                  type="range"
                  min={currentProgress}
                  max={100}
                  value={progressValue}
                  onChange={e => setProgressValue(Number(e.target.value))}
                  className="mt-2 w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-0.5">
                  <span>{currentProgress}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {est > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground">Horas acumuladas</span>
                  <span className="text-[11px] font-semibold">{done + responseHours}h / {est}h</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-primary transition-all"
                    style={{ width: `${Math.min(((Number(done) + responseHours) / est) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Tipo de registro <span className="text-foreground font-medium">Resposta técnica</span>
              </span>
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                disabled={submittingResponse || !responseText.trim()}
                onClick={handleResponseSubmit}
              >
                <Send className="h-3.5 w-3.5" />
                {submittingResponse ? "Salvando..." : "Salvar resposta"}
              </Button>
            </div>
          </div>

          {/* Respostas anteriores */}
          {responses.length === 0 ? (
            <p className="text-center text-[12px] text-muted-foreground py-4">
              Nenhuma resposta técnica registrada ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {responses.map((ev, i) => (
                <div key={ev.id ?? i} className="rounded-xl border border-border bg-muted/40 px-3 py-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3 w-3 text-primary" />
                      <span className="text-xs font-medium">{ev.author_name || "Sistema"}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatDateTime(ev.created_at)}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{ev.message}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Comentário ── */}
        <TabsContent value="comentario" className="flex-1 overflow-y-auto mt-0 p-4 space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Novo comentário</p>
              <Select
                value={commentVisibility}
                onValueChange={v => setCommentVisibility(v as TicketVisibility)}
              >
                <SelectTrigger className="h-7 w-40 text-xs bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client" className="text-xs">Visível ao cliente</SelectItem>
                  <SelectItem value="internal" className="text-xs">Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              rows={5}
              placeholder="Escreva um comentário..."
              className="resize-none bg-input text-sm placeholder:text-muted-foreground/60 focus-visible:ring-primary"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {commentVisibility === "client" ? (
                  <span className="flex items-center gap-1"><UserRound className="h-3 w-3" /> Visível ao cliente</span>
                ) : (
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Apenas equipe interna</span>
                )}
              </span>
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                disabled={submittingComment || !commentText.trim()}
                onClick={handleCommentSubmit}
              >
                <Send className="h-3.5 w-3.5" />
                {submittingComment ? "Enviando..." : "Publicar"}
              </Button>
            </div>
          </div>

          {/* Comentários anteriores */}
          {comments.length === 0 ? (
            <p className="text-center text-[12px] text-muted-foreground py-4">
              Nenhum comentário ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {comments.map((ev, i) => (
                <div key={ev.id ?? i} className="rounded-xl border border-border bg-muted/40 px-3 py-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {ev.visibility === "client"
                        ? <UserRound className="h-3 w-3 text-info" />
                        : <Shield className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-xs font-medium">{ev.author_name || "Sistema"}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatDateTime(ev.created_at)}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{ev.message}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
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

  const { data: users = [] } = useQuery({ queryKey: ["form-users"], queryFn: () => listUsers() });
  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints-list"],
    queryFn: () => listSprints(),
  });

  const sprintList = Array.isArray(sprints)
    ? sprints
    : (sprints as { results?: unknown[] }).results ?? [];

  const timelineEvents: TicketTimelineEvent[] = Array.isArray(timelineRaw) ? timelineRaw : [];

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<Ticket>) => updateTicket(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ticket-drawer", id] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["kanban-tickets"] });
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const handleResponseSubmit = async (payload: { message: string; hours: number; progress: number }) => {
    const doneSoFar = Number(ticket?.done_hours ?? 0);
    const estTotal = Number(ticket?.est_hours ?? 0);
    await createTicketTimelineComment({
      ticket: id,
      message: payload.message,
      visibility: "internal",
    });
    if (payload.hours > 0 || payload.progress > 0) {
      const patch: Partial<Ticket> = {};
      if (payload.hours > 0) patch.done_hours = doneSoFar + payload.hours;
      if (estTotal > 0) {
        const newDone = Math.round((payload.progress / 100) * estTotal * 10) / 10;
        if (newDone !== doneSoFar) patch.done_hours = newDone;
      }
      if (Object.keys(patch).length) updateMutation.mutate(patch);
    }
    await queryClient.invalidateQueries({ queryKey: ["ticket-timeline-drawer", id] });
  };

  const handleCommentSubmit = async (payload: { message: string; visibility: TicketVisibility }) => {
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

  const techNames = ticket.technician_names ?? (ticket.responsible_technician_name ? [ticket.responsible_technician_name] : []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Title bar */}
        <div className="shrink-0 border-b border-border px-5 py-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {ticket.code || ticket.id?.slice(0, 8)}
            </span>
            {ticket.client_name && (
              <span className="text-[11px] text-muted-foreground">{ticket.client_name}</span>
            )}
          </div>
          {editingTitle ? (
            <input
              ref={titleRef}
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              className="w-full rounded-lg border border-primary/40 bg-muted/40 px-2 py-1 text-base font-semibold outline-none focus:border-primary"
            />
          ) : (
            <h2
              className="cursor-text text-base font-semibold leading-snug text-foreground hover:text-primary transition-colors"
              onClick={() => { setTitleDraft(ticket.title ?? ""); setEditingTitle(true); }}
              title="Clique para editar"
            >
              {ticket.title || "Sem título"}
            </h2>
          )}
        </div>

        {/* Tabs: Detalhes | Log de atividade */}
        <Tabs defaultValue={initialTab === "historico" ? "historico" : "info"} className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border px-5">
            <TabsList className="h-9 rounded-none bg-transparent p-0 gap-4">
              <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent pb-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary h-9 px-0 text-xs font-medium">
                <Info className="h-3.5 w-3.5 mr-1.5" /> Detalhes
              </TabsTrigger>
              <TabsTrigger value="historico" className="rounded-none border-b-2 border-transparent pb-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary h-9 px-0 text-xs font-medium">
                <History className="h-3.5 w-3.5 mr-1.5" /> Log de atividade
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Detalhes */}
          <TabsContent value="info" className="flex-1 overflow-y-auto mt-0 px-5 py-4">
            {/* Campos principais em grid */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Informações</p>

              {/* Resp. */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">Resp.</span>
                <div className="flex flex-1 items-center gap-2">
                  {techNames.length > 0 && <TechnicianAvatarGroup names={techNames} max={4} />}
                  <Select
                    value={String(ticket.responsible_technician ?? ticket.technicians?.[0] ?? "")}
                    onValueChange={v => updateMutation.mutate({ responsible_technician: v } as Partial<Ticket>)}
                  >
                    <SelectTrigger className="h-7 flex-1 border-0 bg-transparent text-xs shadow-none focus:ring-0 p-0 gap-1">
                      <SelectValue placeholder="— sem responsável —" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                          {u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">Status</span>
                <Select value={ticket.status ?? ""} onValueChange={v => updateMutation.mutate({ status: v })}>
                  <SelectTrigger className="h-7 flex-1 border-0 bg-transparent text-xs shadow-none focus:ring-0 p-0 gap-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{formatTicketStatusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ticket.status && (
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[ticket.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {formatTicketStatusLabel(ticket.status)}
                  </span>
                )}
              </div>

              {/* Prioridade */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">Prioridade</span>
                <Select value={ticket.priority ?? ""} onValueChange={v => updateMutation.mutate({ priority: v })}>
                  <SelectTrigger className="h-7 flex-1 border-0 bg-transparent text-xs shadow-none focus:ring-0 p-0 gap-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                {ticket.priority && (
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${PRIORITY_COLORS[ticket.priority] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {formatPriorityLabel(ticket.priority)}
                  </span>
                )}
              </div>

              {/* Grid 2 colunas para os demais campos */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {ticket.type && (
                  <InfoRow label="Tipo">
                    <Badge className="bg-info/15 text-info border-info/20 text-[10px]">{ticket.type}</Badge>
                  </InfoRow>
                )}
                <InfoRow label="Horas planejadas">
                  <span className="font-medium">{ticket.est_hours ?? 0} h</span>
                </InfoRow>
                <InfoRow label="Horas executadas">
                  <span className="font-medium">{ticket.done_hours ?? 0} h</span>
                </InfoRow>
                {Number(ticket.est_hours ?? 0) > 0 && (
                  <InfoRow label="Progresso atual">
                    <span className="font-medium text-primary">
                      {Math.round((Number(ticket.done_hours ?? 0) / Number(ticket.est_hours ?? 1)) * 100)}%
                    </span>
                  </InfoRow>
                )}
                <InfoRow label="ID da tarefa">
                  <span className="font-mono text-[11px]">{ticket.code || ticket.id?.slice(0, 8)}</span>
                </InfoRow>
                <InfoRow label="Sprint">
                  <Select
                    value={ticket.sprint ? String(ticket.sprint) : NO_SELECTION}
                    onValueChange={v => updateMutation.mutate({ sprint: v === NO_SELECTION ? null : v } as Partial<Ticket>)}
                  >
                    <SelectTrigger className="h-6 border-0 bg-transparent text-xs shadow-none p-0 focus:ring-0">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SELECTION} className="text-xs">—</SelectItem>
                      {(sprintList as { id: string | number; name?: string; title?: string }[]).map(s => (
                        <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                          {s.name ?? s.title ?? String(s.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </InfoRow>
                {ticket.category_name && (
                  <InfoRow label="Categoria"><span>{ticket.category_name}</span></InfoRow>
                )}
                {ticket.requester_name && (
                  <InfoRow label="Solicitante"><span>{ticket.requester_name}</span></InfoRow>
                )}
                {ticket.due_at && (
                  <InfoRow label="Fim previsto">
                    <span className="text-[11px]">{formatDateTime(ticket.due_at)}</span>
                  </InfoRow>
                )}
                {ticket.updated_at && (
                  <InfoRow label="Última atualização">
                    <span className="text-[11px]">{formatDateTime(ticket.updated_at)}</span>
                  </InfoRow>
                )}
                {ticket.sla && (
                  <InfoRow label="SLA">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{ticket.sla}</span>
                  </InfoRow>
                )}
              </div>
            </div>

            {/* Descrição */}
            {ticket.description && (
              <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Descrição</p>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{ticket.description}</p>
              </div>
            )}

            {/* Tags */}
            {(ticket.tags ?? []).length > 0 && (
              <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {(ticket.tags ?? []).map(tag => (
                    <span key={tag} className="rounded border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Log de atividade */}
          <TabsContent value="historico" className="flex-1 overflow-y-auto mt-0 px-5 py-4">
            {timelineEvents.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum registro encontrado.
              </div>
            ) : (
              <ol className="relative border-l border-border pl-5 space-y-4">
                {[...timelineEvents].reverse().map((ev, i) => (
                  <li key={ev.id ?? i} className="relative">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium">{ev.author_name || "Sistema"}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(ev.created_at)}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground/80">{ev.message ?? ev.type ?? "Evento"}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Right panel: Resposta / Comentário ── */}
      <div className="w-80 shrink-0 overflow-hidden">
        <TicketResponsePanel
          ticket={ticket}
          events={timelineEvents}
          onResponseSubmit={handleResponseSubmit}
          onCommentSubmit={handleCommentSubmit}
        />
      </div>
    </div>
  );
}

/* ─── InfoRow helper ─── */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <div className="text-xs text-foreground">{children}</div>
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

  const { data: users = [] } = useQuery({ queryKey: ["form-users"], queryFn: () => listUsers() });

  const timelineEvents: TicketTimelineEvent[] = Array.isArray(timelineRaw) ? timelineRaw : [];

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

  const handleCommentSubmit = async (payload: { message: string; visibility: TicketVisibility }) => {
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

  const assigneeNames = activity.assignee_names ?? (activity.assignee_name ? [activity.assignee_name] : []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border px-5 py-3">
          <div className="mb-1">
            <Badge className="bg-accent/10 text-accent border-accent/20 text-[10px]">Atividade</Badge>
          </div>
          {editingTitle ? (
            <input
              ref={titleRef}
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              className="w-full rounded-lg border border-primary/40 bg-muted/40 px-2 py-1 text-base font-semibold outline-none focus:border-primary"
            />
          ) : (
            <h2
              className="cursor-text text-base font-semibold leading-snug text-foreground hover:text-primary transition-colors"
              onClick={() => { setTitleDraft(activity.title ?? ""); setEditingTitle(true); }}
              title="Clique para editar"
            >
              {activity.title || "Sem título"}
            </h2>
          )}
        </div>

        <Tabs defaultValue={initialTab === "historico" ? "historico" : "info"} className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border px-5">
            <TabsList className="h-9 rounded-none bg-transparent p-0 gap-4">
              <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent pb-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary h-9 px-0 text-xs font-medium">
                <Info className="h-3.5 w-3.5 mr-1.5" /> Detalhes
              </TabsTrigger>
              <TabsTrigger value="historico" className="rounded-none border-b-2 border-transparent pb-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary h-9 px-0 text-xs font-medium">
                <History className="h-3.5 w-3.5 mr-1.5" /> Log de atividade
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="info" className="flex-1 overflow-y-auto mt-0 px-5 py-4">
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Informações</p>

              {/* Responsável */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">Resp.</span>
                <div className="flex flex-1 items-center gap-2">
                  {assigneeNames.length > 0 && <TechnicianAvatarGroup names={assigneeNames} max={4} />}
                  <Select
                    value={String(activity.assignee ?? "")}
                    onValueChange={v => updateMutation.mutate({ assignee: v } as Partial<Activity>)}
                  >
                    <SelectTrigger className="h-7 flex-1 border-0 bg-transparent text-xs shadow-none focus:ring-0 p-0 gap-1">
                      <SelectValue placeholder="— sem responsável —" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                          {u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">Status</span>
                <Select value={activity.status ?? ""} onValueChange={v => updateMutation.mutate({ status: v })}>
                  <SelectTrigger className="h-7 flex-1 border-0 bg-transparent text-xs shadow-none focus:ring-0 p-0 gap-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Backlog", "Em andamento", "Revisão", "Concluída", "Cancelada"].map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activity.status && (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {activity.status}
                  </span>
                )}
              </div>

              {/* Prioridade */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">Prioridade</span>
                <Select value={activity.priority ?? ""} onValueChange={v => updateMutation.mutate({ priority: v })}>
                  <SelectTrigger className="h-7 flex-1 border-0 bg-transparent text-xs shadow-none focus:ring-0 p-0 gap-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                {activity.priority && (
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[activity.priority] ?? "bg-muted text-muted-foreground"}`}>
                    {activity.priority}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <InfoRow label="Story Points">
                  <input
                    type="number" min="0"
                    defaultValue={activity.story_points ?? 0}
                    onBlur={e => updateMutation.mutate({ story_points: Number(e.target.value) } as Partial<Activity>)}
                    className="w-full bg-transparent text-xs outline-none"
                  />
                </InfoRow>
                <InfoRow label="Horas estimadas">
                  <input
                    type="number" min="0" step="0.5"
                    defaultValue={activity.est_hours ?? 0}
                    onBlur={e => updateMutation.mutate({ est_hours: Number(e.target.value) } as Partial<Activity>)}
                    className="w-full bg-transparent text-xs outline-none"
                  />
                </InfoRow>
                <InfoRow label="Horas realizadas">
                  <span>{activity.done_hours ?? 0}h</span>
                </InfoRow>
                {activity.due_at && (
                  <InfoRow label="Fim previsto">
                    <span className="text-[11px]">{formatDateTime(activity.due_at)}</span>
                  </InfoRow>
                )}
                {activity.created_at && (
                  <InfoRow label="Criado em">
                    <span className="text-[11px]">{formatDateTime(activity.created_at)}</span>
                  </InfoRow>
                )}
              </div>
            </div>

            {activity.description && (
              <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Descrição</p>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{activity.description}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico" className="flex-1 overflow-y-auto mt-0 px-5 py-4">
            {timelineEvents.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum registro encontrado.
              </div>
            ) : (
              <ol className="relative border-l border-border pl-5 space-y-4">
                {[...timelineEvents].reverse().map((ev, i) => (
                  <li key={ev.id ?? i} className="relative">
                    <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium">{ev.author_name || "Sistema"}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(ev.created_at)}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground/80">{ev.message ?? ev.type ?? "Evento"}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Right panel: Comentário simples para atividades */}
      <div className="w-72 shrink-0 border-l border-border bg-muted/20 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4 pt-3 pb-0">
          <p className="text-xs font-semibold text-foreground pb-2">
            <MessageSquare className="inline h-3.5 w-3.5 mr-1.5 text-primary" />
            Conversa
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {timelineEvents.length === 0 ? (
            <p className="text-center text-[12px] text-muted-foreground py-4">Nenhuma interação ainda.</p>
          ) : (
            timelineEvents.map((ev, i) => (
              <div key={ev.id ?? i} className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium">{ev.author_name || "Sistema"}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDateTime(ev.created_at)}</span>
                </div>
                <p className="text-xs leading-relaxed">{ev.message}</p>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border p-4 space-y-2">
          <ActivityCommentComposer onSubmit={handleCommentSubmit} />
        </div>
      </div>
    </div>
  );
}

function ActivityCommentComposer({ onSubmit }: { onSubmit: (p: { message: string; visibility: TicketVisibility }) => Promise<void> }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ message: text.trim(), visibility: "internal" });
      setText("");
    } catch {
      toast.error("Erro ao publicar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        placeholder="Adicionar comentário..."
        className="resize-none bg-input text-sm placeholder:text-muted-foreground/60"
      />
      <Button
        size="sm"
        className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
        disabled={submitting || !text.trim()}
        onClick={handleSubmit}
      >
        <Send className="h-3.5 w-3.5" />
        {submitting ? "Enviando..." : "Publicar"}
      </Button>
    </>
  );
}

/* ─── Header avatar strip ─── */
function DrawerHeaderAvatars({ item }: { item: { type: "ticket" | "activity"; id: string } }) {
  const { data: ticket } = useQuery({
    queryKey: ["ticket-drawer", item.id],
    queryFn: () => getTicket(item.id),
    enabled: item.type === "ticket",
    staleTime: Infinity,
  });
  const { data: activity } = useQuery({
    queryKey: ["activity-drawer", item.id],
    queryFn: () => getActivity(item.id),
    enabled: item.type === "activity",
    staleTime: Infinity,
  });

  let names: string[] = [];
  if (item.type === "ticket" && ticket) {
    const nameList = ticket.technician_names ?? [];
    const fallback = ticket.responsible_technician_name;
    names = nameList.length ? nameList : fallback ? [fallback] : [];
  } else if (item.type === "activity" && activity) {
    const nameList = activity.assignee_names ?? [];
    const fallback = activity.assignee_name;
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
    <Dialog open={open} onOpenChange={v => { if (!v) close(); }}>
      <DialogContent
        className="flex flex-col p-0 gap-0 max-w-[90vw] w-[90vw] h-[90vh] max-h-[90vh] border border-border bg-background rounded-2xl overflow-hidden shadow-glow [&>button]:hidden"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5 bg-muted/30">
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

          {item && <DrawerHeaderAvatars item={item} />}

          <div className="flex-1" />

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
          {item?.type === "ticket" && (
            <TicketDrawerContent
              key={`${item.id}-${item.initialTab ?? "info"}`}
              id={item.id}
              initialTab={item.initialTab}
            />
          )}
          {item?.type === "activity" && (
            <ActivityDrawerContent
              key={`${item.id}-${item.initialTab ?? "info"}`}
              id={item.id}
              initialTab={item.initialTab}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
