import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { hasAnyPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  getKnowledgeArticle,
  publishArticle,
  rateArticle,
} from "@/services/knowledgeService";
import { getStoredUser } from "@/services/session";

export const Route = createFileRoute("/knowledge/$id")({
  head: () => ({ meta: [{ title: "Artigo · Nimbus" }] }),
  component: KnowledgeArticlePage,
});

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function KnowledgeArticlePage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const isAdminOrTech = hasAnyPermission(user, ["tickets.viewAll", "tickets.viewAssigned"]);

  const articleQuery = useQuery({
    queryKey: ["knowledge-article", id],
    queryFn: () => getKnowledgeArticle(id),
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

  return (
    <AppShell>
      <div className="max-w-3xl space-y-5">
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
            <div className="glass space-y-3 rounded-2xl p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {article.category_name ? (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted/60 text-muted-foreground">
                        {article.category_name}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        article.status === "PUBLISHED"
                          ? "bg-success/15 text-success"
                          : article.status === "DRAFT"
                            ? "bg-warning/15 text-warning"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {article.status === "PUBLISHED"
                        ? "Publicado"
                        : article.status === "DRAFT"
                          ? "Rascunho"
                          : "Arquivado"}
                    </span>
                  </div>
                  <h1 className="text-xl font-semibold">{article.title}</h1>
                  {article.summary ? (
                    <p className="text-sm text-muted-foreground">{article.summary}</p>
                  ) : null}
                </div>
                {article.status === "DRAFT" && isAdminOrTech ? (
                  <Button
                    size="sm"
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending}
                  >
                    Publicar
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground border-t border-border pt-3">
                {article.author_name ? <span>Por {article.author_name}</span> : null}
                <span>{formatDate(article.created_at)}</span>
                <span>{article.views_count} visualizações</span>
                {article.tag_names?.length ? (
                  <span>Tags: {article.tag_names.join(", ")}</span>
                ) : null}
              </div>
            </div>

            {/* Article content */}
            <div className="glass rounded-2xl p-6 shadow-card">
              <div
                className="prose prose-sm max-w-none text-foreground [&_a]:text-primary"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            </div>

            {/* Helpful rating */}
            <div className="glass rounded-2xl p-5 shadow-card">
              <p className="text-sm font-medium mb-3">Este artigo foi útil?</p>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => rateMutation.mutate(true)}
                  disabled={rateMutation.isPending}
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> Útil ({article.helpful_count})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => rateMutation.mutate(false)}
                  disabled={rateMutation.isPending}
                >
                  <ThumbsDown className="h-3.5 w-3.5" /> Não útil ({article.not_helpful_count})
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
