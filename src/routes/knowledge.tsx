import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
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
import { Textarea } from "@/components/ui/textarea";
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
  head: () => ({ meta: [{ title: "Base de Conhecimento · Nimbus" }] }),
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

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function KnowledgePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const canCreate = hasPermission(user, "activities.create");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("PUBLISHED");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    summary: "",
    content: "",
    category: "",
    status: "DRAFT" as KnowledgeArticle["status"],
    visibility: "INTERNAL" as KnowledgeArticle["visibility"],
  });

  const categoriesQuery = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: listKnowledgeCategories,
  });

  const articlesQuery = useQuery({
    queryKey: ["knowledge-articles", { status: statusFilter, category: categoryFilter }],
    queryFn: () =>
      listKnowledgeArticles({
        status: statusFilter !== "all" ? statusFilter : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createKnowledgeArticle({
        ...form,
        category: form.category || null,
      }),
    onSuccess: () => {
      toast.success("Artigo criado com sucesso.");
      setDialogOpen(false);
      setForm({ title: "", summary: "", content: "", category: "", status: "DRAFT", visibility: "INTERNAL" });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
    },
    onError: () => toast.error("Não foi possível criar o artigo."),
  });

  const categories = categoriesQuery.data ?? [];
  const articles = (articlesQuery.data ?? []).filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.summary.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell>
      <div className="max-w-5xl space-y-5">
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 text-sm"
              placeholder="Pesquisar artigos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 text-sm">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PUBLISHED">Publicados</SelectItem>
              <SelectItem value="DRAFT">Rascunhos</SelectItem>
              <SelectItem value="ARCHIVED">Arquivados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Article list */}
        {articlesQuery.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Carregando artigos...
          </div>
        ) : articles.length === 0 ? (
          <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum artigo encontrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => {
              const total = article.helpful_count + article.not_helpful_count;
              const helpfulPct = total > 0 ? Math.round((article.helpful_count / total) * 100) : null;
              return (
                <div
                  key={article.id}
                  className="glass cursor-pointer space-y-2 rounded-2xl p-4 shadow-card transition-colors hover:border-primary/40"
                  onClick={() => navigate({ to: "/knowledge/$id", params: { id: article.id } })}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        STATUS_CLASS[article.status] ?? STATUS_CLASS.DRAFT,
                      )}
                    >
                      {STATUS_LABELS[article.status] ?? article.status}
                    </span>
                    {article.category_name ? (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted/60 text-muted-foreground">
                        {article.category_name}
                      </span>
                    ) : null}
                    <span className="text-sm font-semibold">{article.title}</span>
                  </div>
                  {article.summary ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{article.summary}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    {article.author_name ? <span>{article.author_name}</span> : null}
                    <span>{formatDate(article.created_at)}</span>
                    <span>{article.views_count} visualizações</span>
                    {helpfulPct !== null ? <span>{helpfulPct}% útil</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
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
              <Label>Conteúdo</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Conteúdo do artigo..."
                className="min-h-[120px]"
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
