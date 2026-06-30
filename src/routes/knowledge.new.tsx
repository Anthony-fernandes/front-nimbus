import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { MarkdownEditor } from "@/components/app/MarkdownEditor";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KnowledgeArticle } from "@/lib/types";
import { createKnowledgeArticle, listKnowledgeCategories } from "@/services/knowledgeService";
import { listOrganizations } from "@/services/clientService";

export const Route = createFileRoute("/knowledge/new")({
  head: () => ({ meta: [{ title: "Novo Artigo · Stratos Suite" }] }),
  component: KnowledgeNewPage,
});

function KnowledgeNewPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    summary: "",
    content: "",
    category: "",
    status: "DRAFT" as KnowledgeArticle["status"],
    visibility: "INTERNAL" as KnowledgeArticle["visibility"],
    client: "",
  });

  const categoriesQuery = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: listKnowledgeCategories,
  });
  const { data: organizations = [] } = useQuery({
    queryKey: ["form-organizations"],
    queryFn: () => listOrganizations(),
  });

  const categories = categoriesQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      createKnowledgeArticle({
        ...form,
        category: form.category || null,
        client: form.client || null,
      } as Partial<KnowledgeArticle>),
    onSuccess: (article) => {
      toast.success("Artigo criado com sucesso.");
      void navigate({ to: "/knowledge/$id", params: { id: article.id } });
    },
    onError: () => toast.error("Não foi possível criar o artigo."),
  });

  return (
    <AppShell>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-2">
          <Link
            to="/knowledge"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Base de Conhecimento
          </Link>
        </div>

        <PageHeader
          title="Novo artigo"
          subtitle="Crie um novo artigo para a base de conhecimento."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <BookOpen className="h-4 w-4" />
            </span>
          }
        />

        <div className="glass rounded-2xl p-6 shadow-card space-y-4">
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

          <div className="space-y-1.5">
            <Label>Conteúdo</Label>
            <MarkdownEditor
              value={form.content}
              onChange={(v) => setForm((f) => ({ ...f, content: v }))}
              rows={14}
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
            <div className="flex-1 space-y-1">
              <Label>Cliente específico (opcional)</Label>
              <Select value={form.client} onValueChange={(v) => setForm((f) => ({ ...f, client: v }))}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Button variant="outline" asChild>
              <Link to="/knowledge">Cancelar</Link>
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.title}
            >
              Criar artigo
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
