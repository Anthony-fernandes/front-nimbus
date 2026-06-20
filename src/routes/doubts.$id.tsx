import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, Eye, Heart, HelpCircle, Lock, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  acceptAnswer,
  convertDoubtsQuestionToKb,
  createDoubtsAnswer,
  getDoubtsQuestion,
  listDoubtsAnswers,
  listKnowledgeCategories,
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
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS = { OPEN: "Aberta", ANSWERED: "Respondida", CLOSED: "Fechada" } as const;
const STATUS_CLASS = {
  OPEN: "bg-warning/15 text-warning",
  ANSWERED: "bg-success/15 text-success",
  CLOSED: "bg-muted text-muted-foreground",
} as const;

function DoubtsQuestionPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const [answerContent, setAnswerContent] = useState("");
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertCategory, setConvertCategory] = useState<string>("");

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

  const categoriesQuery = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: listKnowledgeCategories,
    enabled: convertDialogOpen,
  });

  const convertToKbMutation = useMutation({
    mutationFn: () => convertDoubtsQuestionToKb(id, convertCategory || undefined),
    onSuccess: (article) => {
      setConvertDialogOpen(false);
      toast.success("Artigo criado!", {
        action: { label: "Ver artigo →", onClick: () => navigate({ to: "/knowledge/$id", params: { id: article.id } }) },
      });
    },
    onError: () => toast.error("Não foi possível converter a dúvida."),
  });

  const question = questionQuery.data;
  const rawAnswers = answersQuery.data ?? [];
  const answers = [...rawAnswers].sort((a, b) => {
    if (a.is_accepted && !b.is_accepted) return -1;
    if (!a.is_accepted && b.is_accepted) return 1;
    return b.likes_count - a.likes_count;
  });
  const isAuthor = question?.author === user?.id;

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/doubts" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Central de Dúvidas
          </Link>
          {question?.title ? (
            <>
              <span>/</span>
              <span className="truncate max-w-[300px] text-foreground">{question.title}</span>
            </>
          ) : null}
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
          <div className="space-y-5">
            {/* Question card */}
            <div className="glass rounded-2xl shadow-card overflow-hidden">
              <div className="flex gap-0">
                {/* Left column: stats */}
                <div className="flex w-16 shrink-0 flex-col items-center gap-4 border-r border-border/50 py-5 px-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <Eye className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-sm font-bold leading-none">{question.views_count}</span>
                    <span className="text-[10px] text-muted-foreground">visitas</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-sm font-bold leading-none">{question.answers_count}</span>
                    <span className="text-[10px] text-muted-foreground">respostas</span>
                  </div>
                  {question.status === "CLOSED" ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : null}
                </div>

                {/* Main content */}
                <div className="flex flex-1 flex-col gap-4 p-5 min-w-0">
                  <div className="flex flex-wrap items-start gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0",
                        STATUS_CLASS[question.status],
                      )}
                    >
                      {STATUS_LABELS[question.status]}
                    </span>
                    <h1 className="text-lg font-semibold leading-snug">{question.title}</h1>
                  </div>

                  {question.content ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {question.content}
                    </p>
                  ) : null}

                  <div className="flex items-end justify-between gap-3 border-t border-border/50 pt-3">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConvertDialogOpen(true)}>
                      <BookOpen className="h-3.5 w-3.5" /> Converter para KB
                    </Button>
                    <div className="rounded-xl bg-primary/5 px-3 py-2 text-right">
                      <p className="text-[10px] text-muted-foreground">Perguntado por</p>
                      <p className="text-xs font-semibold text-foreground">{question.author_name ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(question.created_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Answers heading */}
            {answers.length > 0 ? (
              <h2 className="text-sm font-semibold text-foreground">
                {answers.length} {answers.length === 1 ? "Resposta" : "Respostas"}
              </h2>
            ) : null}

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
                      "glass rounded-2xl shadow-card overflow-hidden",
                      answer.is_accepted && "border-success/40 border-2",
                    )}
                  >
                    <div className="flex gap-0">
                      {/* Left column: like + accept */}
                      <div className="flex w-16 shrink-0 flex-col items-center gap-3 border-r border-border/50 py-4 px-2">
                        {answer.is_accepted ? (
                          <CheckCircle2 className="h-6 w-6 text-success" />
                        ) : isAuthor ? (
                          <button
                            type="button"
                            onClick={() => acceptMutation.mutate(answer.id)}
                            title="Aceitar resposta"
                            className="rounded-full p-1 text-muted-foreground hover:text-success hover:bg-success/10 transition-colors"
                          >
                            <CheckCircle2 className="h-6 w-6" />
                          </button>
                        ) : (
                          <HelpCircle className="h-5 w-5 text-muted-foreground/30" />
                        )}
                        <button
                          type="button"
                          onClick={() => likeMutation.mutate(answer.id)}
                          className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                        >
                          <Heart className="h-4 w-4" />
                          <span className="text-[11px] font-medium">{answer.likes_count}</span>
                        </button>
                      </div>

                      {/* Main content */}
                      <div className="flex flex-1 flex-col gap-3 p-4 min-w-0">
                        {answer.is_accepted ? (
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Resposta aceita
                          </div>
                        ) : null}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer.content}</p>
                        <div className="flex items-end justify-end border-t border-border/50 pt-2">
                          <div className="rounded-xl bg-muted/40 px-3 py-2 text-right">
                            <p className="text-[10px] text-muted-foreground">Respondido por</p>
                            <p className="text-xs font-semibold">{answer.author_name ?? "—"}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(answer.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Answer form */}
            {question.status !== "CLOSED" ? (
              <div className="glass space-y-3 rounded-2xl p-5 shadow-card">
                <p className="text-sm font-semibold">Sua resposta</p>
                <Textarea
                  value={answerContent}
                  onChange={(e) => setAnswerContent(e.target.value)}
                  placeholder="Escreva sua resposta..."
                  className="min-h-[120px] text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => answerMutation.mutate()}
                    disabled={answerMutation.isPending || !answerContent.trim()}
                  >
                    Enviar resposta
                  </Button>
                </div>
              </div>
            ) : (
              <div className="glass flex items-center gap-2 rounded-2xl p-4 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 shrink-0" />
                Esta dúvida está fechada para novas respostas.
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converter dúvida em artigo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Um rascunho de artigo será criado na Base de Conhecimento com o conteúdo desta dúvida.
            </p>
            <Select value={convertCategory} onValueChange={setConvertCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Categoria (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {(categoriesQuery.data ?? []).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => convertToKbMutation.mutate()} disabled={convertToKbMutation.isPending}>
              {convertToKbMutation.isPending ? "Convertendo..." : "Converter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
