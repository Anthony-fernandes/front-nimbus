import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import {
  TicketCategoryForm,
  toTicketCategoryFormData,
  type TicketCategoryFormData,
} from "@/components/forms/TicketCategoryForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canManageTicketCategories, hasAnyPermission } from "@/lib/permissions";
import type { TicketCategory, User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import {
  deleteTicketCategory,
  listTicketCategories,
  saveTicketCategory,
} from "@/services/ticketCategoryService";
import { parseApiError } from "@/services/utils";

export const Route = createFileRoute("/ticket-categories")({
  head: () => ({ meta: [{ title: "Categorias de chamado · NimbusDesk" }] }),
  component: TicketCategoriesPage,
});

function TicketCategoriesPage() {
  const queryClient = useQueryClient();
  const currentUser = getStoredUser<User>();
  const canViewCategories = hasAnyPermission(currentUser, [
    "categories.view",
    "categories.manage",
    "settings.view",
    "settings.edit",
  ]);
  const canManage = canManageTicketCategories(currentUser);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: () => listTicketCategories(),
    enabled: canViewCategories,
  });

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedId) || null,
    [categories, selectedId],
  );

  function openNew() {
    setSelectedId(null);
    setDialogOpen(true);
  }

  function openEdit(category: TicketCategory) {
    setSelectedId(category.id);
    setDialogOpen(true);
  }

  const handleSubmit = async (data: TicketCategoryFormData) => {
    if (!canManage) {
      toast.error("Seu perfil não pode alterar categorias.");
      return;
    }

    setSaving(true);
    try {
      await saveTicketCategory(
        {
          name: data.name,
          description: data.description,
          active: data.active,
          sla: data.sla,
          sla_unit: data.slaUnit,
          approval_required: data.approvalRequired,
          default_type: data.defaultType,
          default_priority: data.defaultPriority,
          default_impact: data.defaultImpact,
          default_team: data.defaultTeam,
          allow_project_activity: data.allowProjectActivity,
          requires_technical_categorization: data.requiresTechnicalCategorization,
          requires_client_validation: data.requiresClientValidation,
          color: data.color,
          icon: data.icon,
          subcategories: data.subcategoriesText
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          subcategory_required: data.subcategoryRequired,
          attachment_required: data.attachmentRequired,
        },
        selectedCategory ? "edit" : "create",
        selectedCategory?.id,
      );

      await queryClient.invalidateQueries({ queryKey: ["ticket-categories"] });
      setDialogOpen(false);
      setSelectedId(null);
      toast.success(selectedCategory ? "Categoria atualizada." : "Categoria criada.");
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível salvar a categoria."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: TicketCategory) => {
    if (!canManage) {
      toast.error("Seu perfil não pode remover categorias.");
      return;
    }

    try {
      await deleteTicketCategory(category.id);
      await queryClient.invalidateQueries({ queryKey: ["ticket-categories"] });
      if (selectedId === category.id) setSelectedId(null);
      toast.success("Categoria removida.");
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível remover a categoria."));
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: "Categorias de chamado" }]}
          title="Categorias de chamado"
          subtitle="Cadastre regras de SLA, aprovação, atendimento e conversão para atividade."
          actions={
            canManage ? (
              <Button
                type="button"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={openNew}
              >
                <Plus className="h-4 w-4" />
                Nova categoria
              </Button>
            ) : null
          }
        />

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Categorias cadastradas</h2>
            <p className="text-xs text-muted-foreground">
              {`${categories.length} categorias carregadas da API.`}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                  <th className="px-2 py-2.5 text-left font-medium">SLA</th>
                  <th className="px-2 py-2.5 text-left font-medium">Aprovação</th>
                  <th className="px-2 py-2.5 text-left font-medium">Atividade</th>
                  <th className="px-2 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma categoria cadastrada.
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr
                      key={category.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{category.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {category.description || "Sem descrição"}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">{category.sla || "8h"}</td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {category.approval_required ? "Sim" : "Não"}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {category.allow_project_activity ? "Permite" : "Não"}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {category.active ?? true ? "Ativa" : "Inativa"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canManage && (
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
                          )}
                          {canManage && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDelete(category)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remover
                            </Button>
                          )}
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCategory ? `Editar ${selectedCategory.name}` : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>
          <TicketCategoryForm
            key={selectedCategory?.id ?? "new"}
            initial={toTicketCategoryFormData(selectedCategory)}
            saving={saving}
            submitLabel={selectedCategory ? "Salvar categoria" : "Criar categoria"}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
