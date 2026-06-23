import DOMPurify from "dompurify";
import { marked } from "marked";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BookOpen, ChevronDown, ChevronUp, Clock, Edit, Eye, MessageSquare, Paperclip, Printer, Tag, ThumbsDown, ThumbsUp, Trash2, Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { hasAnyPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  getKnowledgeArticle,
  listKnowledgeArticles,
  listKnowledgeInternalComments,
  createKnowledgeInternalComment,
  deleteKnowledgeInternalComment,
  listArticleVersions,
  listArticleAttachments,
  uploadArticleAttachment,
  deleteArticleAttachment,
  publishArticle,
  rateArticle,
  requestKnowledgeReview,
} from "@/services/knowledgeService";
import type { ArticleVersion, ArticleAttachment } from "@/services/knowledgeService";
import type { KnowledgeInternalComment } from "@/lib/types";
import { getStoredUser } from "@/services/session";
import { API_BASE_URL } from "@/services/api";

export const Route = createFileRoute("/knowledge/$id")({
  head: () => ({ meta: [{ title: "Artigo · Nimbus" }] }),
  component: KnowledgeArticlePage,
});

marked.setOptions({ breaks: true, gfm: true });

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: "Publicado",
  DRAFT: "Rascunho",
  ARCHIVED: "Arquivado",
  REVIEW: "Em Revisão",
};

const STATUS_CLASS: Record<string, string> = {
  PUBLISHED: "bg-success/15 text-success",
  DRAFT: "bg-warning/15 text-warning",
  ARCHIVED: "bg-muted text-muted-foreground",
  REVIEW: "bg-amber-500/15 text-amber-600",
};

const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "Público",
  INTERNAL: "Interno",
  RESTRICTED: "Restrito",
};

function KnowledgeArticlePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const isAdminOrTech = hasAnyPermission(user, ["tickets.viewAll", "tickets.viewAssigned"]);

  const [newComment, setNewComment] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [diffVersion, setDiffVersion] = useState<ArticleVersion | null>(null);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);

  const articleQuery = useQuery({
    queryKey: ["knowledge-article", id],
    queryFn: () => getKnowledgeArticle(id),
  });

  const relatedQuery = useQuery({
    queryKey: ["knowledge-articles-related", articleQuery.data?.category],
    queryFn: () =>
      listKnowledgeArticles({ category: articleQuery.data!.category, status: "PUBLISHED" }),
    enabled: !!articleQuery.data?.category,
    select: (articles) => articles.filter((a) => a.id !== id).slice(0, 5),
  });

  const internalCommentsQuery = useQuery({
    queryKey: ["kb-internal-comments", id],
    queryFn: () => listKnowledgeInternalComments(id),
    enabled: isAdminOrTech,
  });

  const versionsQuery = useQuery({
    queryKey: ["kb-article-versions", id],
    queryFn: () => listArticleVersions(id),
    enabled: isAdminOrTech && showHistory,
  });

  const attachmentsQuery = useQuery({
    queryKey: ["kb-article-attachments", id],
    queryFn: () => listArticleAttachments(id),
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: (file: File) => uploadArticleAttachment(id, file),
    onSuccess: () => {
      toast.success("Anexo enviado.");
      void queryClient.invalidateQueries({ queryKey: ["kb-article-attachments", id] });
    },
    onError: () => toast.error("Erro ao enviar anexo."),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteArticleAttachment(attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["kb-article-attachments", id] });
    },
    onError: () => toast.error("Erro ao excluir anexo."),
  });

  const rateMutation = useMutation({
    mutationFn: (helpful: boolean) => rateArticle(id, helpful),
    onSuccess: () => {
      toast.success("Obrigado pelo seu feedback!");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-article", id] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishArticle(id),
    onSuccess: () => {
      toast.success("Artigo publicado.");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-article", id] });
    },
    onError: () => toast.error("Não foi possível publicar o artigo."),
  });

  const reviewMutation = useMutation({
    mutationFn: () => requestKnowledgeReview(id),
    onSuccess: () => {
      toast.success("Revisão solicitada.");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-article", id] });
    },
    onError: () => toast.error("Não foi possível solicitar revisão."),
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      createKnowledgeInternalComment({ article: id, content }),
    onSuccess: () => {
      setNewComment("");
      void queryClient.invalidateQueries({ queryKey: ["kb-internal-comments", id] });
    },
    onError: () => toast.error("Não foi possível adicionar comentário."),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteKnowledgeInternalComment(commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["kb-internal-comments", id] });
    },
    onError: () => toast.error("Não foi possível excluir comentário."),
  });

  const article = articleQuery.data;

  function computeDiff(oldText: string, newText: string): { type: "add" | "remove" | "equal"; line: string }[] {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const result: { type: "add" | "remove" | "equal"; line: string }[] = [];
    let oi = 0;
    let ni = 0;
    while (oi < oldLines.length || ni < newLines.length) {
      if (oi >= oldLines.length) {
        result.push({ type: "add", line: newLines[ni++] });
      } else if (ni >= newLines.length) {
        result.push({ type: "remove", line: oldLines[oi++] });
      } else if (oldLines[oi] === newLines[ni]) {
        result.push({ type: "equal", line: oldLines[oi] });
        oi++;
        ni++;
      } else {
        result.push({ type: "remove", line: oldLines[oi++] });
        result.push({ type: "add", line: newLines[ni++] });
      }
    }
    return result;
  }

  function formatBytes(bytes: number | null): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function renderContent(content: string): string {
    // If content looks like HTML (starts with <), render as-is; otherwise parse as Markdown
    const isHtml = content.trimStart().startsWith("<");
    const html = isHtml ? content : (marked.parse(content) as string);
    return DOMPurify.sanitize(html);
  }

  const totalRatings = (article?.helpful_count ?? 0) + (article?.not_helpful_count ?? 0);
  const helpfulPct = totalRatings > 0
    ? Math.round(((article?.helpful_count ?? 0) / totalRatings) * 100)
    : null;

  const internalComments: KnowledgeInternalComment[] = internalCommentsQuery.data ?? [];

  return (
    <AppShell>
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          .glass { background: white !important; border: none !important; box-shadow: none !important; }
        }
      `}</style>
      <div className="max-w-4xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
          {/* Main column */}
          <div className="space-y-5 min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 print-hide">
              <Link
                to="/knowledge"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Base de Conhecimento
              </Link>
            </div>

            {articleQuery.isLoading ? (
              <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
                Carregando artigo...
              </div>
            ) : !article ? (
              <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
                Artigo não encontrado.
              </div>
            ) : (
              <div className="space-y-5">
                {/* Header card */}
                <div className="glass space-y-3 rounded-2xl p-6 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {article.category_name && (
                          <span className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <BookOpen className="h-2.5 w-2.5" />
                            {article.category_name}
                          </span>
                        )}
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_CLASS[article.status])}>
                          {STATUS_LABELS[article.status]}
                        </span>
                        <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {VISIBILITY_LABELS[article.visibility]}
                        </span>
                      </div>
                      <h1 className="text-xl font-semibold leading-snug">{article.title}</h1>
                      {article.summary && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{article.summary}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 print-hide">
                      {article.status === "DRAFT" && (isAdminOrTech || article.author === user?.id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewMutation.mutate()}
                          disabled={reviewMutation.isPending}
                        >
                          Solicitar Revisão
                        </Button>
                      )}
                      {article.status === "REVIEW" && isAdminOrTech && (
                        <Button
                          size="sm"
                          onClick={() => publishMutation.mutate()}
                          disabled={publishMutation.isPending}
                        >
                          Aprovar e Publicar
                        </Button>
                      )}
                      {article.status === "DRAFT" && isAdminOrTech && (
                        <Button size="sm" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
                          Publicar
                        </Button>
                      )}
                      {isAdminOrTech && (
                        <Button
                          size="sm" variant="outline" className="gap-1.5"
                          onClick={() => navigate({ to: "/knowledge/$id/edit", params: { id } })}
                        >
                          <Edit className="h-3.5 w-3.5" /> Editar
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => window.print()}
                        title="Imprimir artigo"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
                    {article.author_name && <span>Por <strong className="text-foreground">{article.author_name}</strong></span>}
                    <span>{formatDate(article.created_at)}</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.views_count} visualizações</span>
                    {helpfulPct !== null && (
                      <span className="text-success font-medium">{helpfulPct}% útil</span>
                    )}
                    {article.version > 1 && <span>v{article.version}</span>}
                  </div>

                  {/* Tags */}
                  {(article.tag_names ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {article.tag_names!.map((tag) => (
                        <span key={tag} className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          <Tag className="h-2.5 w-2.5" />{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Article body */}
                <div className="glass rounded-2xl p-6 shadow-card">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-foreground [&_a]:text-primary [&_pre]:bg-muted/60 [&_pre]:rounded-lg [&_code]:text-xs"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: renderContent(article.content) }}
                  />
                </div>

                {/* Feedback */}
                <div className="glass rounded-2xl p-5 shadow-card print-hide">
                  <p className="text-sm font-medium mb-3">Este artigo foi útil?</p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline" size="sm" className="gap-1.5"
                      onClick={() => rateMutation.mutate(true)}
                      disabled={rateMutation.isPending}
                    >
                      <ThumbsUp className="h-3.5 w-3.5 text-success" /> Útil ({article.helpful_count})
                    </Button>
                    <Button
                      variant="outline" size="sm" className="gap-1.5"
                      onClick={() => rateMutation.mutate(false)}
                      disabled={rateMutation.isPending}
                    >
                      <ThumbsDown className="h-3.5 w-3.5 text-destructive" /> Não útil ({article.not_helpful_count})
                    </Button>
                  </div>
                </div>

                {/* Attachments */}
                <div className="glass rounded-2xl p-5 shadow-card space-y-3 print-hide">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Paperclip className="h-4 w-4" /> Anexos
                    </p>
                    {isAdminOrTech && (
                      <>
                        <Button
                          size="sm" variant="outline" className="gap-1.5"
                          onClick={() => fileUploadRef.current?.click()}
                          disabled={uploadAttachmentMutation.isPending}
                        >
                          <Upload className="h-3.5 w-3.5" /> Enviar
                        </Button>
                        <input
                          ref={fileUploadRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) { uploadAttachmentMutation.mutate(f); e.target.value = ""; }
                          }}
                        />
                      </>
                    )}
                  </div>
                  {attachmentsQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Carregando...</p>
                  ) : (attachmentsQuery.data ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {attachmentsQuery.data!.map((att: ArticleAttachment) => (
                        <li key={att.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <a
                            href={att.file.startsWith("http") ? att.file : `${API_BASE_URL.replace(/\/api$/, "")}${att.file}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 text-xs text-primary hover:underline truncate"
                          >
                            {att.name}
                          </a>
                          <span className="text-[10px] text-muted-foreground shrink-0">{formatBytes(att.size)}</span>
                          {isAdminOrTech && (
                            <Button
                              size="sm" variant="ghost" className="h-6 px-1.5 text-destructive hover:text-destructive shrink-0"
                              onClick={() => deleteAttachmentMutation.mutate(att.id)}
                              disabled={deleteAttachmentMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Version history (admin/tech only) */}
                {isAdminOrTech && (
                  <div className="glass rounded-2xl p-5 shadow-card space-y-3 print-hide">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-semibold w-full text-left"
                      onClick={() => setShowHistory((v) => !v)}
                    >
                      <Clock className="h-4 w-4" />
                      Histórico de versões
                      {showHistory ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
                    </button>

                    {showHistory && (
                      <>
                        {versionsQuery.isLoading ? (
                          <p className="text-xs text-muted-foreground">Carregando...</p>
                        ) : (versionsQuery.data ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma versão anterior registrada.</p>
                        ) : (
                          <ul className="space-y-2">
                            {versionsQuery.data!.map((v) => (
                              <li key={v.id} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-medium">v{v.version} — {v.title}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {v.changed_by_name ?? "—"} · {formatDate(v.created_at)}
                                      {v.change_summary && <> · <em>{v.change_summary}</em></>}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm" variant="outline" className="shrink-0 text-xs h-7"
                                    onClick={() => setDiffVersion(diffVersion?.id === v.id ? null : v)}
                                  >
                                    {diffVersion?.id === v.id ? "Fechar diff" : "Ver diff"}
                                  </Button>
                                </div>
                                {diffVersion?.id === v.id && article && (
                                  <div className="mt-3 rounded-lg overflow-auto max-h-64 border border-border/50 bg-background text-xs font-mono">
                                    {computeDiff(v.content, article.content).map((line, idx) => (
                                      <div
                                        // eslint-disable-next-line react/no-array-index-key
                                        key={idx}
                                        className={cn(
                                          "px-3 py-0.5 whitespace-pre",
                                          line.type === "add" && "bg-green-500/10 text-green-700 dark:text-green-400",
                                          line.type === "remove" && "bg-red-500/10 text-red-700 dark:text-red-400",
                                        )}
                                      >
                                        {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
                                        {line.line}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Internal comments (admin/tech only) */}
                {isAdminOrTech && (
                  <div className="glass rounded-2xl p-5 shadow-card bg-yellow-500/5 border-yellow-500/20 space-y-3 print-hide">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Comentários internos da equipe (não visíveis ao público)
                    </p>

                    {internalCommentsQuery.isLoading ? (
                      <p className="text-xs text-muted-foreground">Carregando...</p>
                    ) : internalComments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum comentário interno.</p>
                    ) : (
                      <ul className="space-y-2">
                        {internalComments.map((comment) => (
                          <li key={comment.id} className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">{comment.author_name ?? "—"}</span>
                                <span className="text-[10px] text-muted-foreground">{formatDate(comment.created_at)}</span>
                              </div>
                              <p className="text-xs text-foreground whitespace-pre-wrap">{comment.content}</p>
                            </div>
                            {comment.author === user?.id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-xs text-destructive hover:text-destructive shrink-0"
                                onClick={() => deleteCommentMutation.mutate(comment.id)}
                                disabled={deleteCommentMutation.isPending}
                              >
                                Excluir
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="space-y-2 pt-1">
                      <Textarea
                        rows={2}
                        placeholder="Adicionar comentário interno..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="text-xs resize-none"
                      />
                      <Button
                        size="sm"
                        onClick={() => addCommentMutation.mutate(newComment)}
                        disabled={addCommentMutation.isPending || !newComment.trim()}
                      >
                        Comentar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar: related articles */}
          {article && (
            <aside className="space-y-4 hidden lg:block print-hide">
              <div className="glass rounded-2xl p-4 shadow-card sticky top-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Artigos relacionados
                </h3>
                {relatedQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Carregando...</p>
                ) : (relatedQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum artigo relacionado.</p>
                ) : (
                  <ul className="space-y-2">
                    {relatedQuery.data!.map((a) => (
                      <li key={a.id}>
                        <Link
                          to="/knowledge/$id"
                          params={{ id: a.id }}
                          className="block text-xs text-foreground hover:text-primary transition-colors leading-snug"
                        >
                          {a.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Article stats */}
                <div className="mt-4 border-t border-border pt-3 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Versão</span>
                    <span className="font-medium">{article.version}</span>
                  </div>
                  {article.published_at && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Publicado</span>
                      <span className="font-medium">{formatDate(article.published_at)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Visibilidade</span>
                    <span className="font-medium">{VISIBILITY_LABELS[article.visibility]}</span>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </AppShell>
  );
}
