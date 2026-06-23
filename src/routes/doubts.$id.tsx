import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BookOpen, CheckCircle2, Eye, HelpCircle, Lock, MessageSquare, Pencil, Tag, ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DoubtsAnswer, DoubtsQuestion } from "@/lib/types";
import {
  acceptAnswer,
  closeDoubtsQuestion,
  convertDoubtsQuestionToKb,
  createDoubtsAnswer,
  deleteDoubtsAnswer,
  deleteDoubtsQuestion,
  getDoubtsQuestion,
  listDoubtsAnswers,
  listKnowledgeCategories,
  toggleAnswerLike,
  toggleQuestionLike,
  updateDoubtsAnswer,
  updateDoubtsQuestion,
} from "@/services/knowledgeService";
import { api } from "@/services/api";
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

function EditQuestionDialog({
  question, open, onClose, onSave, saving,
}: {
  question: DoubtsQuestion; open: boolean; onClose: () => void;
  onSave: (data: Partial<DoubtsQuestion>) => void; saving: boolean;
}) {
  const [title, setTitle] = useState(question.title);
  const [content, setContent] = useState(question.content);
  const [tags, setTags] = useState((question.tags ?? []).join(", "));
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar dúvida</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="eq-title">Título</Label>
            <Input id="eq-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-content">Descrição</Label>
            <Textarea id="eq-content" value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-tags">Tags (separadas por vírgula)</Label>
            <Input id="eq-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            disabled={saving || !title.trim()}
            onClick={() => onSave({
              title: title.trim(), content: content.trim(),
              tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            })}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAnswerDialog({
  answer, open, onClose, onSave, saving,
}: {
  answer: DoubtsAnswer; open: boolean; onClose: () => void;
  onSave: (content: string) => void; saving: boolean;
}) {
  const [content, setContent] = useState(answer.content);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar resposta</DialogTitle></DialogHeader>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="mt-2" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !content.trim()} onClick={() => onSave(content.trim())}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DoubtsQuestionPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser();

  const [answerContent, setAnswerContent] = useState("");
  const [csatOpen, setCsatOpen] = useState(false);
  const [csatRating, setCsatRating] = useState(0);
  const [csatComment, setCsatComment] = useState("");
  const [editQuestionOpen, setEditQuestionOpen] = useState(false);
  const [editAnswerTarget, setEditAnswerTarget] = useState<DoubtsAnswer | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertCategory, setConvertCategory] = useState<string>("");

  const questionQuery = useQuery({ queryKey: ["doubts-question", id], queryFn: () => getDoubtsQuestion(id) });
  const answersQuery = useQuery({ queryKey: ["doubts-answers", id], queryFn: () => listDoubtsAnswers(id) });
  const categoriesQuery = useQuery({ queryKey: ["knowledge-categories"], queryFn: listKnowledgeCategories, enabled: convertDialogOpen });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["doubts-question", id] });
    void queryClient.invalidateQueries({ queryKey: ["doubts-answers", id] });
    void queryClient.invalidateQueries({ queryKey: ["doubts-questions"] });
  }

  const answerMutation = useMutation({
    mutationFn: () => createDoubtsAnswer({ question: id, content: answerContent }),
    onSuccess: () => { toast.success("Resposta enviada."); setAnswerContent(""); invalidate(); },
    onError: () => toast.error("Não foi possível enviar a resposta."),
  });

  const questionLikeMutation = useMutation({
    mutationFn: () => toggleQuestionLike(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["doubts-question", id] }),
  });

  const answerLikeMutation = useMutation({
    mutationFn: (answerId: string) => toggleAnswerLike(answerId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["doubts-answers", id] }),
  });

  const acceptMutation = useMutation({
    mutationFn: (answerId: string) => acceptAnswer(id, answerId),
    onSuccess: () => { toast.success("Resposta aceita."); invalidate(); setCsatOpen(true); },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: (data: Partial<DoubtsQuestion>) => updateDoubtsQuestion(id, data),
    onSuccess: () => { toast.success("Dúvida atualizada."); setEditQuestionOpen(false); invalidate(); },
    onError: () => toast.error("Não foi possível atualizar a dúvida."),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: () => deleteDoubtsQuestion(id),
    onSuccess: () => { toast.success("Dúvida removida."); void navigate({ to: "/doubts" }); },
    onError: () => toast.error("Não foi possível remover a dúvida."),
  });

  const updateAnswerMutation = useMutation({
    mutationFn: ({ answerId, content }: { answerId: string; content: string }) =>
      updateDoubtsAnswer(answerId, { content }),
    onSuccess: () => { toast.success("Resposta atualizada."); setEditAnswerTarget(null); void queryClient.invalidateQueries({ queryKey: ["doubts-answers", id] }); },
    onError: () => toast.error("Não foi possível atualizar a resposta."),
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: (answerId: string) => deleteDoubtsAnswer(answerId),
    onSuccess: () => { toast.success("Resposta removida."); invalidate(); },
    onError: () => toast.error("Não foi possível remover a resposta."),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeDoubtsQuestion(id),
    onSuccess: () => { toast.success("Dúvida fechada."); invalidate(); },
    onError: () => toast.error("Não foi possível fechar a dúvida."),
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
          {question?.title && (<><span>/</span><span className="truncate max-w-[300px] text-foreground">{question.title}</span></>)}
        </div>

        {questionQuery.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Carregando dúvida...</div>
        ) : !question ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Dúvida não encontrada.</div>
        ) : (
          <div className="space-y-5">
            {/* Question card */}
            <div className="glass rounded-2xl shadow-card overflow-hidden">
              <div className="flex">
                {/* Left: stats */}
                <div className="flex w-16 shrink-0 flex-col items-center gap-4 border-r border-border/50 py-5 px-2">
                  <button
                    type="button"
                    onClick={() => questionLikeMutation.mutate()}
                    className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span className="text-xs font-bold leading-none">{question.likes_count ?? 0}</span>
                    <span className="text-[9px]">votos</span>
                  </button>
                  <div className="flex flex-col items-center gap-0.5">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-bold leading-none">{question.views_count}</span>
                    <span className="text-[9px] text-muted-foreground">visitas</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-bold leading-none">{question.answers_count}</span>
                    <span className="text-[9px] text-muted-foreground">respostas</span>
                  </div>
                  {question.status === "CLOSED" && <Lock className="h-4 w-4 text-muted-foreground" />}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 p-5 space-y-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0", STATUS_CLASS[question.status])}>
                      {STATUS_LABELS[question.status]}
                    </span>
                    <h1 className="text-lg font-semibold leading-snug">{question.title}</h1>
                  </div>
                  {question.content && (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{question.content}</p>
                  )}
                  {/* Tags */}
                  {(question.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {question.tags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          <Tag className="h-2.5 w-2.5" />{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border/50 pt-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConvertDialogOpen(true)}>
                        <BookOpen className="h-3.5 w-3.5" /> Converter para KB
                      </Button>
                      {isAuthor && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditQuestionOpen(true)}>
                            <Pencil className="h-3 w-3" /> Editar
                          </Button>
                          {question.status !== "CLOSED" && (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => closeMutation.mutate()}>
                              <Lock className="h-3 w-3" /> Fechar dúvida
                            </Button>
                          )}
                          <ConfirmDelete
                            title="Excluir dúvida?"
                            description="Isso removerá a dúvida e todas as respostas permanentemente."
                            onConfirm={() => deleteQuestionMutation.mutate()}
                          />
                        </>
                      )}
                    </div>
                    <div className="rounded-xl bg-primary/5 px-3 py-2 text-right">
                      <p className="text-[10px] text-muted-foreground">Perguntado por</p>
                      <p className="text-xs font-semibold">{question.author_name ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(question.created_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Answers heading */}
            {answers.length > 0 && (
              <h2 className="text-sm font-semibold text-foreground px-1">
                {answers.length} {answers.length === 1 ? "Resposta" : "Respostas"}
              </h2>
            )}

            {/* Answers */}
            {answersQuery.isLoading ? (
              <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">Carregando respostas...</div>
            ) : (
              <div className="space-y-3">
                {answers.map((answer) => {
                  const isAnswerAuthor = answer.author === user?.id;
                  return (
                    <div key={answer.id} className={cn("glass rounded-2xl shadow-card overflow-hidden", answer.is_accepted && "border-success/40 border-2")}>
                      <div className="flex">
                        <div className="flex w-16 shrink-0 flex-col items-center gap-3 border-r border-border/50 py-4 px-2">
                          {answer.is_accepted ? (
                            <CheckCircle2 className="h-6 w-6 text-success" />
                          ) : isAuthor ? (
                            <button
                              type="button"
                              onClick={() => acceptMutation.mutate(answer.id)}
                              title="Aceitar resposta"
                              className="rounded-full p-1 text-muted-foreground/30 hover:text-success hover:bg-success/10 transition-colors"
                            >
                              <CheckCircle2 className="h-6 w-6" />
                            </button>
                          ) : (
                            <HelpCircle className="h-5 w-5 text-muted-foreground/30" />
                          )}
                          <button
                            type="button"
                            onClick={() => answerLikeMutation.mutate(answer.id)}
                            className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                          >
                            <ThumbsUp className="h-4 w-4" />
                            <span className="text-[11px] font-medium">{answer.likes_count}</span>
                          </button>
                        </div>
                        <div className="flex-1 min-w-0 p-4 space-y-3">
                          {answer.is_accepted && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Resposta aceita
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer.content}</p>
                          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border/50 pt-2">
                            <div className="flex gap-3">
                              {isAnswerAuthor && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditAnswerTarget(answer)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Pencil className="h-3 w-3" /> Editar
                                  </button>
                                  <ConfirmDelete
                                    title="Excluir resposta?"
                                    description="A resposta será removida permanentemente."
                                    onConfirm={() => deleteAnswerMutation.mutate(answer.id)}
                                  />
                                </>
                              )}
                            </div>
                            <div className="rounded-xl bg-muted/40 px-3 py-2 text-right">
                              <p className="text-[10px] text-muted-foreground">Respondido por</p>
                              <p className="text-xs font-semibold">{answer.author_name ?? "—"}</p>
                              <p className="text-[10px] text-muted-foreground">{formatDate(answer.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  <Button onClick={() => answerMutation.mutate()} disabled={answerMutation.isPending || !answerContent.trim()}>
                    Enviar resposta
                  </Button>
                </div>
              </div>
            ) : (
              <div className="glass flex items-center gap-2 rounded-2xl p-4 text-sm text-muted-foreground border border-border/50">
                <Lock className="h-4 w-4 shrink-0" /> Esta dúvida está fechada para novas respostas.
              </div>
            )}
          </div>
        )}
      </div>

      {question && editQuestionOpen && (
        <EditQuestionDialog
          question={question} open={editQuestionOpen} onClose={() => setEditQuestionOpen(false)}
          onSave={(data) => updateQuestionMutation.mutate(data)} saving={updateQuestionMutation.isPending}
        />
      )}
      {editAnswerTarget && (
        <EditAnswerDialog
          answer={editAnswerTarget} open={!!editAnswerTarget} onClose={() => setEditAnswerTarget(null)}
          onSave={(content) => updateAnswerMutation.mutate({ answerId: editAnswerTarget.id, content })}
          saving={updateAnswerMutation.isPending}
        />
      )}

      {/* CSAT modal */}
      <Dialog open={csatOpen} onOpenChange={setCsatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Como foi sua experiência?</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Avalie a resposta que você recebeu.</p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setCsatRating(star)}
                  className={cn(
                    "rounded-full p-1 transition-colors",
                    csatRating >= star ? "text-warning" : "text-muted-foreground/40 hover:text-warning/60",
                  )}
                  aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="csat-comment">Comentário (opcional)</Label>
              <Textarea
                id="csat-comment"
                value={csatComment}
                onChange={(e) => setCsatComment(e.target.value)}
                placeholder="Conte-nos mais sobre sua experiência..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCsatOpen(false);
                toast.success("Obrigado pelo feedback!");
              }}
            >
              Pular
            </Button>
            <Button
              disabled={csatRating === 0}
              onClick={() => {
                void api.post(`/communication/doubts-questions/${id}/rate/`, {
                  rating: csatRating,
                  comment: csatComment,
                }).finally(() => {
                  setCsatOpen(false);
                  setCsatRating(0);
                  setCsatComment("");
                  toast.success("Obrigado pelo feedback!");
                });
              }}
            >
              Enviar avaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Converter dúvida em artigo</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Um rascunho de artigo será criado na Base de Conhecimento com o conteúdo desta dúvida.</p>
            <Select value={convertCategory} onValueChange={setConvertCategory}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Categoria (opcional)" /></SelectTrigger>
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
