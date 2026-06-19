import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, Eye, Heart, Lock, Tag } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  convertForumTopicToKb,
  createForumReply,
  getForumTopic,
  listForumReplies,
  listKnowledgeCategories,
  markBestAnswer,
  toggleReplyLike,
} from "@/services/knowledgeService";
import { getStoredUser } from "@/services/session";

export const Route = createFileRoute("/forum/$id")({
  head: () => ({ meta: [{ title: "Tópico · Nimbus" }] }),
  component: ForumTopicPage,
});

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function truncate(str: string, len = 60) {
  return str.length > len ? str.slice(0, len) + "…" : str;
}

function ForumTopicPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const [replyContent, setReplyContent] = useState("");
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertCategory, setConvertCategory] = useState<string>("");

  const topicQuery = useQuery({
    queryKey: ["forum-topic", id],
    queryFn: () => getForumTopic(id),
  });

  const repliesQuery = useQuery({
    queryKey: ["forum-replies", id],
    queryFn: () => listForumReplies(id),
  });

  const replyMutation = useMutation({
    mutationFn: () => createForumReply({ topic: id, content: replyContent }),
    onSuccess: () => {
      toast.success("Resposta enviada.");
      setReplyContent("");
      void queryClient.invalidateQueries({ queryKey: ["forum-replies", id] });
      void queryClient.invalidateQueries({ queryKey: ["forum-topic", id] });
    },
    onError: () => toast.error("Não foi possível enviar a resposta."),
  });

  const likeMutation = useMutation({
    mutationFn: (replyId: string) => toggleReplyLike(replyId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["forum-replies", id] }),
  });

  const bestAnswerMutation = useMutation({
    mutationFn: (replyId: string) => markBestAnswer(id, replyId),
    onSuccess: () => {
      toast.success("Melhor resposta marcada.");
      void queryClient.invalidateQueries({ queryKey: ["forum-replies", id] });
      void queryClient.invalidateQueries({ queryKey: ["forum-topic", id] });
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: listKnowledgeCategories,
    enabled: convertDialogOpen,
  });

  const convertToKbMutation = useMutation({
    mutationFn: () => convertForumTopicToKb(id, convertCategory || undefined),
    onSuccess: (article) => {
      setConvertDialogOpen(false);
      toast.success("Artigo criado!", {
        action: { label: "Ver artigo →", onClick: () => navigate({ to: "/knowledge/$id", params: { id: article.id } }) },
      });
    },
    onError: () => toast.error("Não foi possível converter o tópico."),
  });

  const topic = topicQuery.data;
  const rawReplies = repliesQuery.data ?? [];
  const isAuthor = topic?.author === user?.id;

  // Best answer first, rest by date
  const replies = [...rawReplies].sort((a, b) => {
    if (a.is_best_answer && !b.is_best_answer) return -1;
    if (!a.is_best_answer && b.is_best_answer) return 1;
    return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
  });

  return (
    <AppShell>
      <div className="max-w-3xl space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/forum" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Fórum
          </Link>
          {topic?.category_name ? (
            <>
              <span>/</span>
              <span>{topic.category_name}</span>
            </>
          ) : null}
          {topic?.title ? (
            <>
              <span>/</span>
              <span className="text-foreground font-medium">{truncate(topic.title)}</span>
            </>
          ) : null}
        </nav>

        {topicQuery.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Carregando tópico...
          </div>
        ) : !topic ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Tópico não encontrado.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Topic post — SO question style */}
            <div className="glass rounded-2xl shadow-card overflow-hidden">
              <div className="flex gap-0">
                {/* Views column */}
                <div className="flex w-16 shrink-0 flex-col items-center justify-start gap-3 border-r border-border/50 pt-6 px-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <Eye className="h-4 w-4 text-muted-foreground mb-0.5" />
                    <span className="text-base font-bold text-foreground leading-none">
                      {topic.views_count ?? 0}
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center">visitas</span>
                  </div>
                  {topic.is_locked ? (
                    <div className="flex flex-col items-center gap-0.5 mt-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground text-center">fechado</span>
                    </div>
                  ) : null}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0 p-5 space-y-4">
                  <h1 className="text-lg font-semibold leading-snug">{topic.title}</h1>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {topic.content}
                  </p>

                  {/* Category badge */}
                  {topic.category_name ? (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <Tag className="h-2.5 w-2.5" />
                        {topic.category_name}
                      </span>
                    </div>
                  ) : null}

                  {/* Footer: actions + author card */}
                  <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => setConvertDialogOpen(true)}
                      >
                        <BookOpen className="h-3.5 w-3.5" /> Converter para KB
                      </Button>
                    </div>
                    {/* "Asked by X on date" card */}
                    <div className="rounded-xl bg-primary/5 border border-primary/10 px-3 py-2 text-xs space-y-0.5">
                      <div className="text-muted-foreground">publicado em {formatDate(topic.created_at)}</div>
                      {topic.author_name ? (
                        <div className="font-medium text-foreground">{topic.author_name}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Replies section */}
            {repliesQuery.isLoading ? (
              <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
                Carregando respostas...
              </div>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-muted-foreground px-1">
                  {replies.length} {replies.length === 1 ? "Resposta" : "Respostas"}
                </h2>
                <div className="space-y-3">
                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={cn(
                        "glass rounded-2xl shadow-card overflow-hidden",
                        reply.is_best_answer && "border-success/40 border-2",
                      )}
                    >
                      <div className="flex gap-0">
                        {/* Like / best answer column */}
                        <div className="flex w-16 shrink-0 flex-col items-center justify-start gap-2 border-r border-border/50 pt-5 px-2">
                          {reply.is_best_answer ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <CheckCircle2 className="h-5 w-5 text-success" />
                              <span className="text-[9px] text-success font-semibold text-center leading-tight">
                                Melhor
                              </span>
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => likeMutation.mutate(reply.id)}
                            className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                          >
                            <Heart className="h-4 w-4" />
                            <span className="text-[11px] font-medium leading-none">{reply.likes_count}</span>
                          </button>
                        </div>

                        {/* Reply content */}
                        <div className="flex-1 min-w-0 p-4 space-y-3">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{reply.content}</p>

                          {/* Footer: mark best + author card */}
                          <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-border/50">
                            <div>
                              {isAuthor && !reply.is_best_answer ? (
                                <button
                                  type="button"
                                  onClick={() => bestAnswerMutation.mutate(reply.id)}
                                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-success/10 hover:text-success transition-colors font-medium"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Marcar como melhor
                                </button>
                              ) : null}
                            </div>
                            <div className="rounded-xl bg-muted/40 border border-border/50 px-3 py-2 text-xs space-y-0.5">
                              <div className="text-muted-foreground">respondido em {formatDate(reply.created_at)}</div>
                              {reply.author_name ? (
                                <div className="font-medium text-foreground">{reply.author_name}</div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Reply form */}
            {topic.is_locked ? (
              <div className="glass flex items-center gap-2 rounded-2xl p-4 text-sm text-muted-foreground border border-border/50">
                <Lock className="h-4 w-4 shrink-0" />
                Tópico fechado para novas respostas.
              </div>
            ) : (
              <div className="glass space-y-3 rounded-2xl p-5 shadow-card">
                <p className="text-sm font-semibold">Sua resposta</p>
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Escreva sua resposta..."
                  className="min-h-[120px] text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => replyMutation.mutate()}
                    disabled={replyMutation.isPending || !replyContent.trim()}
                  >
                    Responder
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Convert to KB dialog — unchanged */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converter tópico em artigo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Um rascunho de artigo será criado na Base de Conhecimento com o conteúdo deste tópico.
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
