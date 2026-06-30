import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, MessagesSquare, Plus, Search, Shield, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { MarkdownEditor } from "@/components/app/MarkdownEditor";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createForumTopic, listForumCategories, listForumTopics, listKnowledgeArticles,
} from "@/services/knowledgeService";
import { getStoredUser } from "@/services/session";

export const Route = createFileRoute("/forum")({
  head: () => ({ meta: [{ title: "Fórum · Nimbus" }] }),
  component: ForumPage,
});

function fmtDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

type FilterTab = "recentes" | "sem-resposta" | "em-alta" | "mais-votados";

function ForumPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const user = getStoredUser();
  const isAdmin = user?.is_staff || user?.is_superuser;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "", tags: "", visibility: "todos" });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("recentes");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [kbSuggestions, setKbSuggestions] = useState<{ id: string; title: string; slug?: string }[]>([]);
  const kbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const catsQ = useQuery({ queryKey: ["forum-categories"], queryFn: listForumCategories });
  const topicsQ = useQuery({
    queryKey: ["forum-topics", selectedCategory],
    queryFn: () => listForumTopics(selectedCategory ? { category: selectedCategory } : undefined),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createForumTopic({
        title: form.title,
        content: form.content,
        category: form.category || undefined,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        visibility: form.visibility as "interna" | "publica_cliente" | "todos",
      } as Parameters<typeof createForumTopic>[0]),
    onSuccess: () => {
      toast.success("Tópico criado.");
      setDialogOpen(false);
      setForm({ title: "", content: "", category: "", tags: "", visibility: "todos" });
      setKbSuggestions([]);
      void qc.invalidateQueries({ queryKey: ["forum-topics"] });
    },
    onError: () => toast.error("Não foi possível criar o tópico."),
  });

  // KB suggestions on title typing
  useEffect(() => {
    if (kbTimer.current) clearTimeout(kbTimer.current);
    if (form.title.trim().length < 3) { setKbSuggestions([]); return; }
    kbTimer.current = setTimeout(async () => {
      try {
        const res = await listKnowledgeArticles({ search: form.title });
        setKbSuggestions((Array.isArray(res) ? res : []).slice(0, 3) as { id: string; title: string; slug?: string }[]);
      } catch { setKbSuggestions([]); }
    }, 300);
    return () => { if (kbTimer.current) clearTimeout(kbTimer.current); };
  }, [form.title]);

  const categories = catsQ.data ?? [];
  const raw = topicsQ.data ?? [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const topics = [...raw]
    .filter((t) => !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()))
    .filter((t) => !selectedTag || ((t as unknown as { tags?: string[] }).tags ?? []).includes(selectedTag))
    .sort((a, b) => {
      if (filter === "sem-resposta") {
        const aNo = (a.replies_count ?? 0) === 0 || !a.best_answer;
        const bNo = (b.replies_count ?? 0) === 0 || !b.best_answer;
        if (aNo && !bNo) return -1;
        if (!aNo && bNo) return 1;
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }
      if (filter === "em-alta") {
        const aR = new Date(a.created_at ?? 0) >= sevenDaysAgo;
        const bR = new Date(b.created_at ?? 0) >= sevenDaysAgo;
        if (aR && !bR) return -1;
        if (!aR && bR) return 1;
        return (b.views_count ?? 0) - (a.views_count ?? 0);
      }
      if (filter === "mais-votados") {
        return ((b as unknown as { likes_count?: number }).likes_count ?? 0) - ((a as unknown as { likes_count?: number }).likes_count ?? 0);
      }
      // recentes: pinned first
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "recentes", label: "Recentes" },
    { key: "sem-resposta", label: "Sem resposta" },
    { key: "em-alta", label: "Em alta" },
    { key: "mais-votados", label: "Mais votados" },
  ];

  if (pathname !== "/forum") return <Outlet />;

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Fórum"
          subtitle="Tire dúvidas e troque experiências com a equipe."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <MessagesSquare className="h-4 w-4" />
            </span>
          }
          actions={
            <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Fazer pergunta
            </Button>
          }
        />

        {/* Top bar: tabs + search + category select */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === tab.key ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {/* Category filter */}
            <div className="flex items-center gap-0.5">
              {[{ id: null, name: "Todas" }, ...categories].map((cat) => (
                <button
                  key={cat.id ?? "all"}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                    selectedCategory === cat.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {isAdmin && (
              <Link
                to="/forum/moderation"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-orange-500/10 hover:text-orange-400 transition-colors"
              >
                <Shield className="h-3.5 w-3.5" /> Moderação
              </Link>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input className="pl-8 h-8 text-sm w-52" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Tag filter chip */}
        {selectedTag && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs font-medium text-blue-400">
              <Tag className="h-3 w-3" /> {selectedTag}
              <button type="button" onClick={() => setSelectedTag(null)} className="ml-1 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        {/* Table */}
        {topicsQ.isLoading ? (
          <div className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : topics.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-xl p-12 text-center">
            <MessagesSquare className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma pergunta encontrada.</p>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Fazer a primeira pergunta
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card/30">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_72px_72px_72px_180px] border-b border-border/50 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Pergunta</span>
              <span className="text-center">Votos</span>
              <span className="text-center">Respostas</span>
              <span className="text-center">Visitas</span>
              <span className="text-right">Autor · Data</span>
            </div>
            {topics.map((topic) => {
              const tags = (topic as unknown as { tags?: string[] }).tags ?? [];
              const votes = ((topic as unknown as { likes_count?: number }).likes_count ?? 0);
              const hasAccepted = !!topic.best_answer;

              return (
                <div key={topic.id} className="grid grid-cols-[1fr_72px_72px_72px_180px] items-center border-b border-border/30 last:border-0 px-4 py-3 hover:bg-muted/20 transition-colors gap-x-2">
                  {/* Title + tags */}
                  <div className="min-w-0">
                    <Link to="/forum/$id" params={{ id: topic.id }} className="group block">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-snug">
                        {topic.is_pinned && <span className="mr-1">📌</span>}
                        {topic.is_locked && <span className="mr-1">🔒</span>}
                        {topic.title}
                      </p>
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {topic.category_name && (
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{topic.category_name}</span>
                      )}
                      {tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => { setSelectedTag(tag); void navigate({ to: "/forum/tags/$tag", params: { tag } }); }}
                          className="rounded bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Votes */}
                  <div className={cn("text-center text-sm font-semibold tabular-nums", votes > 0 ? "text-orange-400" : "text-muted-foreground")}>
                    {votes}
                  </div>

                  {/* Answers */}
                  <div className={cn(
                    "text-center text-sm font-semibold tabular-nums rounded px-1",
                    hasAccepted ? "text-green-500 bg-green-500/10" : (topic.replies_count ?? 0) > 0 ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {topic.replies_count ?? 0}
                  </div>

                  {/* Views */}
                  <div className="text-center text-sm tabular-nums text-muted-foreground">
                    {topic.views_count ?? 0}
                  </div>

                  {/* Author + date */}
                  <div className="text-right text-[11px] text-muted-foreground leading-snug">
                    {topic.author_name && <span className="font-medium text-foreground block">{topic.author_name}</span>}
                    <span>{fmtDate(topic.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!topicsQ.isLoading && topics.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {topics.length} {topics.length === 1 ? "pergunta" : "perguntas"}
          </p>
        )}
      </div>

      {/* Create topic dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setKbSuggestions([]); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fazer uma pergunta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Título <span className="text-muted-foreground text-xs font-normal">— seja específico como se estivesse fazendo a pergunta para alguém</span></Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Como configurar autenticação SSO no ambiente de produção?"
                className="text-sm"
              />
              {/* KB suggestions */}
              {kbSuggestions.length > 0 && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3 text-blue-400" />
                    Artigos relacionados na Base de Conhecimento — verifique antes de criar:
                  </p>
                  <ul className="space-y-1">
                    {kbSuggestions.map((a) => (
                      <li key={a.id}>
                        <Link to="/knowledge/$slug" params={{ slug: a.slug ?? a.id }} className="text-xs text-blue-400 underline underline-offset-2 hover:opacity-80" target="_blank" rel="noopener noreferrer">
                          {a.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo <span className="text-muted-foreground text-xs font-normal">— descreva o problema em detalhes</span></Label>
              <MarkdownEditor value={form.content} onChange={(v) => setForm((f) => ({ ...f, content: v }))} placeholder="Descreva o contexto, o que você já tentou, e o que espera como resposta..." rows={10} />
            </div>
            <div className="space-y-1.5">
              <Label>Tags <span className="text-muted-foreground text-xs font-normal">(separadas por vírgula)</span></Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="Ex: rh, ti, processo, onboarding"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Visibilidade</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm((f) => ({ ...f, visibility: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="interna">Interna (equipe)</SelectItem>
                  <SelectItem value="publica_cliente">Clientes (portal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.title.trim() || !form.content.trim()}>
              {createMut.isPending ? "Publicando..." : "Publicar pergunta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
