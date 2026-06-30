import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Layers, Pencil, Plus, Tag } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ForumCategory, KnowledgeCategory } from "@/lib/types";
import {
  createForumCategory,
  createKnowledgeCategory,
  deleteForumCategory,
  deleteKnowledgeCategory,
  listForumCategories,
  listKnowledgeCategories,
  updateForumCategory,
  updateKnowledgeCategory,
} from "@/services/knowledgeService";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categorias · NimbusDesk" }] }),
  component: CategoriesPage,
});

type Tab = "forum" | "knowledge";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Forum tab ────────────────────────────────────────────────────────────────

type ForumForm = { name: string; description: string; order: string; active: boolean };
const defaultForumForm: ForumForm = { name: "", description: "", order: "0", active: true };

function ForumTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ForumCategory | null>(null);
  const [form, setForm] = useState<ForumForm>(defaultForumForm);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["forum-categories"],
    queryFn: listForumCategories,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<ForumCategory>) => createForumCategory(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      setDialogOpen(false);
      toast.success("Categoria criada.");
    },
    onError: () => toast.error("Não foi possível criar a categoria."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ForumCategory> }) =>
      updateForumCategory(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      setDialogOpen(false);
      toast.success("Categoria atualizada.");
    },
    onError: () => toast.error("Não foi possível atualizar a categoria."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteForumCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["forum-categories"] });
      toast.success("Categoria removida.");
    },
    onError: () => toast.error("Não foi possível remover a categoria."),
  });

  function openCreate() {
    setEditing(null);
    setForm(defaultForumForm);
    setDialogOpen(true);
  }

  function openEdit(cat: ForumCategory) {
    setEditing(cat);
    setForm({
      name: cat.name,
      description: cat.description ?? "",
      order: String(cat.order ?? 0),
      active: cat.active ?? true,
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("O nome é obrigatório."); return; }
    const data: Partial<ForumCategory> = {
      name: form.name.trim(),
      description: form.description.trim(),
      order: Number(form.order) || 0,
      active: form.active,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">{categories.length} categoria(s)</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Nova categoria
        </Button>
      </div>

      <div className="glass overflow-hidden rounded-2xl shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Nome</th>
              <th className="px-4 py-3 text-left font-medium">Descrição</th>
              <th className="px-4 py-3 text-center font-medium">Ordem</th>
              <th className="px-4 py-3 text-center font-medium">Ativo</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhuma categoria cadastrada.</td></tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{cat.name}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{cat.description || "—"}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{cat.order}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      cat.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    )}>
                      {cat.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(cat)}>
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                      <ConfirmDelete
                        title="Excluir categoria?"
                        description={`A categoria "${cat.name}" será removida permanentemente.`}
                        onConfirm={() => deleteMutation.mutate(cat.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoria" : "Nova categoria — Fórum"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="f-name">Nome *</Label>
              <Input
                id="f-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Anúncios, Suporte, Geral"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-desc">Descrição</Label>
              <Textarea
                id="f-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrição opcional da categoria"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-order">Ordem</Label>
                <Input
                  id="f-order"
                  type="number"
                  min={0}
                  value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ativo</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                  />
                  <span className="text-sm text-muted-foreground">{form.active ? "Sim" : "Não"}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Knowledge tab ────────────────────────────────────────────────────────────

type KbForm = { name: string; slug: string; description: string; parent: string; order: string; active: boolean };
const defaultKbForm: KbForm = { name: "", slug: "", description: "", parent: "", order: "0", active: true };

function KnowledgeTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeCategory | null>(null);
  const [form, setForm] = useState<KbForm>(defaultKbForm);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: listKnowledgeCategories,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<KnowledgeCategory>) => createKnowledgeCategory(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-categories"] });
      setDialogOpen(false);
      toast.success("Categoria criada.");
    },
    onError: () => toast.error("Não foi possível criar a categoria."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KnowledgeCategory> }) =>
      updateKnowledgeCategory(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-categories"] });
      setDialogOpen(false);
      toast.success("Categoria atualizada.");
    },
    onError: () => toast.error("Não foi possível atualizar a categoria."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKnowledgeCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-categories"] });
      toast.success("Categoria removida.");
    },
    onError: () => toast.error("Não foi possível remover a categoria."),
  });

  function openCreate() {
    setEditing(null);
    setForm(defaultKbForm);
    setDialogOpen(true);
  }

  function openEdit(cat: KnowledgeCategory) {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      parent: cat.parent ?? "",
      order: String(cat.order ?? 0),
      active: cat.active ?? true,
    });
    setDialogOpen(true);
  }

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: editing ? f.slug : toSlug(name) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("O nome é obrigatório."); return; }
    const data: Partial<KnowledgeCategory> = {
      name: form.name.trim(),
      slug: form.slug || toSlug(form.name),
      description: form.description.trim(),
      parent: form.parent || null,
      order: Number(form.order) || 0,
      active: form.active,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{categories.length} categoria(s)</p>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Nova categoria
        </Button>
      </div>

      <div className="glass overflow-hidden rounded-2xl shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Nome</th>
              <th className="px-4 py-3 text-left font-medium">Slug</th>
              <th className="px-4 py-3 text-left font-medium">Categoria pai</th>
              <th className="px-4 py-3 text-center font-medium">Ordem</th>
              <th className="px-4 py-3 text-center font-medium">Ativo</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhuma categoria cadastrada.</td></tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{cat.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{cat.slug}</td>
                  <td className="px-4 py-3 text-muted-foreground">{cat.parent_name || "—"}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{cat.order}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      cat.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    )}>
                      {cat.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(cat)}>
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                      <ConfirmDelete
                        title="Excluir categoria?"
                        description={`A categoria "${cat.name}" será removida permanentemente.`}
                        onConfirm={() => deleteMutation.mutate(cat.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoria" : "Nova categoria — Base de Conhecimento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="kb-name">Nome *</Label>
              <Input
                id="kb-name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Tutoriais, Processos, Políticas"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-slug">Slug</Label>
              <Input
                id="kb-slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="gerado-automaticamente"
              />
              <p className="text-[11px] text-muted-foreground">Identificador único usado na URL</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-desc">Descrição</Label>
              <Textarea
                id="kb-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrição opcional"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-parent">Categoria pai</Label>
              <Select
                value={form.parent || "__none__"}
                onValueChange={(v) => setForm((f) => ({ ...f, parent: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger id="kb-parent">
                  <SelectValue placeholder="Sem categoria pai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria pai</SelectItem>
                  {categories
                    .filter((c) => c.id !== editing?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="kb-order">Ordem</Label>
                <Input
                  id="kb-order"
                  type="number"
                  min={0}
                  value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ativo</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                  />
                  <span className="text-sm text-muted-foreground">{form.active ? "Sim" : "Não"}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: typeof Tag }[] = [
  { key: "forum", label: "Fórum", icon: Tag },
  { key: "knowledge", label: "Base de Conhecimento", icon: FolderOpen },
];

function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("forum");

  return (
    <AppShell>
      <div className="max-w-5xl space-y-5">
        <PageHeader
          title="Categorias"
          subtitle="Gerencie as categorias do Fórum e da Base de Conhecimento."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Layers className="h-4 w-4" />
            </span>
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border pb-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "forum" && <ForumTab />}
          {activeTab === "knowledge" && <KnowledgeTab />}
        </div>
      </div>
    </AppShell>
  );
}
