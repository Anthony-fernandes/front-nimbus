import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Eye, Flag, Heart, Lock, Pencil, Pin, PinOff, Tag, ThumbsDown, ThumbsUp, Trash2, Unlock,
} from "lucide-react";
import { toast } from "sonner";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import "highlight.js/styles/github-dark.css";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ForumComment, ForumReply, ForumTopic } from "@/lib/types";
import {
  convertForumTopicToKb,
  createForumComment,
  createForumReply,
  deleteForumComment,
  deleteForumReply,
  deleteForumTopic,
  flagContent,
  getForumTopic,
  listForumComments,
  listForumReplies,
  listKnowledgeCategories,
  lockForumTopic,
  markBestAnswer,
  pinForumTopic,
  toggleReplyDownvote,
  toggleReplyLike,
  toggleTopicDownvote,
  toggleTopicLike,
  updateForumReply,
  updateForumTopic,
} from "@/services/knowledgeService";
import { getStoredUser } from "@/services/session";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);

export const Route = createFileRoute("/forum/$id")({
  head: () => ({ meta: [{ title: "Tópico · Nimbus" }] }),
  component: ForumTopicPage,
});

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function truncate(str: string, len = 60) {
  return str.length > len ? str.slice(0, len) + "…" : str;
}

const FLAG_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "conteudo_inadequado", label: "Conteúdo inadequado" },
  { value: "duplicado", label: "Duplicado" },
  { value: "outro", label: "Outro" },
];

