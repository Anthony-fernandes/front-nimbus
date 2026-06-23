import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Lock, MessagesSquare, Pin, Plus, Search, Tag, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { MarkdownEditor } from "@/components/app/MarkdownEditor";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createForumTopic,
  listForumCategories,
  listForumTopics,
  listKnowledgeArticles,
} from "@/services/knowledgeService";

export const Route = createFileRoute("/forum")({
  head: () => ({ meta: [{ title: "Fórum · Nimbus" }] }),
  component: ForumPage,
});

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type FilterTab = "recentes" | "sem-resposta" | "em-alta" | "mais-votados";

interface KbSuggestion {
  id: string;
  title: string;
  slug?: string;
}

function ForumPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "", tags: "" });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("recentes");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // KB suggestions state
  const [kbSuggestions, setKbSuggestions] = useState<KbSuggestion[]>([]);
  const kbDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["forum-categories"],
    queryFn: listForumCategories,
  });

  const topicsQuery = useQuery({
    queryKey: ["forum-topics", selectedCategory],
    queryFn: () => listForumTopics(selectedCategory ? { category: selectedCategory } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createForumTopic({
        title: form.title,
        content: form.content,
        category: form.category,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      } as Parameters<typeof createForumTopic>[0]),
    onSuccess: () => {
      toast.success("Tópico criado com sucesso.");
      setDialogOpen(false);
      setForm({ title: "", content: "", category: "", tags: "" });
      setKbSuggestions([]);
      void queryClient.invalidateQueries({ queryKey: ["forum-topics"] });
    },
    onError: () => toast.error("Não foi possível criar o tópico."),
  });

  // KB suggestions debounce on title change
  useEffect(() => {
    if (kbDebounceRef.current) clearTimeout(kbDebounceRef.current);
    if (form.title.trim().length < 3) {
      setKbSuggestions([]);
      return;
    }
    kbDebounceRef.current = setTimeout(async () => {
      try {
        const results = await listKnowledgeArticles({ search: form.title });
        const articles = Array.isArray(results) ? results : [];
        setKbSuggestions(articles.slice(0, 3) as KbSuggestion[]);
      } catch {
        setKbSuggestions([]);
      }
    }, 300);
    return () => {
      if (kbDebounceRef.current) clearTimeout(kbDebounceRef.current);
    };
  }, [form.title]);

  const categories = categoriesQuery.data ?? [];
  const rawTopics = topicsQuery.data ?? [];

  // Client-side filter by search
  const afterSearch = search.trim()
    ? rawTopics.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
    : rawTopics;

  // Client-side filter by selected tag
  const afterTag = selectedTag
    ? afterSearch.filter((t) => {
        const tags = (t as unknown as { tags?: string[] }).tags ?? [];
        return tags.includes(selectedTag);
      })
    : afterSearch;

  // Filter tabs logic
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const topics = [...afterTag].sort((a, b) => {
    if (filter === "sem-resposta") {
      // Show topics without answers first (replies_count === 0 or no best_answer)
      const aNoAnswer = (a.replies_count ?? 0) === 0 || !a.best_answer;
      const bNoAnswer = (b.replies_count ?? 0) === 0 || !b.best_answer;
      if (aNoAnswer && !bNoAnswer) return -1;
      if (!aNoAnswer && bNoAnswer) return 1;
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    }
    if (filter === "em-alta") {
      // Last 7 days first, then sort by views desc
      const aRecent = new Date(a.created_at ?? 0) >= sevenDaysAgo;
      const bRecent = new Date(b.created_at ?? 0) >= sevenDaysAgo;
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;
      return (b.views_count ?? 0) - (a.views_count ?? 0);
    }
    if (filter === "mais-votados") {
      return (
        ((b as unknown as { likes_count?: number }).likes_count ?? 0) -
        ((a as unknown as { likes_count?: number }).likes_count ?? 0)
      );
    }
    // recentes: pinned first, then by date desc
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "recentes", label: "Recentes" },
    { key: "sem-resposta", label: "Sem resposta" },
    { key: "em-alta", label: "Em alta" },
    { key: "mais-votados", label: "Mais votados" },
  ];

  if (pathname !== "/forum") return <Outlet />;

  return (
    <AppShell>
      <div className="max-w-5xl space-y-5">
        <PageHeader
          title="Fórum"
          subtitle="Discussões e troca de experiências entre a equipe."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <MessagesSquare className="h-4 w-4" />
            </span>
          }
          actions={
            <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Novo tópico
            </Button>
          }
        />

        <div className="flex gap-5">
          {/* Category sidebar */}
          <aside className="w-48 shrink-0 space-y-1">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                selectedCategory === null
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  selectedCategory === cat.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {cat.name}
              </button>
            ))}
          </aside>

          {/* Main area */}
          <div className="flex-1 space-y-3">
            {/* Top bar: search + filter tabs */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Buscar tópicos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilter(tab.key)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      filter === tab.key
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active tag filter chip */}
            {selectedTag ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Filtrando por tag: {selectedTag}
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className="ml-1 rounded-full hover:bg-primary/20 p-0.5"
                    aria-label="Remover filtro de tag"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            ) : null}

            {/* Topic list */}
            {topicsQuery.isLoading ? (
              <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
                Carregando tópicos...
              </div>
            ) : topics.length === 0 ? (
              <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
                <MessagesSquare className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum tópico encontrado.</p>
              </div>
            ) : (
              topics.map((topic) => {
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
                      {/* Respondido badge */}
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
                      {/* Title row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {topic.is_pinned ? (
                          <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
                        ) : null}
                        {topic.is_locked ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : null}
                        <span className="font-semibold text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">
                          {topic.title}
                        </span>
                      </div>

                      {/* Excerpt */}
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {topic.content}
                      </p>

                      {/* Tags */}
                      {topicTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {topicTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedTag(tag === selectedTag ? null : tag);
                              }}
                              className="rounded-md bg-secondary/20 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground hover:bg-secondary/40 transition-colors"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {/* Footer */}
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
              })
            )}
          </div>
        </div>
      </div>

      {/* Create topic dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setKbSuggestions([]);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo tópico</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Título do tópico"
              />
              {/* KB article suggestions */}
              {kbSuggestions.length > 0 ? (
                <div className="mt-1.5 rounded-xl border border-border bg-muted/40 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    Encontramos artigos relacionados — verifique antes de criar um novo tópico:
                  </p>
                  <ul className="space-y-1">
                    {kbSuggestions.map((article) => (
                      <li key={article.id}>
                        <Link
                          to="/knowledge/$slug"
                          params={{ slug: article.slug ?? article.id }}
                          className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {article.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Conteúdo</Label>
              <MarkdownEditor
                value={form.content}
                onChange={(v) => setForm((f) => ({ ...f, content: v }))}
                placeholder="Descreva o assunto..."
                rows={8}
              />
            </div>
            <div className="space-y-1">
              <Label>Tags</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="Ex: dúvida, processo, ti (separadas por vírgula)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.title}
            >
              Criar tópico
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
