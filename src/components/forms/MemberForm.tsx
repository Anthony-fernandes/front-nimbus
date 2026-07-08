import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, ChevronDown, ChevronRight, Minus, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Field, FormSection } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppUserRole } from "@/lib/auth";
import {
  countEnabledPermissions,
  getPermissionSummary,
  hasAnyPermission,
  PERMISSION_GROUPS,
  PERMISSION_PRESETS,
  permissionMapFromKeys,
  resolveUserPermissions,
} from "@/lib/permissions";
import { getStoredUser } from "@/services/authService";
import { listOrganizations } from "@/services/clientService";
import { listDepartments, listPositions } from "@/services/orgService";
import { listPermissionBlocks } from "@/services/permissionBlockService";
import { maskCurrencyInput , parseApiError} from "@/services/utils";
import { listUsers, saveMember } from "@/services/userService";

export type MemberFormData = {
  name: string;
  username: string;
  email: string;
  phone: string;
  role: AppUserRole;
  primaryOrganization: string;
  organizationAccessIds: string[];
  jobTitle: string;
  specialty: string;
  hourlyCost: string;
  availableHours: string;
  status: "Ativo" | "Inativo";
  password: string;
  confirmPassword: string;
  permissionBlockIds: string[];
  grantedPermissionKeys: string[];
  deniedPermissionKeys: string[];
  department: string;
  position: string;
  supervisor: string;
  manager: string;
  approvalMode: string;
  isServiceDeskApprover: boolean;
};

const empty: MemberFormData = {
  name: "",
  username: "",
  email: "",
  phone: "",
  role: "TECHNICIAN",
  primaryOrganization: "",
  organizationAccessIds: [],
  jobTitle: "",
  specialty: "",
  hourlyCost: "0,00",
  availableHours: "40",
  status: "Ativo",
  password: "",
  confirmPassword: "",
  permissionBlockIds: [],
  grantedPermissionKeys: [],
  deniedPermissionKeys: [],
  department: "",
  position: "",
  supervisor: "",
  manager: "",
  approvalMode: "INHERITED",
  isServiceDeskApprover: false,
};

const ROLE_OPTIONS: Array<{ value: AppUserRole; label: string }> = [
  { value: "ADMIN", label: "Administrador" },
  { value: "TECHNICIAN", label: "Técnico" },
  { value: "CLIENT", label: "Cliente" },
];

const ROLES_WITH_REQUIRED_ORGANIZATION = new Set<AppUserRole>(["CLIENT"]);

function toggleKey(list: string[], key: string) {
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
}

// ─── Unified Permissions Editor ──────────────────────────────────────────────

type PermState = "inherit" | "grant" | "deny";

const ROLE_CARDS: Array<{ value: AppUserRole; label: string; description: string; color: string }> = [
  { value: "ADMIN", label: "Administrador", description: "Acesso total ao portal interno", color: "border-purple-400/60 bg-purple-50/50 dark:bg-purple-950/20" },
  { value: "TECHNICIAN", label: "Técnico", description: "Operacional — permissões controladas", color: "border-blue-400/60 bg-blue-50/50 dark:bg-blue-950/20" },
  { value: "CLIENT", label: "Cliente", description: "Apenas portal do cliente", color: "border-emerald-400/60 bg-emerald-50/50 dark:bg-emerald-950/20" },
];

import type { PermissionBlock } from "@/lib/types";

