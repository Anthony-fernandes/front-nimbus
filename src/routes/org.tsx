import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { hasAnyPermission } from "@/lib/permissions";
import type { Department, Position, User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import {
  createDepartment,
  createPosition,
  deleteDepartment,
  deletePosition,
  listDepartments,
  listPositions,
  updateDepartment,
  updatePosition,
} from "@/services/orgService";
import { listUsers } from "@/services/userService";

export const Route = createFileRoute("/org")({
  head: () => ({ meta: [{ title: "Organização · Stratos Suite" }] }),
  component: OrgPage,
});

type Tab = "departamentos" | "cargos";

type DeptForm = {
  name: string;
  description: string;
  manager: string;
  active: boolean;
};

type PositionForm = {
  name: string;
  auto_approval: boolean;
  active: boolean;
};

const emptyDept: DeptForm = { name: "", description: "", manager: "", active: true };
const emptyPosition: PositionForm = { name: "", auto_approval: false, active: true };

function OrgPage() {
  const queryClient = useQueryClient();
  const currentUser = getStoredUser<User>();
  const canManage = hasAnyPermission(currentUser, ["users.manage", "users.managePermissions"]);

  const [tab, setTab] = useState<Tab>("departamentos");

  // Department dialog state
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState<DeptForm>(emptyDept);
  const [deptSaving, setDeptSaving] = useState(false);

  // Position dialog state
  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [posForm, setPosForm] = useState<PositionForm>(emptyPosition);
  const [posSaving, setPosSaving] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => listDepartments(),
    enabled: canManage,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => listPositions(),
    enabled: canManage,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
    enabled: canManage,
  });

  // Department handlers
  const openCreateDept = () => {
    setEditingDept(null);
    setDeptForm(emptyDept);
    setDeptDialogOpen(true);
  };

  const openEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      description: dept.description || "",
      manager: dept.manager || "",
      active: dept.active ?? true,
    });
    setDeptDialogOpen(true);
  };

  const handleSaveDept = async () => {
    if (!deptForm.name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    setDeptSaving(true);
    try {
      const payload = {
        name: deptForm.name.trim(),
        description: deptForm.description.trim() || undefined,
        manager: deptForm.manager || null,
        active: deptForm.active,
      };
      if (editingDept) {
        await updateDepartment(editingDept.id, payload);
        toast.success("Departamento atualizado.");
      } else {
        await createDepartment(payload);
        toast.success("Departamento criado.");
      }
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeptDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar o departamento.",
      );
    } finally {
      setDeptSaving(false);
    }
  };

  const handleDeleteDept = async (dept: Department) => {
    try {
      await deleteDepartment(dept.id);
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Departamento removido.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível remover o departamento.",
      );
    }
  };

  // Position handlers
  const openCreatePos = () => {
    setEditingPos(null);
    setPosForm(emptyPosition);
    setPosDialogOpen(true);
  };

  const openEditPos = (pos: Position) => {
    setEditingPos(pos);
    setPosForm({
      name: pos.name,
      auto_approval: pos.auto_approval ?? false,
      active: pos.active ?? true,
    });
    setPosDialogOpen(true);
  };

  const handleSavePos = async () => {
    if (!posForm.name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    setPosSaving(true);
    try {
      const payload = {
        name: posForm.name.trim(),
        auto_approval: posForm.auto_approval,
        active: posForm.active,
      };
      if (editingPos) {
        await updatePosition(editingPos.id, payload);
        toast.success("Cargo atualizado.");
      } else {
        await createPosition(payload);
        toast.success("Cargo criado.");
      }
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
      setPosDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar o cargo.",
      );
    } finally {
      setPosSaving(false);
    }
  };

  const handleDeletePos = async (pos: Position) => {
    try {
      await deletePosition(pos.id);
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
      toast.success("Cargo removido.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível remover o cargo.",
      );
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: "Organização" }]}
          title="Organização"
          subtitle="Gerencie departamentos e cargos da empresa."
          actions={
            canManage ? (
              <Button
                type="button"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={tab === "departamentos" ? openCreateDept : openCreatePos}
              >
                <Plus className="h-4 w-4" />
                {tab === "departamentos" ? "Novo departamento" : "Novo cargo"}
              </Button>
            ) : null
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
          {(["departamentos", "cargos"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "departamentos" ? "Departamentos" : "Cargos"}
            </button>
          ))}
        </div>

        {/* Departamentos tab */}
        {tab === "departamentos" && (
          <div className="glass overflow-hidden rounded-2xl shadow-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">Departamentos cadastrados</h2>
              <p className="text-xs text-muted-foreground">
                {`${departments.length} departamentos carregados.`}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                    <th className="px-2 py-2.5 text-left font-medium">Gerente</th>
                    <th className="px-2 py-2.5 text-left font-medium">Membros</th>
                    <th className="px-2 py-2.5 text-left font-medium">Status</th>
                    {canManage && (
                      <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {departments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canManage ? 5 : 4}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhum departamento cadastrado.
                      </td>
                    </tr>
                  ) : (
                    departments.map((dept) => (
                      <tr
                        key={dept.id}
                        className="border-b border-border last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{dept.name}</div>
                          {dept.description && (
                            <div className="text-xs text-muted-foreground">{dept.description}</div>
                          )}
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {dept.manager_name || "—"}
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {dept.member_count ?? "—"}
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={
                              (dept.active ?? true)
                                ? "rounded-md bg-success/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success"
                                : "rounded-md bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                            }
                          >
                            {(dept.active ?? true) ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => openEditDept(dept)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => handleDeleteDept(dept)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remover
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cargos tab */}
        {tab === "cargos" && (
          <div className="glass overflow-hidden rounded-2xl shadow-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">Cargos cadastrados</h2>
              <p className="text-xs text-muted-foreground">
                {`${positions.length} cargos carregados.`}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                    <th className="px-2 py-2.5 text-left font-medium">Aprovação automática</th>
                    <th className="px-2 py-2.5 text-left font-medium">Status</th>
                    {canManage && (
                      <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {positions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canManage ? 4 : 3}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhum cargo cadastrado.
                      </td>
                    </tr>
                  ) : (
                    positions.map((pos) => (
                      <tr
                        key={pos.id}
                        className="border-b border-border last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{pos.name}</div>
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {pos.auto_approval ? "Sim" : "Não"}
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={
                              (pos.active ?? true)
                                ? "rounded-md bg-success/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success"
                                : "rounded-md bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                            }
                          >
                            {(pos.active ?? true) ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => openEditPos(pos)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => handleDeletePos(pos)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remover
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Department dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDept ? "Editar departamento" : "Novo departamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name">Nome *</Label>
              <Input
                id="dept-name"
                value={deptForm.name}
                onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Tecnologia"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-desc">Descrição</Label>
              <Input
                id="dept-desc"
                value={deptForm.description}
                onChange={(e) => setDeptForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrição do departamento"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-manager">Gerente</Label>
              <Select
                value={deptForm.manager || "__none__"}
                onValueChange={(v) =>
                  setDeptForm((f) => ({ ...f, manager: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger id="dept-manager">
                  <SelectValue placeholder="Selecionar gerente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name ||
                        [u.first_name, u.last_name].filter(Boolean).join(" ") ||
                        u.email ||
                        u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={deptForm.active}
                onCheckedChange={(checked) =>
                  setDeptForm((f) => ({ ...f, active: Boolean(checked) }))
                }
              />
              <span className="text-sm">Ativo</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeptDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={handleSaveDept}
                disabled={deptSaving}
              >
                {deptSaving ? "Salvando..." : editingDept ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Position dialog */}
      <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPos ? "Editar cargo" : "Novo cargo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pos-name">Nome *</Label>
              <Input
                id="pos-name"
                value={posForm.name}
                onChange={(e) => setPosForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Analista de suporte"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={posForm.auto_approval}
                onCheckedChange={(checked) =>
                  setPosForm((f) => ({ ...f, auto_approval: Boolean(checked) }))
                }
              />
              <span className="text-sm">Aprovação automática</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={posForm.active}
                onCheckedChange={(checked) =>
                  setPosForm((f) => ({ ...f, active: Boolean(checked) }))
                }
              />
              <span className="text-sm">Ativo</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPosDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={handleSavePos}
                disabled={posSaving}
              >
                {posSaving ? "Salvando..." : editingPos ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
