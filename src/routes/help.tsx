import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, HelpCircle, MessageSquare, Search, LifeBuoy, ExternalLink } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listKnowledgeArticles, listForumTopics, listDoubtsQuestions } from "@/services/knowledgeService";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Central de Ajuda · Stratos Suite" }] }),
  component: HelpPage,
});

function HelpPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const hasQuery = debouncedQuery.trim().length >= 3;

  const kbQuery = useQuery({
    queryKey: ["help-kb", debouncedQuery],
    queryFn: () => listKnowledgeArticles({ search: debouncedQuery, status: "PUBLISHED" }),
    enabled: hasQuery,
  });

  const forumQuery = useQuery({
    queryKey: ["help-forum", debouncedQuery],
    queryFn: () => listForumTopics({ search: debouncedQuery }),
    enabled: hasQuery,
  });

  const doubtsQuery = useQuery({
    queryKey: ["help-doubts", debouncedQuery],
    queryFn: () => listDoubtsQuestions({ search: debouncedQuery }),
    enabled: hasQuery,
  });

  const popularQuery = useQuery({
    queryKey: ["help-popular"],
    queryFn: () => listKnowledgeArticles({ status: "PUBLISHED", ordering: "-views_count" }),
    enabled: !hasQuery,
    select: (data) => data.slice(0, 6),
  });

  const kbResults = kbQuery.data ?? [];
  const forumResults = forumQuery.data ?? [];
  const doubtsResults = doubtsQuery.data ?? [];
  const totalResults = kbResults.length + forumResults.length + doubtsResults.length;

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          title="Central de Ajuda"
          subtitle="Encontre respostas, artigos e documentação."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <LifeBuoy className="h-4 w-4" />
            </span>
          }
        />

        {/* Search hero */}
        <div className="glass rounded-2xl p-8 shadow-card text-center space-y-4">
          <h2 className="text-lg font-semibold">Como podemos ajudar?</h2>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-10 h-11 text-base"
              placeholder="Pesquisar artigos, perguntas, tópicos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          {hasQuery && (
            <p className="text-xs text-muted-foreground">
              {kbQuery.isLoading || forumQuery.isLoading || doubtsQuery.isLoading
                ? "Buscando..."
                : `${totalResults} resultado(s) para "${debouncedQuery}"`}
            </p>
          )}
        </div>

        {/* Search results */}
        {hasQuery && (
          <div className="grid gap-4 md:grid-cols-3">
            {/* KB results */}
            <div className="glass rounded-2xl p-4 shadow-card space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="h-4 w-4 text-primary" /> Base de Conhecimento
                <span className="ml-auto text-xs text-muted-foreground">{kbResults.length}</span>
              </div>
              {kbQuery.isLoading ? <p className="text-xs text-muted-foreground">Buscando...</p>
               : kbResults.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum artigo encontrado.</p>
               : kbResults.slice(0, 5).map((a) => (
                <Link key={a.id} to="/knowledge/$id" params={{ id: a.id }}
                  className="block text-sm text-foreground hover:text-primary transition-colors leading-snug py-1 border-b border-border/40 last:border-0">
                  {a.title}
                </Link>
              ))}
            </div>

            {/* Forum results */}
            <div className="glass rounded-2xl p-4 shadow-card space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-primary" /> Fórum
                <span className="ml-auto text-xs text-muted-foreground">{forumResults.length}</span>
              </div>
              {forumQuery.isLoading ? <p className="text-xs text-muted-foreground">Buscando...</p>
               : forumResults.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum tópico encontrado.</p>
               : forumResults.slice(0, 5).map((t) => (
                <Link key={t.id} to="/forum/$id" params={{ id: t.id }}
                  className="block text-sm text-foreground hover:text-primary transition-colors leading-snug py-1 border-b border-border/40 last:border-0">
                  {t.title}
                </Link>
              ))}
            </div>

            {/* Doubts results */}
            <div className="glass rounded-2xl p-4 shadow-card space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <HelpCircle className="h-4 w-4 text-primary" /> Central de Dúvidas
                <span className="ml-auto text-xs text-muted-foreground">{doubtsResults.length}</span>
              </div>
              {doubtsQuery.isLoading ? <p className="text-xs text-muted-foreground">Buscando...</p>
               : doubtsResults.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma dúvida encontrada.</p>
               : doubtsResults.slice(0, 5).map((q) => (
                <Link key={q.id} to="/doubts/$id" params={{ id: q.id }}
                  className="block text-sm text-foreground hover:text-primary transition-colors leading-snug py-1 border-b border-border/40 last:border-0">
                  {q.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Category cards (no search) */}
        {!hasQuery && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { to: "/knowledge" as const, icon: BookOpen, label: "Base de Conhecimento", desc: "Artigos, guias e documentação" },
                { to: "/forum" as const, icon: MessageSquare, label: "Fórum", desc: "Perguntas e respostas da comunidade" },
                { to: "/doubts" as const, icon: HelpCircle, label: "Central de Dúvidas", desc: "Suporte direto e atendimento" },
              ].map(({ to, icon: Icon, label, desc }) => (
                <Link key={to} to={to}
                  className="glass group flex flex-col items-center gap-3 rounded-2xl p-6 shadow-card text-center hover:border-primary/40 transition-colors">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Popular articles */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Artigos mais acessados
              </h3>
              {popularQuery.isLoading ? (
                <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">Carregando...</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(popularQuery.data ?? []).map((a) => (
                    <Link key={a.id} to="/knowledge/$id" params={{ id: a.id }}
                      className="glass flex items-start gap-3 rounded-2xl p-4 shadow-card hover:border-primary/30 transition-colors">
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug line-clamp-2">{a.title}</p>
                        {a.category_name && <p className="text-xs text-muted-foreground mt-0.5">{a.category_name}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="glass rounded-2xl p-6 shadow-card text-center space-y-3">
              <p className="text-sm font-medium">Não encontrou o que procura?</p>
              <p className="text-xs text-muted-foreground">Abra um chamado e nossa equipe irá ajudar você.</p>
              <Button asChild size="sm" className="gap-1.5">
                <Link to="/tickets/new"><ExternalLink className="h-3.5 w-3.5" /> Abrir um chamado</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
