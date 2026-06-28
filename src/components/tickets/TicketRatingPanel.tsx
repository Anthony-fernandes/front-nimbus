import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Ticket, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { rateTicket } from "@/services/ticketService";
import { formatDateTime , parseApiError} from "@/services/utils";

const CLOSED_STATUSES = [
  "Resolvido",
  "Encerrado",
  "Fechado",
  "Concluido",
  "Convertido em Atividade de Projeto",
];

export function TicketRatingPanel({
  ticket,
  currentUser,
  onChanged,
}: {
  ticket: Ticket;
  currentUser: User | null;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [comment, setComment] = useState("");

  const isClosed = CLOSED_STATUSES.includes(ticket.status || "");
  const isRequester =
    currentUser &&
    (ticket.requester_user === currentUser.id || ticket.requester_user === currentUser.id);
  const alreadyRated = Boolean(ticket.rated_at);

  if (!isClosed) return null;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["ticket", ticket.id] });
    void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    onChanged?.();
  }

  const rateMutation = useMutation({
    mutationFn: () => rateTicket(ticket.id, selected, comment),
    onSuccess: () => {
      toast.success("Avaliacao enviada com sucesso!");
      refresh();
    },
    onError: (error: unknown) =>
      toast.error(parseApiError(error, "Não foi possível enviar a avaliação.")),
  });

  if (alreadyRated) {
    const stars = ticket.rating ?? 0;
    return (
      <div className="glass space-y-4 rounded-2xl p-5 shadow-card">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Star className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Avaliacao do chamado</p>
            <p className="text-[11px] text-muted-foreground">
              {ticket.rated_at
                ? `Avaliado em ${formatDateTime(ticket.rated_at)}`
                : "Chamado avaliado"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={cn(
                "h-5 w-5",
                i < stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30",
              )}
            />
          ))}
          <span className="ml-2 text-sm font-medium">{stars}/5</span>
        </div>
        {ticket.rating_comment ? (
          <p className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
            {ticket.rating_comment}
          </p>
        ) : null}
      </div>
    );
  }

  if (!isRequester) return null;

  return (
    <div className="glass space-y-4 rounded-2xl p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
          <Star className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Avalie este chamado</p>
          <p className="text-[11px] text-muted-foreground">
            Sua opiniao nos ajuda a melhorar o atendimento.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          const value = i + 1;
          const filled = value <= (hovered || selected);
          return (
            <button
              key={i}
              type="button"
              className="p-0.5 transition-transform hover:scale-110"
              onMouseEnter={() => setHovered(value)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setSelected(value)}
            >
              <Star
                className={cn(
                  "h-6 w-6 transition-colors",
                  filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40",
                )}
              />
            </button>
          );
        })}
        {selected > 0 && (
          <span className="ml-2 text-sm font-medium text-muted-foreground">{selected}/5</span>
        )}
      </div>

      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Comentario (opcional)"
        className="min-h-[64px] text-sm"
      />

      <Button
        size="sm"
        className="gap-1.5"
        disabled={selected === 0 || rateMutation.isPending}
        onClick={() => rateMutation.mutate()}
      >
        <Star className="h-3.5 w-3.5" /> Enviar avaliacao
      </Button>
    </div>
  );
}
