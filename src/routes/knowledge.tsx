import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Eye, Plus, Search, Tag } from "lucide-react";
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
import { hasPermission } from "@/lib/permissions";
import type { KnowledgeArticle } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  createKnowledgeArticle,
  listKnowledgeArticles,
  listKnowledgeCategories,
} from "@/services/knowledgeService";
import { getStoredUser } from "@/services/session";

export const Route = createFileRoute("/knowledge")({
  head: () => ({ meta: [{ title: "Base de Conhecimento · Stratos Suite" }] }),
  component: KnowledgePage,
});

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-warning/15 text-warning",
  PUBLISHED: "bg-success/15 text-success",
  ARCHIVED: "bg-muted text-muted-foreground",
};

const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: "Público",
  INTERNAL: "Interno",
  RESTRICTED: "Restrito",
};

const VISIBILITY_CLASS: Record<string, string> = {
  PUBLIC: "bg-blue-500/15 text-blue-600",
  INTERNAL: "bg-purple-500/15 text-purple-600",
  RESTRICTED: "bg-orange-500/15 text-orange-600",
};

const TEMPLATES: Record<string, { label: string; content: string }> = {
  procedure: {
    label: "Procedimento passo a passo",
    content:
      "## Objetivo\n\n## Pré-requisitos\n\n## Passo a passo\n\n1. \n2. \n3. \n\n## Resultado esperado\n",
  },
  faq: {
    label: "FAQ",
    content: "## Pergunta\n\n## Resposta\n\n## Ver também\n",
  },
  troubleshooting: {
    label: "Troubleshooting",
    content: "## Problema\n\n## Causa\n\n## Solução\n\n## Prevenção\n",
  },
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function KnowledgePage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const canCreate = hasPermission(user, "activities.create");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("PUBLISHED");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [rankingTab, setRankingTab] = useState<"all" | "published" | "most_viewed" | "most_helpful">("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    summary: "",
    content: "",
    category: "",
    status: "DRAFT" as KnowledgeArticle["status"],
    visibility: "INTERNAL" as KnowledgeArticle["visibility"],
    tags: [] as string[],
  });

  const [tagsInput, setTagsInput] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const categoriesQuery = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: listKnowledgeCategories,
  });

  const articlesQueryStatus =
    rankingTab === "published" ? "PUBLISHED"
    : rankingTab === "all" ? (statusFilter !== "all" ? statusFilter : undefined)
    : "PUBLISHED";

  const articlesQuery = useQuery({
    queryKey: [
      "knowledge-articles",
      { status: articlesQueryStatus, category: categoryFilter, search: debouncedSearch, visibility: visibilityFilter, rankingTab },
    ],
    queryFn: () =>
      listKnowledgeArticles({
        status: articlesQueryStatus,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        search: debouncedSearch || undefined,
        visibility: visibilityFilter !== "all" ? visibilityFilter : undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const parsedTags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      return createKnowledgeArticle({
        ...form,
        category: form.category || null,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Artigo criado com sucesso.");
      setDialogOpen(false);
      setForm({ title: "", summary: "", content: "", category: "", status: "DRAFT", visibility: "INTERNAL", tags: [] });
      setTagsInput("");
      void queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
    },
    onError: () => toast.error("Não foi possível criar o artigo."),
  });

  if (pathname !== "/knowledge") return <Outlet />;

  const categories = categoriesQuery.data ?? [];
  const rawArticles = articlesQuery.data ?? [];
  const articles = (() => {
    if (rankingTab === "most_viewed") {
      return [...rawArticles].sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0)).slice(0, 20);
    }
    if (rankingTab === "most_helpful") {
      return [...rawArticles]
        .filter((a) => (a.helpful_count + a.not_helpful_count) > 0)
        .sort((a, b) => {
          const ra = a.helpful_count / (a.helpful_count + a.not_helpful_count);
          const rb = b.helpful_count / (b.helpful_count + b.not_helpful_count);
          return rb - ra;
        })
        .slice(0, 20);
    }
    return rawArticles;
  })();

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Base de Conhecimento"
          subtitle="Artigos e documentação para consulta rápida."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <BookOpen className="h-4 w-4" />
            </span>
          }
          actions={
            canCreate ? (
              <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Novo artigo
              </Button>
            ) : undefined
          }
        />

        {/* Filters + ranking */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-4">
          <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
            {(["all", "published", "most_viewed", "most_helpful"] as const).map((tab) => (
              <button key={tab} type="button"
                onClick={() => setRankingTab(tab)}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  rankingTab === tab ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "all" ? "Todos" : tab === "published" ? "Publicados" : tab === "most_viewed" ? "Mais visualizados" : "Mais úteis"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8 h-8 text-sm w-48" placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PUBLISHED">Publicados</SelectItem>
                <SelectItem value="DRAFT">Rascunhos</SelectItem>
                <SelectItem value="ARCHIVED">Arquivados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Visibilidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="PUBLIC">Público</SelectItem>
                <SelectItem value="INTERNAL">Interno</SelectItem>
                <SelectItem value="RESTRICTED">Restrito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {articlesQuery.isLoading ? (
          <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">Carregando artigos...</div>
        ) : articles.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-xl p-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium text-sm">Nenhum artigo encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? `Nenhum resultado para "${search}". Tente outros termos.` : 'Crie o primeiro artigo clicando em "Novo artigo".'}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card/30">
            {/* Header */}
            <div className="grid grid-cols-[1fr_100px_100px_80px_80px_160px] border-b border-border/50 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Artigo</span>
              <span>Status</span>
              <span>Visibilidade</span>
              <span className="text-center">Visitas</span>
              <span className="text-center">Útil</span>
              <span className="text-right">Autor · Data</span>
            </div>
            {articles.map((article) => {
              const total = article.helpful_count + article.not_helpful_count;
              const helpfulPct = total > 0 ? Math.round((article.helpful_count / total) * 100) : null;
              return (
                <div
                  key={article.id}
                  className="grid grid-cols-[1fr_100px_100px_80px_80px_160px] items-center border-b border-border/30 last:border-0 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer gap-x-2"
                  onClick={() => navigate({ to: "/knowledge/$id", params: { id: article.id } })}
                >
                  {/* Title + category + tags */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium line-clamp-1 group-hover:text-primary">{article.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {article.category_name && (
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{article.category_name}</span>
                      )}
                      {article.tag_names?.map((tag) => (
                        <span key={tag} className="flex items-center gap-0.5 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          <Tag className="h-2.5 w-2.5" />{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide w-fit", STATUS_CLASS[article.status] ?? STATUS_CLASS.DRAFT)}>
                    {STATUS_LABELS[article.status] ?? article.status}
                  </span>

                  {/* Visibility */}
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide w-fit", VISIBILITY_CLASS[article.visibility] ?? "bg-muted text-muted-foreground")}>
                    {VISIBILITY_LABELS[article.visibility] ?? article.visibility}
                  </span>

                  {/* Views */}
                  <div className="flex items-center justify-center gap-1 text-sm tabular-nums text-muted-foreground">
                    <Eye className="h-3 w-3" />{article.views_count}
                  </div>

                  {/* Helpful % */}
                  <div className="text-center text-sm tabular-nums">
                    {helpfulPct !== null ? <span className="text-success font-medium">{helpfulPct}%</span> : <span className="text-muted-foreground">—</span>}
                  </div>

                  {/* Author + date */}
                  <div className="text-right text-[11px] text-muted-foreground leading-snug">
                    {article.author_name && <span className="font-medium text-foreground block">{article.author_name}</span>}
                    <span>{formatDate(article.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!articlesQuery.isLoading && articles.length > 0 && (
          <p className="text-xs text-muted-foreground">{articles.length} {articles.length === 1 ? "artigo" : "artigos"}</p>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo artigo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Título do artigo"
              />
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
              <Label>Resumo</Label>
              <Input
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Breve descrição"
              />
            </div>
            <div className="space-y-1">
              <Label>Tags</Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Ex: suporte, acesso, VPN (separadas por vírgula)"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Conteúdo</Label>
                <Select
                  onValueChange={(v) => {
                    const tpl = TEMPLATES[v];
                    if (tpl) setForm((f) => ({ ...f, content: tpl.content }));
                  }}
                >
                  <SelectTrigger className="h-7 w-48 text-xs">
                    <SelectValue placeholder="Usar template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TEMPLATES).map(([key, tpl]) => (
                      <SelectItem key={key} value={key}>
                        {tpl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <MarkdownEditor
                value={form.content}
                onChange={(v) => setForm((f) => ({ ...f, content: v }))}
                placeholder="Conteúdo do artigo..."
                rows={10}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as KnowledgeArticle["status"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Rascunho</SelectItem>
                    <SelectItem value="PUBLISHED">Publicado</SelectItem>
                    <SelectItem value="ARCHIVED">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <Label>Visibilidade</Label>
                <Select
                  value={form.visibility}
                  onValueChange={(v) => setForm((f) => ({ ...f, visibility: v as KnowledgeArticle["visibility"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Público</SelectItem>
                    <SelectItem value="INTERNAL">Interno</SelectItem>
                    <SelectItem value="RESTRICTED">Restrito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              Criar artigo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
