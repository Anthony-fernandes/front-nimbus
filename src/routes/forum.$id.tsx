import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Heart, Star } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createForumReply,
  getForumTopic,
  listForumReplies,
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
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function ForumTopicPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const [replyContent, setReplyContent] = useState("");

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

  const topic = topicQuery.data;
  const replies = repliesQuery.data ?? [];
  const isAuthor = topic?.author === user?.id;

  return (
    <AppShell>
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-2">
          <Link
            to="/forum"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Fórum
          </Link>
        </div>

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
            {/* Topic */}
            <div className="glass space-y-3 rounded-2xl p-5 shadow-card">
              <h1 className="text-lg font-semibold">{topic.title}</h1>
              <p className="text-sm text-foreground whitespace-pre-wrap">{topic.content}</p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground border-t border-border pt-3">
                {topic.author_name ? <span>{topic.author_name}</span> : null}
                <span>{formatDate(topic.created_at)}</span>
                <span>{topic.views_count} visualizações</span>
                <span>{topic.replies_count} respostas</span>
              </div>
            </div>

            {/* Replies */}
            {repliesQuery.isLoading ? (
              <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
                Carregando respostas...
              </div>
            ) : (
              <div className="space-y-3">
                {replies.map((reply) => (
                  <div
                    key={reply.id}
                    className={cn(
                      "glass space-y-2 rounded-2xl p-4 shadow-card",
                      reply.is_best_answer && "border-success/50 border-2",
                    )}
                  >
                    {reply.is_best_answer ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
                        <Star className="h-3.5 w-3.5 fill-success" /> Melhor resposta
                      </div>
                    ) : null}
                    <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        {reply.author_name ? <span>{reply.author_name}</span> : null}
                        <span>{formatDate(reply.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => likeMutation.mutate(reply.id)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                        >
                          <Heart className="h-3.5 w-3.5" /> {reply.likes_count}
                        </button>
                        {isAuthor && !reply.is_best_answer ? (
                          <button
                            type="button"
                            onClick={() => bestAnswerMutation.mutate(reply.id)}
                            className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-success/10 hover:text-success transition-colors"
                          >
                            Marcar melhor resposta
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply form */}
            {!topic.is_locked ? (
              <div className="glass space-y-3 rounded-2xl p-4 shadow-card">
                <p className="text-sm font-medium">Responder</p>
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Escreva sua resposta..."
                  className="min-h-[80px] text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => replyMutation.mutate()}
                    disabled={replyMutation.isPending || !replyContent.trim()}
                  >
                    Responder
                  </Button>
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl p-4 text-center text-sm text-muted-foreground">
                Este tópico está fechado para novas respostas.
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
