import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Pin, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  createForumTopic,
  listForumCategories,
  listForumTopics,
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

function ForumPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "" });

  const categoriesQuery = useQuery({
    queryKey: ["forum-categories"],
    queryFn: listForumCategories,
  });

  const topicsQuery = useQuery({
    queryKey: ["forum-topics", selectedCategory],
    queryFn: () => listForumTopics(selectedCategory ? { category: selectedCategory } : undefined),
  });

  const createMutation = useMutation({
    mutationFn: () => createForumTopic(form),
    onSuccess: () => {
      toast.success("Tópico criado com sucesso.");
      setDialogOpen(false);
      setForm({ title: "", content: "", category: "" });
      void queryClient.invalidateQueries({ queryKey: ["forum-topics"] });
    },
    onError: () => toast.error("Não foi possível criar o tópico."),
  });

  const categories = categoriesQuery.data ?? [];
  const topics = topicsQuery.data ?? [];

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

          {/* Topic list */}
          <div className="flex-1 space-y-3">
            {topicsQuery.isLoading ? (
              <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
                Carregando tópicos...
              </div>
            ) : topics.length === 0 ? (
              <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
                <MessagesSquare className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum tópico nesta categoria.</p>
              </div>
            ) : (
              topics.map((topic) => (
                <Link
                  key={topic.id}
                  to="/forum/$id"
                  params={{ id: topic.id }}
                  className="glass block cursor-pointer space-y-1.5 rounded-2xl p-4 shadow-card transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {topic.is_pinned ? (
                      <Pin className="h-3.5 w-3.5 text-primary" />
                    ) : null}
                    <span className="text-sm font-semibold">{topic.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    {topic.author_name ? <span>{topic.author_name}</span> : null}
                    {topic.category_name ? (
                      <span className="rounded px-1.5 py-0.5 bg-muted/60">{topic.category_name}</span>
                    ) : null}
                    <span>{topic.replies_count} respostas</span>
                    <span>{topic.views_count} visualizações</span>
                    <span>{formatDate(topic.created_at)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create topic dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Descreva o assunto..."
                className="min-h-[120px]"
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
