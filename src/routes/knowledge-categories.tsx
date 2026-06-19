import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
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
import type { KnowledgeCategory } from "@/lib/types";
import {
  createKnowledgeCategory,
  deleteKnowledgeCategory,
  listKnowledgeCategories,
  updateKnowledgeCategory,
} from "@/services/knowledgeService";

export const Route = createFileRoute("/knowledge-categories")({
  head: () => ({ meta: [{ title: "Categorias da Base de Conhecimento · NimbusDesk" }] }),
  component: KnowledgeCategoriesPage,
});

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type FormState = {
  name: string;
  slug: string;
  description: string;
  parent: string;
};

const defaultForm: FormState = { name: "", slug: "", description: "", parent: "" };

function categoryToForm(c: KnowledgeCategory): FormState {
  return { name: c.name, slug: c.slug, description: c.description, parent: c.parent ?? "" };
}

function KnowledgeCategoriesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeCategory | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const { data: categories = [] } = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: listKnowledgeCategories,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<KnowledgeCategory>) => createKnowledgeCategory(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-categories"] });
      setDialogOpen(false);
      toast.success("Categoria criada com sucesso.");
    },
    onError: () => toast.error("Não foi possível criar a categoria."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KnowledgeCategory> }) =>
      updateKnowledgeCategory(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-categories"] });
      setDialogOpen(false);
      toast.success("Categoria atualizada com sucesso.");
    },
    onError: () => toast.error("Não foi possível atualizar a categoria."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKnowledgeCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-categories"] });
      toast.success("Categoria removida com sucesso.");
    },
    onError: () => toast.error("Não foi possível remover a categoria."),
  });

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(category: KnowledgeCategory) {
    setEditing(category);
    setForm(categoryToForm(category));
    setDialogOpen(true);
  }

  function handleNameChange(name: string) {
    setForm((f) => ({
      ...f,
      name,
      slug: editing ? f.slug : toSlug(name),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("O nome é obrigatório.");
      return;
    }
    const data: Partial<KnowledgeCategory> = {
      name: form.name,
      slug: form.slug || toSlug(form.name),
      description: form.description,
      parent: form.parent || null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <AppShell>
      <div className="space-y-5 max-w-5xl">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: "Categorias da Base de Conhecimento" }]}
          title="Categorias da Base de Conhecimento"
          subtitle="Gerencie as categorias disponíveis para os artigos da base de conhecimento."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <FolderOpen className="h-4 w-4" />
            </span>
          }
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
              {`${categories.length} categoria(s) carregada(s).`}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                  <th className="px-4 py-2.5 text-left font-medium">Slug</th>
                  <th className="px-4 py-2.5 text-left font-medium">Descrição</th>
                  <th className="px-4 py-2.5 text-left font-medium">Categoria pai</th>
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
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{category.slug}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {category.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {category.parent_name || "—"}
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
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Nome da categoria"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="gerado-automaticamente"
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
              <Label htmlFor="parent">Categoria pai (opcional)</Label>
              <Select
                value={form.parent}
                onValueChange={(v) => setForm((f) => ({ ...f, parent: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger id="parent">
                  <SelectValue placeholder="Sem categoria pai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria pai</SelectItem>
                  {categories
                    .filter((c) => c.id !== editing?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
