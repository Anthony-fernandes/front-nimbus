import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, HelpCircle, LifeBuoy, MessageSquare, Search, Ticket } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listDoubtsQuestions,
  listForumTopics,
  listKnowledgeArticles,
} from "@/services/knowledgeService";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Central de Ajuda · Nimbus" }] }),
  component: HelpPage,
});

function HelpPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.length >= 3 ? search : "");
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const isSearching = debouncedSearch.length >= 3;

  const kbQuery = useQuery({
    queryKey: ["help-kb", debouncedSearch],
    queryFn: () => listKnowledgeArticles({ search: debouncedSearch, status: "PUBLISHED" }),
    enabled: isSearching,
  });

  const forumQuery = useQuery({
    queryKey: ["help-forum", debouncedSearch],
    queryFn: () => listForumTopics({ search: debouncedSearch }),
    enabled: isSearching,
  });

  const doubtsQuery = useQuery({
    queryKey: ["help-doubts", debouncedSearch],
    queryFn: () => listDoubtsQuestions({ search: debouncedSearch }),
    enabled: isSearching,
  });

  const popularKbQuery = useQuery({
    queryKey: ["help-popular-kb"],
    queryFn: () => listKnowledgeArticles({ status: "PUBLISHED", ordering: "-views_count" }),
    enabled: !isSearching,
  });

  const popularArticles = (popularKbQuery.data ?? []).slice(0, 6);

  const kbResults = (kbQuery.data ?? []).slice(0, 5);
  const forumResults = (forumQuery.data ?? []).slice(0, 5);
  const doubtsResults = (doubtsQuery.data ?? []).slice(0, 5);

  return (
    <AppShell>
      <div className="max-w-5xl space-y-8">
        <PageHeader
          title="Central de Ajuda"
          subtitle="Encontre respostas, artigos e suporte."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <LifeBuoy className="h-4 w-4" />
            </span>
          }
        />

        {/* Hero search */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold">Como podemos ajudar?</h2>
          <p className="text-sm text-muted-foreground">Pesquise na base de conhecimento, fórum e central de dúvidas.</p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-10 h-10 text-sm"
              placeholder="Digite sua pergunta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Search results */}
        {isSearching ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* KB Results */}
            <div className="glass rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <BookOpen className="h-4 w-4 text-primary" />
                Base de Conhecimento
              </div>
              {kbQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Buscando...</p>
              ) : kbResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum resultado.</p>
              ) : (
                <ul className="space-y-2">
                  {kbResults.map((a) => (
                    <li key={a.id}>
                      <Link
                        to="/knowledge/$id"
                        params={{ id: a.id }}
                        className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity line-clamp-2"
                      >
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Forum Results */}
            <div className="glass rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <MessageSquare className="h-4 w-4 text-primary" />
                Fórum
              </div>
              {forumQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Buscando...</p>
              ) : forumResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum resultado.</p>
              ) : (
                <ul className="space-y-2">
                  {forumResults.map((t) => (
                    <li key={t.id}>
                      <Link
                        to="/forum/$id"
                        params={{ id: t.id }}
                        className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity line-clamp-2"
                      >
                        {t.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Doubts Results */}
            <div className="glass rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <HelpCircle className="h-4 w-4 text-primary" />
                Central de Dúvidas
              </div>
              {doubtsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Buscando...</p>
              ) : doubtsResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum resultado.</p>
              ) : (
                <ul className="space-y-2">
                  {doubtsResults.map((q) => (
                    <li key={q.id}>
                      <Link
                        to="/doubts/$id"
                        params={{ id: q.id }}
                        className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity line-clamp-2"
                      >
                        {q.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Category cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Link to="/knowledge" className="glass rounded-2xl p-5 space-y-2 hover:border-primary/40 transition-colors group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">Base de Conhecimento</h3>
                <p className="text-xs text-muted-foreground">Artigos e guias sobre o sistema.</p>
              </Link>
              <Link to="/forum" className="glass rounded-2xl p-5 space-y-2 hover:border-primary/40 transition-colors group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">Fórum</h3>
                <p className="text-xs text-muted-foreground">Perguntas e discussões da comunidade.</p>
              </Link>
              <Link to="/doubts" className="glass rounded-2xl p-5 space-y-2 hover:border-primary/40 transition-colors group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <HelpCircle className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">Central de Dúvidas</h3>
                <p className="text-xs text-muted-foreground">Suporte direto e perguntas técnicas.</p>
              </Link>
            </div>

            {/* Popular KB articles */}
            {popularArticles.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Artigos populares</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {popularArticles.map((a) => (
                    <Link
                      key={a.id}
                      to="/knowledge/$id"
                      params={{ id: a.id }}
                      className="glass flex items-center gap-3 rounded-xl p-3 hover:border-primary/40 transition-colors"
                    >
                      <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm font-medium line-clamp-1">{a.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Bottom CTA */}
        <div className="glass rounded-2xl p-6 text-center space-y-3 border border-border/50">
          <p className="text-sm font-medium">Não encontrou o que procura?</p>
          <p className="text-xs text-muted-foreground">Nossa equipe está pronta para ajudar você diretamente.</p>
          <Link to="/tickets/new">
            <Button className="gap-2">
              <Ticket className="h-4 w-4" />
              Abrir um chamado
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