function FlagButton({ contentType, objectId }: { contentType: string; objectId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const flagMutation = useMutation({
    mutationFn: () => flagContent(contentType, objectId, reason),
    onSuccess: () => {
      toast.success("Conteúdo sinalizado. Nossa equipe irá revisar.");
      setOpen(false);
      setReason("");
    },
    onError: () => toast.error("Não foi possível sinalizar o conteúdo."),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-orange-500 transition-colors"
        title="Sinalizar conteúdo"
      >
        <Flag className="h-3 w-3" />
        Sinalizar
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Sinalizar conteúdo</DialogTitle></DialogHeader>
          <div className="space-y-2 py-1">
            <p className="text-sm text-muted-foreground">Selecione o motivo para sinalizar este conteúdo:</p>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Motivo" /></SelectTrigger>
              <SelectContent>
                {FLAG_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!reason || flagMutation.isPending}
              onClick={() => flagMutation.mutate()}
            >
              {flagMutation.isPending ? "Enviando..." : "Sinalizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CommentsSection({
  topicId,
  replyId,
  currentUserId,
}: {
  topicId?: string;
  replyId?: string;
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const queryClient = useQueryClient();

  const params = topicId ? { topic: topicId } : { reply: replyId };
  const queryKey = ["forum-comments", topicId ?? "", replyId ?? ""];

  const commentsQuery = useQuery({
    queryKey,
    queryFn: () => listForumComments(params),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createForumComment(topicId ? { topic: topicId, content: newComment } : { reply: replyId, content: newComment }),
    onSuccess: () => {
      setNewComment("");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Não foi possível adicionar o comentário."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteForumComment(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("Não foi possível remover o comentário."),
  });

  const comments = (commentsQuery.data ?? []) as ForumComment[];

  return (
    <div className="border-t border-border/30 pt-2 mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Comentários {comments.length > 0 && open ? `(${comments.length})` : ""}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {commentsQuery.isLoading ? (
            <p className="text-[11px] text-muted-foreground">Carregando...</p>
          ) : comments.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Nenhum comentário ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[11px]">
                  <span className="font-semibold shrink-0">{c.author_name ?? "Usuário"}:</span>
                  <span className="text-muted-foreground flex-1">{c.content}</span>
                  <span className="text-muted-foreground/50 shrink-0">{formatDate(c.created_at)}</span>
                  {c.author === currentUserId && (
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(c.id)}
                      className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
                      title="Excluir comentário"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 mt-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicionar comentário..."
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && newComment.trim()) {
                  e.preventDefault();
                  createMutation.mutate();
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              disabled={!newComment.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditTopicDialog({
  topic, open, onClose, onSave, saving,
}: {
  topic: ForumTopic; open: boolean; onClose: () => void;
  onSave: (data: Partial<ForumTopic>) => void; saving: boolean;
}) {
  const [title, setTitle] = useState(topic.title);
  const [content, setContent] = useState(topic.content);
  const [tags, setTags] = useState((topic.tags ?? []).join(", "));
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar tópico</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="et-title">Título</Label>
            <Input id="et-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="et-content">Conteúdo</Label>
            <Textarea id="et-content" value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="et-tags">Tags (separadas por vírgula)</Label>
            <Input id="et-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" />
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

function EditReplyDialog({
  reply, open, onClose, onSave, saving,
}: {
  reply: ForumReply; open: boolean; onClose: () => void;
  onSave: (content: string) => void; saving: boolean;
}) {
  const [content, setContent] = useState(reply.content);
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

function ForumTopicPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const contentRef = useRef<HTMLDivElement>(null);

  const [replyContent, setReplyContent] = useState("");
  const [editTopicOpen, setEditTopicOpen] = useState(false);
  const [editReplyTarget, setEditReplyTarget] = useState<ForumReply | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertCategory, setConvertCategory] = useState<string>("");

  const topicQuery = useQuery({ queryKey: ["forum-topic", id], queryFn: () => getForumTopic(id) });
  const repliesQuery = useQuery({ queryKey: ["forum-replies", id], queryFn: () => listForumReplies(id) });
  const categoriesQuery = useQuery({ queryKey: ["knowledge-categories"], queryFn: listKnowledgeCategories, enabled: convertDialogOpen });

  // Apply syntax highlighting after content renders
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["forum-topic", id] });
    void queryClient.invalidateQueries({ queryKey: ["forum-replies", id] });
    void queryClient.invalidateQueries({ queryKey: ["forum-topics"] });
  }

  const replyMutation = useMutation({
    mutationFn: () => createForumReply({ topic: id, content: replyContent }),
    onSuccess: () => { toast.success("Resposta enviada."); setReplyContent(""); invalidate(); },
    onError: () => toast.error("Não foi possível enviar a resposta."),
  });

  const likeMutation = useMutation({
    mutationFn: (replyId: string) => toggleReplyLike(replyId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["forum-replies", id] }),
  });

  const topicLikeMutation = useMutation({
    mutationFn: () => toggleTopicLike(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["forum-topic", id] }),
  });

  const topicDownvoteMutation = useMutation({
    mutationFn: () => toggleTopicDownvote(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["forum-topic", id] }),
  });

  const replyDownvoteMutation = useMutation({
    mutationFn: (replyId: string) => toggleReplyDownvote(replyId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["forum-replies", id] }),
  });

  const bestAnswerMutation = useMutation({
    mutationFn: (replyId: string) => markBestAnswer(id, replyId),
    onSuccess: () => { toast.success("Melhor resposta marcada."); invalidate(); },
  });

  const updateTopicMutation = useMutation({
    mutationFn: (data: Partial<ForumTopic>) => updateForumTopic(id, data),
    onSuccess: () => { toast.success("Tópico atualizado."); setEditTopicOpen(false); invalidate(); },
    onError: () => toast.error("Não foi possível atualizar o tópico."),
  });

  const deleteTopicMutation = useMutation({
    mutationFn: () => deleteForumTopic(id),
    onSuccess: () => { toast.success("Tópico removido."); void navigate({ to: "/forum" }); },
    onError: () => toast.error("Não foi possível remover o tópico."),
  });

  const updateReplyMutation = useMutation({
    mutationFn: ({ replyId, content }: { replyId: string; content: string }) => updateForumReply(replyId, { content }),
    onSuccess: () => { toast.success("Resposta atualizada."); setEditReplyTarget(null); void queryClient.invalidateQueries({ queryKey: ["forum-replies", id] }); },
    onError: () => toast.error("Não foi possível atualizar a resposta."),
  });

  const deleteReplyMutation = useMutation({
    mutationFn: (replyId: string) => deleteForumReply(replyId),
    onSuccess: () => { toast.success("Resposta removida."); invalidate(); },
    onError: () => toast.error("Não foi possível remover a resposta."),
  });

  const pinMutation = useMutation({
    mutationFn: () => pinForumTopic(id),
    onSuccess: () => { toast.success("Status de fixado atualizado."); invalidate(); },
    onError: () => toast.error("Ação não permitida."),
  });

  const lockMutation = useMutation({
    mutationFn: () => lockForumTopic(id),
    onSuccess: () => { toast.success("Status de bloqueio atualizado."); invalidate(); },
    onError: () => toast.error("Ação não permitida."),
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
  const isAdmin = user?.is_staff || user?.is_superuser;

  const replies = [...rawReplies].sort((a, b) => {
    if (a.is_best_answer && !b.is_best_answer) return -1;
    if (!a.is_best_answer && b.is_best_answer) return 1;
    return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
  });

  return (
    <AppShell>
      <div className="max-w-3xl space-y-5" ref={contentRef}>
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/forum" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Fórum
          </Link>
          {topic?.category_name && (<><span>/</span><span>{topic.category_name}</span></>)}
          {topic?.title && (<><span>/</span><span className="text-foreground font-medium">{truncate(topic.title)}</span></>)}
        </nav>

        {topicQuery.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Carregando tópico...</div>
        ) : !topic ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Tópico não encontrado.</div>
        ) : (
          <div className="space-y-4">
            {/* Topic card */}
            <div className="glass rounded-2xl shadow-card overflow-hidden">
              <div className="flex">
                {/* Left: votes + views */}
                <div className="flex w-16 shrink-0 flex-col items-center gap-4 border-r border-border/50 pt-5 px-2">
                  <button
                    type="button"
                    onClick={() => topicLikeMutation.mutate()}
                    className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span className="text-xs font-bold leading-none">{topic.likes_count ?? 0}</span>
                    <span className="text-[9px]">votos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => topicDownvoteMutation.mutate()}
                    className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    <span className="text-xs font-bold leading-none">{(topic as unknown as { downvotes_count?: number }).downvotes_count ?? 0}</span>
                  </button>
                  <div className="flex flex-col items-center gap-0.5">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-bold leading-none">{topic.views_count ?? 0}</span>
                    <span className="text-[9px] text-muted-foreground">visitas</span>
                  </div>
                  {topic.is_pinned && (
                    <div className="flex flex-col items-center gap-0.5 text-primary"><Pin className="h-4 w-4" /><span className="text-[9px]">fixado</span></div>
                  )}
                  {topic.is_locked && (
                    <div className="flex flex-col items-center gap-0.5 text-muted-foreground"><Lock className="h-4 w-4" /><span className="text-[9px]">fechado</span></div>
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 p-5 space-y-4">
                  <h1 className="text-lg font-semibold leading-snug">{topic.title}</h1>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{topic.content}</p>
                  {(topic.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {topic.tags.map((tag) => (
                        <Link
                          key={tag}
                          to="/forum/tags/$tag"
                          params={{ tag }}
                          className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Tag className="h-2.5 w-2.5" />{tag}
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-border/50">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setConvertDialogOpen(true)}>
                        <BookOpen className="h-3.5 w-3.5" /> Converter para KB
                      </Button>
                      {isAuthor && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditTopicOpen(true)}>
                            <Pencil className="h-3 w-3" /> Editar
                          </Button>
                          <ConfirmDelete
                            title="Excluir tópico?"
                            description="Isso removerá o tópico e todas as respostas permanentemente."
                            onConfirm={() => deleteTopicMutation.mutate()}
                          />
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => pinMutation.mutate()}>
                            {topic.is_pinned ? <><PinOff className="h-3 w-3" /> Desafixar</> : <><Pin className="h-3 w-3" /> Fixar</>}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => lockMutation.mutate()}>
                            {topic.is_locked ? <><Unlock className="h-3 w-3" /> Reabrir</> : <><Lock className="h-3 w-3" /> Fechar</>}
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <FlagButton contentType="forum_topic" objectId={topic.id} />
                      <div className="rounded-xl bg-primary/5 border border-primary/10 px-3 py-2 text-xs text-right space-y-0.5">
                        <div className="text-muted-foreground">publicado em {formatDate(topic.created_at)}</div>
                        {topic.author_name && <div className="font-semibold">{topic.author_name}</div>}
                      </div>
                    </div>
                  </div>
                  <CommentsSection topicId={id} currentUserId={user?.id} />
                </div>
              </div>
            </div>

            {/* Replies heading */}
            {replies.length > 0 && (
              <h2 className="text-sm font-semibold text-muted-foreground px-1">
                {replies.length} {replies.length === 1 ? "Resposta" : "Respostas"}
              </h2>
            )}

            {/* Replies */}
            {repliesQuery.isLoading ? (
              <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">Carregando respostas...</div>
            ) : (
              <div className="space-y-3">
                {replies.map((reply) => {
                  const isReplyAuthor = reply.author === user?.id;
                  return (
                    <div key={reply.id} className={cn("glass rounded-2xl shadow-card overflow-hidden", reply.is_best_answer && "border-success/40 border-2")}>
                      <div className="flex">
                        <div className="flex w-16 shrink-0 flex-col items-center gap-3 border-r border-border/50 pt-5 px-2">
                          {reply.is_best_answer ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <CheckCircle2 className="h-5 w-5 text-success" />
                              <span className="text-[9px] text-success font-semibold text-center">Melhor</span>
                            </div>
                          ) : isAuthor ? (
                            <button
                              type="button"
                              onClick={() => bestAnswerMutation.mutate(reply.id)}
                              title="Marcar como melhor resposta"
                              className="flex flex-col items-center gap-0.5 rounded-full p-1 text-muted-foreground/40 hover:text-success hover:bg-success/10 transition-colors"
                            >
                              <CheckCircle2 className="h-5 w-5" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => likeMutation.mutate(reply.id)}
                            className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                          >
                            <Heart className="h-4 w-4" />
                            <span className="text-[11px] font-medium">{reply.likes_count}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => replyDownvoteMutation.mutate(reply.id)}
                            className="flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          >
                            <ThumbsDown className="h-4 w-4" />
                            <span className="text-[11px] font-medium">{(reply as unknown as { downvotes_count?: number }).downvotes_count ?? 0}</span>
                          </button>
                        </div>
                        <div className="flex-1 min-w-0 p-4 space-y-3">
                          {reply.is_best_answer && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Melhor resposta
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                          <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-border/50">
                            <div className="flex gap-3 items-center">
                              {isReplyAuthor && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditReplyTarget(reply)}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Pencil className="h-3 w-3" /> Editar
                                  </button>
                                  <ConfirmDelete
                                    title="Excluir resposta?"
                                    description="A resposta será removida permanentemente."
                                    onConfirm={() => deleteReplyMutation.mutate(reply.id)}
                                  />
                                </>
                              )}
                              <FlagButton contentType="forum_reply" objectId={reply.id} />
                            </div>
                            <div className="rounded-xl bg-muted/40 border border-border/50 px-3 py-2 text-xs text-right space-y-0.5">
                              <div className="text-muted-foreground">respondido em {formatDate(reply.created_at)}</div>
                              {reply.author_name && <div className="font-semibold">{reply.author_name}</div>}
                            </div>
                          </div>
                          <CommentsSection replyId={reply.id} currentUserId={user?.id} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reply form */}
            {topic.is_locked ? (
              <div className="glass flex items-center gap-2 rounded-2xl p-4 text-sm text-muted-foreground border border-border/50">
                <Lock className="h-4 w-4 shrink-0" /> Tópico fechado para novas respostas.
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
                  <Button onClick={() => replyMutation.mutate()} disabled={replyMutation.isPending || !replyContent.trim()}>
                    Responder
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {topic && editTopicOpen && (
        <EditTopicDialog
          topic={topic} open={editTopicOpen} onClose={() => setEditTopicOpen(false)}
          onSave={(data) => updateTopicMutation.mutate(data)} saving={updateTopicMutation.isPending}
        />
      )}
      {editReplyTarget && (
        <EditReplyDialog
          reply={editReplyTarget} open={!!editReplyTarget} onClose={() => setEditReplyTarget(null)}
          onSave={(content) => updateReplyMutation.mutate({ replyId: editReplyTarget.id, content })}
          saving={updateReplyMutation.isPending}
        />
      )}

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Converter tópico em artigo</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Um rascunho de artigo será criado na Base de Conhecimento com o conteúdo deste tópico.</p>
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
