import { FormEvent, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Field, FormSection } from "@/components/app/Field";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  canManagePermissionBlocks,
  countEnabledPermissions,
  flattenGrantedPermissions,
  hasAnyPermission,
  PERMISSION_GROUPS,
  permissionMapFromKeys,
} from "@/lib/permissions";
import type { PermissionBlock, User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import {
  createPermissionBlock,
  deletePermissionBlock,
  listPermissionBlocks,
  updatePermissionBlock,
} from "@/services/permissionBlockService";

export const Route = createFileRoute("/permission-blocks")({
  head: () => ({ meta: [{ title: "Blocos de permissoes · Nimbus" }] }),
  component: PermissionBlocksPage,
});

type PermissionBlockFormData = {
  name: string;
  description: string;
  active: boolean;
  permissionKeys: string[];
};

const emptyForm: PermissionBlockFormData = {
  name: "",
  description: "",
  active: true,
  permissionKeys: [],
};

function PermissionBlocksPage() {
  const queryClient = useQueryClient();
  const currentUser = getStoredUser<User>();
  const canManage = canManagePermissionBlocks(currentUser);
  const canView = hasAnyPermission(currentUser, [
    "permissionBlocks.view",
    "permissionBlocks.manage",
    "users.managePermissions",
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: blocks = [] } = useQuery({
    queryKey: ["permission-blocks"],
    queryFn: () => listPermissionBlocks(),
    enabled: canView,
  });

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedId) || null,
    [blocks, selectedId],
  );
  const [formData, setFormData] = useState<PermissionBlockFormData>(emptyForm);

  const derivedFormData = useMemo<PermissionBlockFormData>(
    () =>
      selectedBlock
        ? {
            name: selectedBlock.name,
            description: selectedBlock.description || "",
            active: selectedBlock.active !== false,
            permissionKeys: flattenGrantedPermissions(selectedBlock.permissions),
          }
        : emptyForm,
    [selectedBlock],
  );

  useEffect(() => {
    setFormData(derivedFormData);
  }, [derivedFormData]);

  const totalPermissions = blocks.reduce(
    (sum, block) => sum + countEnabledPermissions(block.permissions),
    0,
  );

  const togglePermission = (permission: string) => {
    setFormData((current) => ({
      ...current,
      permissionKeys: current.permissionKeys.includes(permission)
        ? current.permissionKeys.filter((item) => item !== permission)
        : [...current.permissionKeys, permission],
    }));
  };

  const resetForm = () => {
    setSelectedId(null);
    setFormData(emptyForm);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canManage) {
      toast.error("Seu perfil nao pode alterar blocos de permissoes.");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Informe o nome do bloco.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        active: formData.active,
        permissions: permissionMapFromKeys(formData.permissionKeys),
      };

      if (selectedBlock) {
        await updatePermissionBlock(selectedBlock.id, payload);
      } else {
        await createPermissionBlock(payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["permission-blocks"] });
      toast.success(selectedBlock ? "Bloco atualizado." : "Bloco criado.");
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o bloco.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (block: PermissionBlock) => {
    if (!canManage) {
      toast.error("Seu perfil nao pode remover blocos.");
      return;
    }

    try {
      await deletePermissionBlock(block.id);
      await queryClient.invalidateQueries({ queryKey: ["permission-blocks"] });
      if (selectedId === block.id) {
        resetForm();
      }
      toast.success("Bloco removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel remover o bloco.");
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: "Blocos de permissoes" }]}
          title="Blocos de permissoes"
          subtitle="Monte conjuntos reutilizaveis de acessos para perfis como Dev, Suporte N1, Suporte N2 e Gestor Cliente."
          actions={
            canManage ? (
              <Button
                type="button"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={resetForm}
              >
                <Plus className="h-4 w-4" />
                Novo bloco
              </Button>
            ) : null
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <SummaryCard label="Blocos ativos" value={String(blocks.filter((block) => block.active !== false).length)} />
          <SummaryCard label="Blocos totais" value={String(blocks.length)} />
          <SummaryCard label="Permissoes mapeadas" value={String(totalPermissions)} />
          <SummaryCard label="Modo" value={canManage ? "Edicao" : "Leitura"} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="glass overflow-hidden rounded-2xl shadow-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">Blocos cadastrados</h2>
              <p className="text-xs text-muted-foreground">
                Cada bloco pode ser aplicado a usuarios tecnicos ou clientes sem mudar o tipo principal da conta.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Bloco</th>
                    <th className="px-2 py-2.5 text-left font-medium">Permissoes</th>
                    <th className="px-2 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block) => (
                    <tr
                      key={block.id}
                      className={`border-b border-border last:border-0 ${selectedId === block.id ? "bg-muted/30" : "hover:bg-muted/20"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{block.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {block.description || "Sem descricao cadastrada."}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {countEnabledPermissions(block.permissions)}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {block.active !== false ? "Ativo" : "Inativo"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => {
                              setSelectedId(block.id);
                              setFormData({
                                name: block.name,
                                description: block.description || "",
                                active: block.active !== false,
                                permissionKeys: flattenGrantedPermissions(block.permissions),
                              });
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {canManage ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDelete(block)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remover
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <FormSection
              title={selectedBlock ? `Editar ${selectedBlock.name}` : "Novo bloco"}
              description={
                canManage
                  ? "Escolha as permissoes que esse bloco vai conceder sempre que for aplicado."
                  : "Seu perfil tem acesso apenas de leitura a essa area."
              }
            >
              <form onSubmit={submit} className="space-y-4">
                <Field label="Nome" required>
                  <Input
                    value={formData.name}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, name: event.target.value }))
                    }
                    disabled={!canManage}
                    required
                  />
                </Field>
                <Field label="Descricao">
                  <Textarea
                    value={formData.description}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, description: event.target.value }))
                    }
                    disabled={!canManage}
                    className="min-h-24"
                  />
                </Field>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background/70 px-3 py-3">
                  <Checkbox
                    checked={formData.active}
                    onCheckedChange={(checked) =>
                      setFormData((current) => ({ ...current, active: checked === true }))
                    }
                    disabled={!canManage}
                  />
                  <span className="text-sm">Bloco ativo</span>
                </label>

                <div className="space-y-4">
                  {PERMISSION_GROUPS.map((group) => (
                    <div
                      key={group.key}
                      className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold">{group.label}</h4>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {group.permissions.map((permission) => (
                          <label
                            key={permission.value}
                            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/70 px-3 py-3 transition-colors hover:border-primary/40"
                          >
                            <Checkbox
                              checked={formData.permissionKeys.includes(permission.value)}
                              onCheckedChange={() => togglePermission(permission.value)}
                              disabled={!canManage}
                              className="mt-0.5"
                            />
                            <span className="space-y-1">
                              <span className="block text-sm font-medium">{permission.label}</span>
                              <span className="block text-xs text-muted-foreground">
                                {permission.description}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {canManage ? (
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                      disabled={saving}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {saving ? "Salvando..." : selectedBlock ? "Salvar bloco" : "Criar bloco"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Limpar
                    </Button>
                  </div>
                ) : null}
              </form>
            </FormSection>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4 shadow-card">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
