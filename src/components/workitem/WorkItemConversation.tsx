import { KeyboardEvent, useState } from "react";
import { Lock, Send, UserRound, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { WorkItemComment, WorkItemNoteType } from "@/lib/workItem";
import { cn } from "@/lib/utils";
import { formatDateTime, parseApiError } from "@/services/utils";

const NOTE_STYLES: Record<
  string,
  { label: string; icon: typeof Lock; badge: string; card: string }
> = {
  public: {
    label: "Resposta pública",
    icon: UserRound,
    badge: "bg-info/15 text-info",
    card: "border-border bg-muted/10",
  },
  internal: {
    label: "Comentário interno",
    icon: Lock,
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    card: "border-amber-500/30 bg-amber-500/[0.05]",
  },
  technical: {
    label: "Nota técnica",
    icon: Wrench,
    badge: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    card: "border-purple-500/30 bg-purple-500/[0.05]",
  },
  resolution: {
    label: "Resolução",
    icon: Wrench,
    badge: "bg-success/15 text-success",
    card: "border-success/30 bg-success/[0.05]",
  },
};

export function WorkItemConversation({
  comments,
  loading,
  hasRequester,
  onSend,
}: {
  comments: WorkItemComment[];
  loading?: boolean;
  /** Sem solicitante externo (atividades internas) o tipo "pública" vira "comentário". */
  hasRequester: boolean;
  onSend: (payload: { body: string; noteType: WorkItemNoteType }) => Promise<void>;
}) {
  const [noteType, setNoteType] = useState<WorkItemNoteType>(hasRequester ? "public" : "internal");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await onSend({ body: body.trim(), noteType });
      setBody("");
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível enviar a mensagem."));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  };

  const composerTypes: WorkItemNoteType[] = hasRequester
    ? ["public", "internal", "technical"]
    : ["internal", "technical"];

  const active = NOTE_STYLES[noteType];

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Mensagens */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando conversa...</p>
        ) : comments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Comece a conversa abaixo.
          </p>
        ) : (
          [...comments]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((comment) => {
              const style = NOTE_STYLES[comment.noteType] || NOTE_STYLES.internal;
              const Icon = style.icon;
              return (
                <div key={comment.id} className={cn("rounded-xl border px-3.5 py-3", style.card)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold">{comment.authorName}</span>
                      <span className="text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <span className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium", style.badge)}>
                      <Icon className="h-3 w-3" /> {style.label}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>
                </div>
              );
            })
        )}
      </div>

      {/* Composer fixo no rodapé da aba */}
      <div
        className={cn(
          "shrink-0 space-y-2 rounded-xl border p-3",
          noteType === "internal"
            ? "border-amber-500/40 bg-amber-500/[0.05]"
            : noteType === "technical"
              ? "border-purple-500/40 bg-purple-500/[0.05]"
              : "border-border bg-muted/10",
        )}
      >
        <div className="flex flex-wrap items-center gap-1">
          {composerTypes.map((type) => {
            const s = NOTE_STYLES[type];
            const Icon = s.icon;
            const selected = noteType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setNoteType(type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  selected ? s.badge : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {type === "public" ? "Responder ao solicitante" : s.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {noteType === "public"
            ? "O solicitante será notificado e verá esta resposta."
            : noteType === "internal"
              ? "Visível apenas para a equipe interna."
              : "Visível apenas para técnicos, gestores e administradores."}
        </p>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder={
            noteType === "public"
              ? "Escreva a resposta para o solicitante..."
              : noteType === "internal"
                ? "Registre andamento ou observações internas..."
                : "Registre diagnóstico técnico, causas e soluções..."
          }
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Ctrl+Enter envia</span>
          <Button size="sm" className="gap-1.5" disabled={sending || !body.trim()} onClick={() => void send()}>
            <Send className="h-3.5 w-3.5" />
            {sending ? "Enviando..." : active.label === "Resposta pública" ? "Responder" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
