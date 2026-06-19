import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ForumCategory } from "@/lib/types";
import {
  createForumCategory,
  deleteForumCategory,
  listForumCategories,
  updateForumCategory,
} from "@/services/knowledgeService";

export const Route = createFileRoute("/forum-categories")({
  head: () => ({ meta: [{ title: "Categorias do Fórum · NimbusDesk" }] }),
  component: ForumCategoriesPage,
});

type FormState = {
  name: string;
  description: string;
  order: number;
  active: boolean;
};

const defaultForm: FormState = { name: "", description: "", order: 0, active: true };

function categoryToForm(c: ForumCategory): FormState {
  return { name: c.name, description: c.description, order: c.order, active: c.active };
}

function ForumCategoriesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ForumCategory | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const { data: categories = [] } = useQuery({
    queryKey: ["forum-categories"],
    queryFn: listForumCategories,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<ForumCategory>) => createForumCategory(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      setDialogOpen(false);
      toast.success("Categoria criada com sucesso.");
    },
    onError: () => toast.error("Não foi possível criar a categoria."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ForumCategory> }) =>
      updateForumCategory(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      setDialogOpen(false);
      toast.success("Categoria atualizada com sucesso.");
    },
    onError: () => toast.error("Não foi possível atualizar a categoria."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteForumCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      toast.success("Categoria removida com sucesso.");
    },
    onError: () => toast.error("Não foi possível remover a categoria."),
  });

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(category: ForumCategory) {
    setEditing(category);
    setForm(categoryToForm(category));
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("O nome é obrigatório.");
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <AppShell>
      <div className="space-y-5 max-w-5xl">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: "Categorias do Fórum" }]}
          title="Categorias do Fórum"
          subtitle="Gerencie as categorias disponíveis para os tópicos do fórum."
          actions={
            <Button
              type="button"
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Nova categoria
            </Button>
          }
        />

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Categorias cadastradas</h2>
            <p className="text-xs text-muted-foreground">
              {`${categories.length} categoria(s) carregada(s) da API.`}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                  <th className="px-4 py-2.5 text-left font-medium">Descrição</th>
                  <th className="px-4 py-2.5 text-left font-medium">Ordem</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma categoria cadastrada.
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr
                      key={category.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 font-medium">{category.name}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {category.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{category.order}</td>
                      <td className="px-4 py-3">
                        {category.active ? (
                          <Badge variant="secondary" className="bg-success/15 text-success border-success/30">
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">
                            Inativa
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => openEdit(category)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <ConfirmDelete
                            title="Excluir categoria?"
                            description={`A categoria "${category.name}" será removida permanentemente.`}
                            onConfirm={() => deleteMutation.mutate(category.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome da categoria"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrição opcional"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="order">Ordem</Label>
              <Input
                id="order"
                type="number"
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                placeholder="0"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="active"
                checked={form.active}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, active: checked }))}
              />
              <Label htmlFor="active">Categoria ativa</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
