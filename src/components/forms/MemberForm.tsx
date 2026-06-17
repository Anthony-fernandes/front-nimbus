import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, ShieldCheck, UserCog } from "lucide-react";
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
import { listPermissionBlocks } from "@/services/permissionBlockService";
import { maskCurrencyInput } from "@/services/utils";
import { saveMember } from "@/services/userService";

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
  group: string;
  availableHours: string;
  status: "Ativo" | "Inativo";
  password: string;
  confirmPassword: string;
  permissionBlockIds: string[];
  grantedPermissionKeys: string[];
  deniedPermissionKeys: string[];
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
  group: "",
  availableHours: "40",
  status: "Ativo",
  password: "",
  confirmPassword: "",
  permissionBlockIds: [],
  grantedPermissionKeys: [],
  deniedPermissionKeys: [],
};

const ROLE_OPTIONS: Array<{ value: AppUserRole; label: string }> = [
  { value: "ADMIN", label: "Administrador" },
  { value: "TECHNICIAN", label: "Tecnico" },
  { value: "CLIENT", label: "Cliente" },
];

const GROUP_OPTIONS = [
  "Backend",
  "Frontend",
  "DevOps",
  "Design",
  "QA",
  "Suporte",
  "Produto",
  "Comercial",
];

const ROLES_WITH_REQUIRED_ORGANIZATION = new Set<AppUserRole>(["CLIENT"]);

function toggleKey(list: string[], key: string) {
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
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
  const canManagePermissionSettings = hasAnyPermission(currentUser, [
    "users.managePermissions",
    "users.manage",
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
        return "Acessa o portal interno com permissao padrao completa.";
      case "CLIENT":
        return "Acessa apenas o portal do cliente e nunca o portal interno.";
      default:
        return "Acessa o portal interno operacional com permissoes controladas.";
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
      toast.error("Nome e email sao obrigatorios");
      return;
    }

    if (
      ROLES_WITH_REQUIRED_ORGANIZATION.has(data.role)
      && !data.primaryOrganization
      && data.organizationAccessIds.length === 0
    ) {
      toast.error("Selecione a organizacao principal desse usuario");
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

      toast.success(mode === "create" ? "Usuario cadastrado" : "Usuario atualizado");
      if (targetId) {
        navigate({ to: "/teams/$id", params: { id: targetId } });
      } else {
        navigate({ to: onCancelHref });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar usuario");
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <FormSection
          title="Acesso do usuario"
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
              label="Usuario"
              hint="Se ficar vazio, sera derivado automaticamente do e-mail."
            >
              <Input
                value={data.username}
                onChange={(event) => set("username", event.target.value)}
                placeholder="usuario.login"
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
                  ? "Se ficar em branco, o backend usa 123456."
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
          description="O tipo define o portal principal e as permissoes padrao."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de usuario" required hint={roleHint}>
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
              label="Organizacao principal"
              required={data.role === "CLIENT"}
              hint={
                data.role === "CLIENT"
                  ? "Obrigatoria para definir o portal do cliente."
                  : "Use quando o usuario atender ou representar uma organizacao especifica."
              }
            >
              <Select
                value={data.primaryOrganization || "__none__"}
                onValueChange={(value) =>
                  set("primaryOrganization", value === "__none__" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar organizacao" />
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
            <Field label="Cargo">
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
            <Field
              label="Grupo/equipe"
              hint={data.role === "TECHNICIAN" ? "Recomendado para tecnicos." : undefined}
            >
              <Select
                value={data.group || "__none__"}
                onValueChange={(value) => set("group", value === "__none__" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {GROUP_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Horas disponiveis (semana)">
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
          title="Vinculos com organizacoes"
          description="Defina em quais organizacoes o usuario pode atuar, solicitar ou acompanhar demandas."
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
                    {organization.organization_type || organization.type || "Organizacao"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </FormSection>

        {canManagePermissionSettings ? (
          <>
            <FormSection
              title="Blocos de permissoes"
              description="Aplique conjuntos reutilizaveis de acessos sem alterar o estilo do cadastro."
            >
              <div className="mb-2 flex flex-wrap gap-2">
                {PERMISSION_PRESETS.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    variant="outline"
                    className="justify-start"
                    onClick={() => set("role", preset.role)}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {permissionBlocks.map((block) => (
                  <label
                    key={block.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/70 px-3 py-3 transition-colors hover:border-primary/40"
                  >
                    <Checkbox
                      checked={data.permissionBlockIds.includes(block.id)}
                      onCheckedChange={() =>
                        set("permissionBlockIds", toggleKey(data.permissionBlockIds, block.id))
                      }
                      className="mt-0.5"
                    />
                    <span className="space-y-1">
                      <span className="block text-sm font-medium">{block.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {block.description || "Sem descricao cadastrada."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </FormSection>

            <FormSection
              title="Permissoes extras"
              description="Conceda acessos individuais alem do padrao do tipo e dos blocos aplicados."
            >
              <div className="space-y-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div
                    key={group.key}
                    className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold">{group.label}</h4>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.permissions.map((permission) => (
                        <label
                          key={permission.value}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/70 px-3 py-3 transition-colors hover:border-primary/40"
                        >
                          <Checkbox
                            checked={data.grantedPermissionKeys.includes(permission.value)}
                            onCheckedChange={() =>
                              set(
                                "grantedPermissionKeys",
                                toggleKey(data.grantedPermissionKeys, permission.value),
                              )
                            }
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
            </FormSection>

            <FormSection
              title="Permissoes removidas"
              description="As remocoes diretas sempre vencem o tipo, os blocos e as permissoes extras."
            >
              <div className="space-y-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div
                    key={`${group.key}-denied`}
                    className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-destructive" />
                      <h4 className="text-sm font-semibold">{group.label}</h4>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.permissions.map((permission) => (
                        <label
                          key={`${permission.value}-denied`}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/70 px-3 py-3 transition-colors hover:border-destructive/40"
                        >
                          <Checkbox
                            checked={data.deniedPermissionKeys.includes(permission.value)}
                            onCheckedChange={() =>
                              set(
                                "deniedPermissionKeys",
                                toggleKey(data.deniedPermissionKeys, permission.value),
                              )
                            }
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
            </FormSection>
          </>
        ) : null}
      </div>

      <div className="space-y-5">
        <div className="glass sticky top-20 space-y-4 rounded-2xl p-4 shadow-card">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <InfoStat label="Tipo" value={ROLE_OPTIONS.find((item) => item.value === data.role)?.label || "Tecnico"} />
            <InfoStat label="Blocos" value={String(selectedBlocks.length)} />
            <InfoStat label="Permissoes extras" value={String(data.grantedPermissionKeys.length)} />
            <InfoStat label="Permissoes removidas" value={String(data.deniedPermissionKeys.length)} />
            <InfoStat label="Permissoes finais" value={String(finalPermissionCount)} />
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Resumo das permissoes finais</h4>
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
                  Nenhuma permissao final ativa para esse usuario.
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
              {mode === "create" ? "Cadastrar usuario" : "Salvar alteracoes"}
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
