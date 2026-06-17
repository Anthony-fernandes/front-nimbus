import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Heart } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  acceptAnswer,
  createDoubtsAnswer,
  getDoubtsQuestion,
  listDoubtsAnswers,
  toggleAnswerLike,
} from "@/services/knowledgeService";
import { getStoredUser } from "@/services/session";

export const Route = createFileRoute("/doubts/$id")({
  head: () => ({ meta: [{ title: "Dúvida · Nimbus" }] }),
  component: DoubtsQuestionPage,
});

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS = { OPEN: "Aberta", ANSWERED: "Respondida", CLOSED: "Fechada" };
const STATUS_CLASS = {
  OPEN: "bg-warning/15 text-warning",
  ANSWERED: "bg-success/15 text-success",
  CLOSED: "bg-muted text-muted-foreground",
};

function DoubtsQuestionPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const [answerContent, setAnswerContent] = useState("");

  const questionQuery = useQuery({
    queryKey: ["doubts-question", id],
    queryFn: () => getDoubtsQuestion(id),
  });

  const answersQuery = useQuery({
    queryKey: ["doubts-answers", id],
    queryFn: () => listDoubtsAnswers(id),
  });

  const answerMutation = useMutation({
    mutationFn: () => createDoubtsAnswer({ question: id, content: answerContent }),
    onSuccess: () => {
      toast.success("Resposta enviada.");
      setAnswerContent("");
      void queryClient.invalidateQueries({ queryKey: ["doubts-answers", id] });
      void queryClient.invalidateQueries({ queryKey: ["doubts-question", id] });
    },
    onError: () => toast.error("Não foi possível enviar a resposta."),
  });

  const likeMutation = useMutation({
    mutationFn: (answerId: string) => toggleAnswerLike(answerId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["doubts-answers", id] }),
  });

  const acceptMutation = useMutation({
    mutationFn: (answerId: string) => acceptAnswer(id, answerId),
    onSuccess: () => {
      toast.success("Resposta aceita.");
      void queryClient.invalidateQueries({ queryKey: ["doubts-answers", id] });
      void queryClient.invalidateQueries({ queryKey: ["doubts-question", id] });
    },
  });

  const question = questionQuery.data;
  const answers = answersQuery.data ?? [];
  const isAuthor = question?.author === user?.id;

  return (
    <AppShell>
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-2">
          <Link
            to="/doubts"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Central de Dúvidas
          </Link>
        </div>

        {questionQuery.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Carregando dúvida...
          </div>
        ) : !question ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Dúvida não encontrada.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Question */}
            <div className="glass space-y-3 rounded-2xl p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    STATUS_CLASS[question.status],
                  )}
                >
                  {STATUS_LABELS[question.status]}
                </span>
                <h1 className="text-lg font-semibold">{question.title}</h1>
              </div>
              {question.content ? (
                <p className="text-sm whitespace-pre-wrap">{question.content}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground border-t border-border pt-3">
                {question.author_name ? <span>{question.author_name}</span> : null}
                <span>{formatDate(question.created_at)}</span>
                <span>{question.answers_count} respostas</span>
                <span>{question.views_count} visualizações</span>
              </div>
            </div>

            {/* Answers */}
            {answersQuery.isLoading ? (
              <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
                Carregando respostas...
              </div>
            ) : (
              <div className="space-y-3">
                {answers.map((answer) => (
                  <div
                    key={answer.id}
                    className={cn(
                      "glass space-y-2 rounded-2xl p-4 shadow-card",
                      answer.is_accepted && "border-success/50 border-2",
                    )}
                  >
                    {answer.is_accepted ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
                        <CheckCircle className="h-3.5 w-3.5" /> Resposta aceita
                      </div>
                    ) : null}
                    <p className="text-sm whitespace-pre-wrap">{answer.content}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        {answer.author_name ? <span>{answer.author_name}</span> : null}
                        <span>{formatDate(answer.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => likeMutation.mutate(answer.id)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                        >
                          <Heart className="h-3.5 w-3.5" /> {answer.likes_count}
                        </button>
                        {isAuthor && !answer.is_accepted ? (
                          <button
                            type="button"
                            onClick={() => acceptMutation.mutate(answer.id)}
                            className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-success/10 hover:text-success transition-colors"
                          >
                            Aceitar resposta
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Answer form */}
            {question.status !== "CLOSED" ? (
              <div className="glass space-y-3 rounded-2xl p-4 shadow-card">
                <p className="text-sm font-medium">Responder</p>
                <Textarea
                  value={answerContent}
                  onChange={(e) => setAnswerContent(e.target.value)}
                  placeholder="Escreva sua resposta..."
                  className="min-h-[80px] text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => answerMutation.mutate()}
                    disabled={answerMutation.isPending || !answerContent.trim()}
                  >
                    Responder
                  </Button>
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl p-4 text-center text-sm text-muted-foreground">
                Esta dúvida está fechada.
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
