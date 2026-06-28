import { FormEvent, useMemo, useState } from "react";
import { MessageSquare, Send, Shield, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TicketTimelineEvent, TicketVisibility } from "@/lib/types";
import { formatDateTime , parseApiError} from "@/services/utils";

export function TicketTimeline({
  events,
  title = "Histórico / Conversa",
  emptyText = "Nenhuma interacao registrada ainda.",
  allowComposer = false,
  composerLabel = "Novo registro",
  submitHelpText = "Esse registro entra na timeline do chamado.",
  onCommentSubmit,
}: {
  events: TicketTimelineEvent[];
  title?: string;
  emptyText?: string;
  allowComposer?: boolean;
  composerLabel?: string;
  submitHelpText?: string;
  onCommentSubmit?: (payload: {
    message: string;
    visibility: TicketVisibility;
  }) => Promise<void> | void;
}) {
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<TicketVisibility>("internal");
  const [submitting, setSubmitting] = useState(false);

  const groupedEvents = useMemo(
    () =>
      events.filter(Boolean).sort((left, right) => {
        const leftTime = new Date(left.created_at || 0).getTime();
        const rightTime = new Date(right.created_at || 0).getTime();
        return rightTime - leftTime;
      }),
    [events],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!onCommentSubmit || !message.trim()) return;

    setSubmitting(true);
    try {
      await onCommentSubmit({ message: message.trim(), visibility });
      setMessage("");
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível publicar a resposta."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      {allowComposer && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-muted/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-medium text-muted-foreground">{composerLabel}</div>
            <div className="w-40">
              <Select
                value={visibility}
                onValueChange={(value) => setVisibility(value as TicketVisibility)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Visibilidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Interna</SelectItem>
                  <SelectItem value="client">Visivel ao cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            placeholder="Registre andamento, solicitação de informação ou retorno técnico."
          />
          <div className="flex justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {!onCommentSubmit
                ? "A API atual ainda não grava comentários independentes. A tela já está preparada para isso."
                : submitHelpText}
            </p>
            <Button
              type="submit"
              className="gap-1.5"
              disabled={!onCommentSubmit || submitting || !message.trim()}
            >
              <Send className="h-4 w-4" />
              {submitting ? "Enviando..." : "Publicar"}
            </Button>
          </div>
        </form>
      )}

      {groupedEvents.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <ol className="space-y-3">
          {groupedEvents.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-border bg-muted/10 px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {event.visibility === "client" ? (
                    <UserRound className="h-3.5 w-3.5" />
                  ) : (
                    <Shield className="h-3.5 w-3.5" />
                  )}
                  <span>{event.author_name || "Sistema"}</span>
                  <span>·</span>
                  <span>{formatDateTime(event.created_at)}</span>
                </div>
                <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                  {event.type || "evento"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{event.message}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