function PermissionsEditor({
  role,
  permissionBlocks,
  permissionBlockIds,
  grantedPermissionKeys,
  deniedPermissionKeys,
  onRoleChange,
  onBlockToggle,
  onGrantToggle,
  onDenyToggle,
}: {
  role: AppUserRole;
  permissionBlocks: PermissionBlock[];
  permissionBlockIds: string[];
  grantedPermissionKeys: string[];
  deniedPermissionKeys: string[];
  onRoleChange: (r: AppUserRole) => void;
  onBlockToggle: (id: string) => void;
  onGrantToggle: (key: string) => void;
  onDenyToggle: (key: string) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["tickets"]));

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function getState(permKey: string): PermState {
    if (deniedPermissionKeys.includes(permKey)) return "deny";
    if (grantedPermissionKeys.includes(permKey)) return "grant";
    return "inherit";
  }

  function cycleState(permKey: string) {
    const current = getState(permKey);
    if (current === "inherit") {
      // inherit → grant
      onGrantToggle(permKey);
    } else if (current === "grant") {
      // grant → deny: remove from granted, add to denied
      onGrantToggle(permKey); // remove from granted
      onDenyToggle(permKey);  // add to denied
    } else {
      // deny → inherit: remove from denied
      onDenyToggle(permKey);
    }
  }

  return (
    <div className="space-y-6">
      {/* Role selector */}
      <FormSection
        title="Perfil de acesso"
        description="Define as permissões base do usuário. Você pode ajustar individualmente abaixo."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ROLE_CARDS.map((card) => (
            <button
              key={card.value}
              type="button"
              onClick={() => onRoleChange(card.value)}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all ${
                role === card.value
                  ? `${card.color} border-opacity-100 shadow-sm`
                  : "border-border bg-background/50 hover:border-primary/30"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-semibold">{card.label}</span>
                {role === card.value && <ShieldCheck className="h-4 w-4 text-primary" />}
              </div>
              <span className="text-xs text-muted-foreground">{card.description}</span>
            </button>
          ))}
        </div>
      </FormSection>

      {/* Permission blocks */}
      {permissionBlocks.length > 0 && (
        <FormSection
          title="Blocos de permissões"
          description="Conjuntos pré-definidos que complementam o perfil base."
        >
          <div className="flex flex-wrap gap-2">
            {permissionBlocks.map((block) => {
              const active = permissionBlockIds.includes(block.id);
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => onBlockToggle(block.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {block.name}
                </button>
              );
            })}
          </div>
        </FormSection>
      )}

      {/* Fine-grained permissions grid */}
      <FormSection
        title="Ajustes individuais"
        description="Clique em uma permissão para alternar entre Herdar (cinza), Conceder (verde) e Bloquear (vermelho)."
      >
        <div className="overflow-hidden rounded-xl border border-border">
          {PERMISSION_GROUPS.map((group, gi) => {
            const isOpen = openGroups.has(group.key);
            const grantCount = group.permissions.filter((p) => grantedPermissionKeys.includes(p.value)).length;
            const denyCount = group.permissions.filter((p) => deniedPermissionKeys.includes(p.value)).length;

            return (
              <div key={group.key} className={gi > 0 ? "border-t border-border" : ""}>
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full items-center gap-3 bg-muted/30 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="text-sm font-semibold flex-1">{group.label}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {grantCount > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">+{grantCount}</span>}
                    {denyCount > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-400">−{denyCount}</span>}
                    <span className="text-muted-foreground">{group.permissions.length} permissões</span>
                  </span>
                </button>

                {/* Permission rows */}
                {isOpen && (
                  <div className="divide-y divide-border/50">
                    {group.permissions.map((perm) => {
                      const state = getState(perm.value);
                      return (
                        <button
                          key={perm.value}
                          type="button"
                          onClick={() => cycleState(perm.value)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors"
                        >
                          {/* State indicator */}
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${
                            state === "grant"
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : state === "deny"
                                ? "border-red-500 bg-red-500 text-white"
                                : "border-border bg-background"
                          }`}>
                            {state === "grant" && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {state === "deny" && <Ban className="h-3.5 w-3.5" />}
                            {state === "inherit" && <Minus className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-tight">{perm.label}</span>
                            <span className="block text-xs text-muted-foreground leading-tight mt-0.5">{perm.description}</span>
                          </div>
                          <span className={`shrink-0 text-[10px] font-medium uppercase tracking-wide ${
                            state === "grant" ? "text-emerald-600" : state === "deny" ? "text-red-500" : "text-muted-foreground/50"
                          }`}>
                            {state === "grant" ? "Concedido" : state === "deny" ? "Bloqueado" : "Herda"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </FormSection>
    </div>
  );
}

export function MemberForm({
  initial,
  mode = "create",
  onCancelHref = "/teams",
  entityId,
}: {
  initial?: Partial<MemberFormData>;
  mode?: "create" | "edit";
  onCancelHref?: string;
  entityId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = getStoredUser();
  // Somente users.managePermissions pode gravar permissões — o backend rejeita users.manage sozinho.
  const canManagePermissionSettings = hasAnyPermission(currentUser, [
    "users.managePermissions",
  ]);
  const [data, setData] = useState<MemberFormData>({ ...empty, ...initial });
  const { data: organizations = [] } = useQuery({
    queryKey: ["member-form-organizations"],
    queryFn: () => listOrganizations(),
  });
  const { data: permissionBlocks = [] } = useQuery({
    queryKey: ["permission-blocks"],
    queryFn: () => listPermissionBlocks(),
    enabled: canManagePermissionSettings,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => listDepartments(),
  });
  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => listPositions(),
  });
  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
  });

  const selectedBlocks = useMemo(
    () => permissionBlocks.filter((block) => data.permissionBlockIds.includes(block.id)),
    [data.permissionBlockIds, permissionBlocks],
  );
  const permissionPreviewUser = useMemo(
    () => ({
      role: data.role,
      permission_blocks_data: selectedBlocks,
      granted_permissions: permissionMapFromKeys(data.grantedPermissionKeys),
      denied_permissions: permissionMapFromKeys(data.deniedPermissionKeys),
    }),
    [data.deniedPermissionKeys, data.grantedPermissionKeys, data.role, selectedBlocks],
  );
  const permissionSummary = useMemo(
    () =>
      getPermissionSummary(permissionPreviewUser).filter(
        (item) => item.granted || item.deniedDirectly,
      ),
    [permissionPreviewUser],
  );
  const finalPermissionCount = useMemo(
    () => countEnabledPermissions(resolveUserPermissions(permissionPreviewUser)),
    [permissionPreviewUser],
  );
  const roleHint = useMemo(() => {
    switch (data.role) {
      case "ADMIN":
        return "Acessa o portal interno com permissão padrão completa.";
      case "CLIENT":
        return "Acessa apenas o portal do cliente e nunca o portal interno.";
      default:
        return "Acessa o portal interno operacional com permissões controladas.";
    }
  }, [data.role]);

  const set = <K extends keyof MemberFormData>(key: K, value: MemberFormData[K]) =>
    setData((current) => ({ ...current, [key]: value }));

  const toggleOrganizationAccess = (organizationId: string) => {
    const nextIds = data.organizationAccessIds.includes(organizationId)
      ? data.organizationAccessIds.filter((item) => item !== organizationId)
      : [...data.organizationAccessIds, organizationId];

    set("organizationAccessIds", nextIds);

    if (!data.primaryOrganization && nextIds.length === 1) {
      set("primaryOrganization", nextIds[0]);
    }

    if (data.primaryOrganization === organizationId && !nextIds.includes(organizationId)) {
      set("primaryOrganization", nextIds[0] || "");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!data.name.trim() || !data.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }

    if (
      ROLES_WITH_REQUIRED_ORGANIZATION.has(data.role)
      && !data.primaryOrganization
      && data.organizationAccessIds.length === 0
    ) {
      toast.error("Selecione a organização principal desse usuário");
      return;
    }

    if (data.password || data.confirmPassword) {
      if (data.password.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres");
        return;
      }

      if (data.password !== data.confirmPassword) {
        toast.error("Senha e confirmacao precisam ser iguais");
        return;
      }
    }

    try {
      const member = await saveMember(data, mode, entityId, {
        includePermissionConfig: canManagePermissionSettings,
      });
      const targetId = member.id ? String(member.id) : entityId;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        targetId
          ? queryClient.invalidateQueries({ queryKey: ["user", targetId] })
          : Promise.resolve(),
      ]);

      toast.success(mode === "create" ? "Usuário cadastrado" : "Usuário atualizado");
      if (targetId) {
        navigate({ to: "/teams/$id", params: { id: targetId } });
      } else {
        navigate({ to: onCancelHref });
      }
    } catch (error) {
      toast.error(parseApiError(error, "Erro ao salvar usuário"));
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <FormSection
          title="Acesso do usuário"
          description="Dados principais de autenticacao e identificacao."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required>
              <Input
                value={data.name}
                onChange={(event) => set("name", event.target.value)}
                required
              />
            </Field>
            <Field
              label="Usuário"
              hint="Se ficar vazio, sera derivado automaticamente do e-mail."
            >
              <Input
                value={data.username}
                onChange={(event) => set("username", event.target.value)}
                placeholder="usuário.login"
              />
            </Field>
            <Field label="Email" required>
              <Input
                type="email"
                value={data.email}
                onChange={(event) => set("email", event.target.value)}
                required
              />
            </Field>
            <Field label="Telefone">
              <Input
                value={data.phone}
                onChange={(event) => set("phone", event.target.value)}
              />
            </Field>
            <Field
              label={mode === "create" ? "Senha" : "Nova senha"}
              hint={
                mode === "create"
                  ? "Se ficar em branco, uma senha aleatória segura é gerada — o usuário deve redefinir via 'Esqueci minha senha'."
                  : "Preencha apenas se quiser trocar a senha atual."
              }
            >
              <Input
                type="password"
                value={data.password}
                onChange={(event) => set("password", event.target.value)}
                placeholder="Minimo de 6 caracteres"
              />
            </Field>
            <Field label="Confirmar senha">
              <Input
                type="password"
                value={data.confirmPassword}
                onChange={(event) => set("confirmPassword", event.target.value)}
                placeholder="Repita a senha"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Tipo e contexto"
          description="O tipo define o portal principal e as permissões padrão."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de usuário" required hint={roleHint}>
              <Select
                value={data.role}
                onValueChange={(value) => set("role", value as AppUserRole)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={data.status}
                onValueChange={(value) => set("status", value as MemberFormData["status"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Organização principal"
              required={data.role === "CLIENT"}
              hint={
                data.role === "CLIENT"
                  ? "Obrigatoria para definir o portal do cliente."
                  : "Use quando o usuário atender ou representar uma organização especifica."
              }
            >
              <Select
                value={data.primaryOrganization || "__none__"}
                onValueChange={(value) =>
                  set("primaryOrganization", value === "__none__" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar organização" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {organizations.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Título do cargo (texto livre)" hint="Aparece no perfil. Para vincular ao cargo oficial da empresa, use 'Cargo oficial' abaixo.">
              <Input
                value={data.jobTitle}
                onChange={(event) => set("jobTitle", event.target.value)}
                placeholder="Ex.: Coordenador de suporte"
              />
            </Field>
            <Field label="Especialidade">
              <Input
                value={data.specialty}
                onChange={(event) => set("specialty", event.target.value)}
                placeholder="Ex.: Backend / Infra"
              />
            </Field>
            <Field
              label="Custo por hora"
              hint="Usado para calcular automaticamente custos em projetos quando houver apontamento de horas."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  value={data.hourlyCost}
                  onChange={(event) =>
                    set("hourlyCost", maskCurrencyInput(event.target.value))
                  }
                  placeholder="Ex: 80,00"
                  inputMode="decimal"
                  className="pl-10"
                />
              </div>
            </Field>
            <Field label="Horas disponíveis (semana)">
              <Input
                type="number"
                min={0}
                value={data.availableHours}
                onChange={(event) => set("availableHours", event.target.value)}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Vinculos com organizações"
          description="Defina em quais organizações o usuário pode atuar, solicitar ou acompanhar demandas."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {organizations.map((organization) => (
              <label
                key={organization.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/70 px-3 py-3 transition-colors hover:border-primary/40"
              >
                <Checkbox
                  checked={
                    data.organizationAccessIds.includes(organization.id)
                    || data.primaryOrganization === organization.id
                  }
                  onCheckedChange={() => toggleOrganizationAccess(organization.id)}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">{organization.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {organization.organization_type || organization.type || "Organização"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </FormSection>

        <FormSection
          title="Estrutura organizacional"
          description="Vincule o usuário a departamentos, cargos e responsáveis de aprovação."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Departamento">
              <Select
                value={data.department || "__none__"}
                onValueChange={(v) => set("department", v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cargo oficial" hint="Cargo cadastrado na estrutura organizacional — pode conceder auto-aprovação.">
              <Select
                value={data.position || "__none__"}
                onValueChange={(v) => set("position", v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Supervisor direto">
              <Select
                value={data.supervisor || "__none__"}
                onValueChange={(v) => set("supervisor", v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Gerente">
              <Select
                value={data.manager || "__none__"}
                onValueChange={(v) => set("manager", v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar gerente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Modo de aprovacao" hint="Define quem aprova chamados originados por este usuário.">
              <Select
                value={data.approvalMode || "INHERITED"}
                onValueChange={(v) => set("approvalMode", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INHERITED">Herdado (padrão do sistema)</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor direto</SelectItem>
                  <SelectItem value="MANAGER">Gerente</SelectItem>
                  <SelectItem value="AUTO">Auto (por cargo)</SelectItem>
                  <SelectItem value="SERVICE_DESK">Service Desk</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Aprovador Service Desk">
              <label className="flex cursor-pointer items-center gap-2 pt-2">
                <Checkbox
                  checked={data.isServiceDeskApprover}
                  onCheckedChange={(v) => set("isServiceDeskApprover", Boolean(v))}
                />
                <span className="text-sm">Este usuário aprova chamados como Service Desk</span>
              </label>
            </Field>
          </div>
        </FormSection>

        {canManagePermissionSettings ? (
          <PermissionsEditor
            role={data.role}
            permissionBlocks={permissionBlocks}
            permissionBlockIds={data.permissionBlockIds}
            grantedPermissionKeys={data.grantedPermissionKeys}
            deniedPermissionKeys={data.deniedPermissionKeys}
            onRoleChange={(r) => set("role", r)}
            onBlockToggle={(id) => set("permissionBlockIds", toggleKey(data.permissionBlockIds, id))}
            onGrantToggle={(key) => set("grantedPermissionKeys", toggleKey(data.grantedPermissionKeys, key))}
            onDenyToggle={(key) => set("deniedPermissionKeys", toggleKey(data.deniedPermissionKeys, key))}
          />
        ) : null}
      </div>

      <div className="space-y-5">
        <div className="glass sticky top-20 space-y-4 rounded-2xl p-4 shadow-card">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <InfoStat label="Perfil" value={ROLE_OPTIONS.find((item) => item.value === data.role)?.label || "Técnico"} />
            <InfoStat label="Blocos ativos" value={String(selectedBlocks.length)} />
            <InfoStat label="Permissões finais" value={String(finalPermissionCount)} />
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Resumo das permissões finais</h4>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {permissionSummary.length ? (
                permissionSummary.map((item) => (
                  <div
                    key={item.permission}
                    className="rounded-xl border border-border bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{item.label}</div>
                      <span
                        className={
                          item.granted
                            ? "rounded-md bg-success/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success"
                            : "rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive"
                        }
                      >
                        {item.granted ? "Permitido" : "Negado"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {item.fromBase ? (
                        <span className="rounded-md bg-muted/60 px-2 py-0.5">Tipo</span>
                      ) : null}
                      {item.fromBlock ? (
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
                          Bloco
                        </span>
                      ) : null}
                      {item.fromGrant ? (
                        <span className="rounded-md bg-success/10 px-2 py-0.5 text-success">
                          Extra
                        </span>
                      ) : null}
                      {item.deniedDirectly ? (
                        <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-destructive">
                          Removida
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
                  Nenhuma permissão final ativa para esse usuário.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              {mode === "create" ? "Cadastrar usuário" : "Salvar alterações"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate({ to: onCancelHref })}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
