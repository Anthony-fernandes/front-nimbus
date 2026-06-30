import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, MessagesSquare, Pin, Tag, ThumbsUp } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { cn } from "@/lib/utils";
import { listForumTopics } from "@/services/knowledgeService";

export const Route = createFileRoute("/forum/tags/$tag")({
  head: () => ({ meta: [{ title: "Tag · Fórum · NimbusDesk" }] }),
  component: ForumTagPage,
});

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ForumTagPage() {
  const { tag } = Route.useParams();

  const topicsQuery = useQuery({
    queryKey: ["forum-topics-tag", tag],
    queryFn: () => listForumTopics({ tag }),
  });

  const topics = topicsQuery.data ?? [];

  return (
    <AppShell>
      <div className="max-w-4xl space-y-5">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/forum" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Fórum
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium flex items-center gap-1">
            <Tag className="h-3 w-3" /> {tag}
          </span>
        </nav>

        <PageHeader
          title={`Tag: ${tag}`}
          subtitle={`Tópicos marcados com a tag "${tag}"`}
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Tag className="h-4 w-4" />
            </span>
          }
        />

        {topicsQuery.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Carregando tópicos...
          </div>
        ) : topics.length === 0 ? (
          <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
            <MessagesSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum tópico encontrado com a tag "{tag}".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => {
              const topicTags = (topic as unknown as { tags?: string[] }).tags ?? [];
              const likesCount = (topic as unknown as { likes_count?: number }).likes_count ?? 0;
              return (
                <div
                  key={topic.id}
                  className={cn(
                    "glass flex gap-0 rounded-2xl shadow-card transition-colors hover:border-primary/40 overflow-hidden",
                    topic.is_pinned && "bg-primary/[0.03]",
                  )}
                >
                  {/* Stats column */}
                  <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-3 border-r border-border/50 py-4 px-2">
                    {topic.best_answer ? (
                      <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success leading-tight text-center">
                        Respondido
                      </span>
                    ) : null}
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-base font-bold text-foreground leading-none">
                        {topic.replies_count ?? 0}
                      </span>
                      <span className="text-[10px] text-muted-foreground">respostas</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-base font-bold text-foreground leading-none">
                        {topic.views_count ?? 0}
                      </span>
                      <span className="text-[10px] text-muted-foreground">visitas</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-base font-bold text-foreground leading-none flex items-center gap-0.5">
                        <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                        {likesCount}
                      </span>
                      <span className="text-[10px] text-muted-foreground">votos</span>
                    </div>
                  </div>

                  {/* Content column */}
                  <Link
                    to="/forum/$id"
                    params={{ id: topic.id }}
                    className="flex flex-1 flex-col gap-1.5 px-4 py-3 min-w-0"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {topic.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                      {topic.is_locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                      <span className="font-semibold text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">
                        {topic.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {topic.content}
                    </p>
                    {topicTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {topicTags.map((t) => (
                          <span
                            key={t}
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                              t === tag
                                ? "bg-primary/20 text-primary"
                                : "bg-secondary/20 text-secondary-foreground",
                            )}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {topic.category_name ? (
                        <span className="flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 font-medium">
                          <Tag className="h-2.5 w-2.5" />
                          {topic.category_name}
                        </span>
                      ) : null}
                      <span className="ml-auto flex items-center gap-1">
                        {topic.author_name ? (
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 font-medium">
                            {topic.author_name}
                          </span>
                        ) : null}
                        <span>{formatDate(topic.created_at)}</span>
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
