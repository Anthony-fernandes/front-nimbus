import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { Lock, MessageSquare, Send, Shield, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TicketTimelineEvent, TicketVisibility } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDateTime , parseApiError} from "@/services/utils";

const QUICK_REPLIES = [
  "Olá! Estamos analisando sua solicitação e retornaremos em breve.",
  "Poderia nos enviar mais detalhes (prints, mensagens de erro, horário do ocorrido)?",
  "A solicitação foi concluída. Poderia validar se está tudo certo?",
];

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
  const [visibility, setVisibility] = useState<TicketVisibility>("client");
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

  const isInternal = visibility === "internal";

  const submitMessage = async () => {
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await submitMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void submitMessage();
    }
  };

  return (
    <div className="glass rounded-2xl p-5 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>

      {allowComposer && (
        <form
          onSubmit={handleSubmit}
          className={cn(
            "space-y-3 rounded-xl border p-4 transition-colors",
            isInternal
              ? "border-amber-500/40 bg-amber-500/[0.06]"
              : "border-border bg-muted/15",
          )}
        >
          {/* Visibility tabs */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex rounded-lg border border-border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setVisibility("client")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  !isInternal
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <UserRound className="h-3.5 w-3.5" /> Responder ao cliente
              </button>
              <button
                type="button"
                onClick={() => setVisibility("internal")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  isInternal
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Lock className="h-3.5 w-3.5" /> Nota interna
              </button>
            </div>
            <div className="text-xs font-medium text-muted-foreground">{composerLabel}</div>
          </div>

          {isInternal ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <Shield className="h-3.5 w-3.5" />
              Visível apenas para a equipe interna — o cliente não verá esta nota.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />
              O cliente será notificado e verá esta resposta.
            </p>
          )}

          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder={
              isInternal
                ? "Registre observações internas, diagnóstico ou próximos passos da equipe."
                : "Escreva a resposta que o cliente vai receber."
            }
          />

          {/* Quick replies */}
          {!isInternal && (
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REPLIES.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => setMessage((prev) => (prev ? `${prev}\n${text}` : text))}
                  className="max-w-[260px] truncate rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  title={text}
                >
                  {text}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {!onCommentSubmit
                ? "A API atual ainda não grava comentários independentes. A tela já está preparada para isso."
                : `${submitHelpText} · Ctrl+Enter envia`}
            </p>
            <Button
              type="submit"
              className={cn("gap-1.5", isInternal && "bg-amber-600 text-white hover:bg-amber-700")}
              disabled={!onCommentSubmit || submitting || !message.trim()}
            >
              <Send className="h-4 w-4" />
              {submitting ? "Enviando..." : isInternal ? "Salvar nota" : "Responder"}
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
          {groupedEvents.map((event) => {
            const internal = event.visibility !== "client";
            return (
              <li
                key={event.id}
                className={cn(
                  "rounded-xl border px-4 py-4",
                  internal
                    ? "border-amber-500/30 bg-amber-500/[0.05]"
                    : "border-border bg-muted/10",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {internal ? (
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <UserRound className="h-3.5 w-3.5" />
                    )}
                    <span className="font-medium text-foreground">{event.author_name || "Sistema"}</span>
                    <span>·</span>
                    <span>{formatDateTime(event.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {internal && (
                      <span className="rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        Interno
                      </span>
                    )}
                    <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                      {event.type || "evento"}
                    </span>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{event.message}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
