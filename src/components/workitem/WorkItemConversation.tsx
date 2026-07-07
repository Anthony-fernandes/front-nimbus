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

const MODE_CONFIG: Record<
  "public" | "internal" | "technical",
  {
    emptyText: string;
    helper: string;
    placeholder: string;
    submitLabel: string;
    composerCard: string;
  }
> = {
  public: {
    emptyText: "Nenhuma mensagem com o solicitante ainda. Comece a conversa abaixo.",
    helper: "O solicitante será notificado e verá esta resposta.",
    placeholder: "Escreva a resposta para o solicitante...",
    submitLabel: "Responder",
    composerCard: "border-border bg-muted/10",
  },
  internal: {
    emptyText: "Nenhum comentário interno ainda. Use este espaço como chat da equipe.",
    helper: "Visível apenas para a equipe interna — o solicitante não vê.",
    placeholder: "Ex.: Vou assumir esse chamado / Aguardando retorno do fornecedor...",
    submitLabel: "Comentar",
    composerCard: "border-amber-500/40 bg-amber-500/[0.05]",
  },
  technical: {
    emptyText: "Nenhuma nota técnica ainda. Registre aqui o que foi descoberto na análise.",
    helper: "Visível apenas para técnicos, gestores e administradores.",
    placeholder: "Ex.: Erro só ocorre na filial 03 · Procedure retornando ORA-00942 · Índice corrigido...",
    submitLabel: "Salvar nota",
    composerCard: "border-purple-500/40 bg-purple-500/[0.05]",
  },
};

export function WorkItemConversation({
  comments,
  loading,
  mode,
  onSend,
}: {
  comments: WorkItemComment[];
  loading?: boolean;
  /** Aba fixa: pública (cliente), interna (chat da equipe) ou técnica (conhecimento). */
  mode: "public" | "internal" | "technical";
  onSend: (payload: { body: string; noteType: WorkItemNoteType }) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const config = MODE_CONFIG[mode];
  const style = NOTE_STYLES[mode];
  const Icon = style.icon;

  const visible = comments
    .filter((c) => c.noteType === mode)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await onSend({ body: body.trim(), noteType: mode });
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

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Mensagens */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{config.emptyText}</p>
        ) : (
          visible.map((comment) => (
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
          ))
        )}
      </div>

      {/* Composer fixo no rodapé da aba */}
      <div className={cn("shrink-0 space-y-2 rounded-xl border p-3", config.composerCard)}>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Icon className="h-3 w-3" /> {config.helper}
        </p>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder={config.placeholder}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Ctrl+Enter envia</span>
          <Button size="sm" className="gap-1.5" disabled={sending || !body.trim()} onClick={() => void send()}>
            <Send className="h-3.5 w-3.5" />
            {sending ? "Enviando..." : config.submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
