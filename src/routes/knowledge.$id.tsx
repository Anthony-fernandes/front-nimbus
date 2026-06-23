import DOMPurify from "dompurify";
import { marked } from "marked";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BookOpen, Edit, Eye, Printer, Tag, ThumbsDown, ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { hasAnyPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  getKnowledgeArticle,
  listKnowledgeArticles,
  publishArticle,
  rateArticle,
} from "@/services/knowledgeService";
import { getStoredUser } from "@/services/session";

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
};

const STATUS_CLASS: Record<string, string> = {
  PUBLISHED: "bg-success/15 text-success",
  DRAFT: "bg-warning/15 text-warning",
  ARCHIVED: "bg-muted text-muted-foreground",
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

  const article = articleQuery.data;

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

  return (
    <AppShell>
      <div className="max-w-4xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
          {/* Main column */}
          <div className="space-y-5 min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2">
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
                    <div className="flex gap-2 shrink-0">
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
                <div className="glass rounded-2xl p-5 shadow-card">
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
              </div>
            )}
          </div>

          {/* Sidebar: related articles */}
          {article && (
            <aside className="space-y-4 hidden lg:block">
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
