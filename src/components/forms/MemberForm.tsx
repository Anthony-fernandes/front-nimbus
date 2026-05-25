import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Field, FormSection } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PERMISSION_GROUPS,
  PERMISSION_PRESETS,
  dedupePermissions,
} from "@/lib/permissions";
import { listClients } from "@/services/clientService";
import { maskCurrencyInput } from "@/services/utils";
import { saveMember } from "@/services/userService";

type UserRole = "ADMIN" | "MANAGER" | "TECHNICIAN" | "CLIENT";

export type MemberFormData = {
  name: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
  client: string;
  jobTitle: string;
  specialty: string;
  hourlyCost: string;
  group: string;
  availableHours: string;
  status: "Ativo" | "Inativo";
  password: string;
  confirmPassword: string;
  permissions: string[];
};

const empty: MemberFormData = {
  name: "",
  username: "",
  email: "",
  phone: "",
  role: "TECHNICIAN",
  client: "",
  jobTitle: "",
  specialty: "",
  hourlyCost: "0,00",
  group: "",
  availableHours: "40",
  status: "Ativo",
  password: "",
  confirmPassword: "",
  permissions: [],
};

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "ADMIN", label: "Administrador" },
  { value: "MANAGER", label: "Gestor" },
  { value: "TECHNICIAN", label: "Técnico" },
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
  const [data, setData] = useState<MemberFormData>({ ...empty, ...initial });
  const { data: clients = [] } = useQuery({
    queryKey: ["member-form-clients"],
    queryFn: () => listClients(),
  });

  const selectedPermissionCount = data.permissions.length;
  const roleHint = useMemo(() => {
    switch (data.role) {
      case "ADMIN":
        return "Acesso completo ao workspace.";
      case "MANAGER":
        return "Gestao da operacao, projetos e relatorios.";
      case "CLIENT":
        return "Acesso restrito para acompanhamento.";
      default:
        return "Operacao diaria em chamados, backlog e sprints.";
    }
  }, [data.role]);

  const set = <K extends keyof MemberFormData>(key: K, value: MemberFormData[K]) =>
    setData((current) => ({ ...current, [key]: value }));

  const togglePermission = (permission: string) => {
    set(
      "permissions",
      data.permissions.includes(permission)
        ? data.permissions.filter((item) => item !== permission)
        : dedupePermissions([...data.permissions, permission]),
    );
  };

  const applyPreset = (permissions: string[]) => {
    set("permissions", dedupePermissions(permissions));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!data.name.trim() || !data.email.trim()) {
      toast.error("Nome e email sao obrigatorios");
      return;
    }

    if (data.role === "CLIENT" && !data.client) {
      toast.error("Selecione a conta do cliente para esse usuário");
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
      const member = await saveMember(data, mode, entityId);
      const targetId = member.id ? String(member.id) : entityId;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        targetId ? queryClient.invalidateQueries({ queryKey: ["user", targetId] }) : Promise.resolve(),
      ]);

      toast.success(mode === "create" ? "Usuário cadastrado" : "Usuário atualizado");
      if (targetId) {
        navigate({ to: "/teams/$id", params: { id: targetId } });
      } else {
        navigate({ to: onCancelHref });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar usuário");
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
          title="Perfil e capacidade"
          description="Tipo de usuário, papel operacional e disponibilidade."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de usuário" required hint={roleHint}>
              <Select
                value={data.role}
                onValueChange={(value) => set("role", value as UserRole)}
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
            {data.role === "CLIENT" && (
              <Field
                label="Conta do cliente"
                required
                hint="Esse vínculo libera o portal do cliente para o usuário."
              >
                <Select value={data.client || undefined} onValueChange={(value) => set("client", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
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
                  onChange={(event) => set("hourlyCost", maskCurrencyInput(event.target.value))}
                  placeholder="Ex: 80,00"
                  inputMode="decimal"
                  className="pl-10"
                />
              </div>
            </Field>
            <Field label="Grupo técnico">
              <Select value={data.group || undefined} onValueChange={(value) => set("group", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar grupo" />
                </SelectTrigger>
                <SelectContent>
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
          title="Permissoes"
          description="Aplique um perfil pronto ou monte os acessos do usuário."
        >
          <div className="flex flex-wrap gap-2">
            {PERMISSION_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => applyPreset(preset.permissions)}
              >
                <ShieldCheck className="h-4 w-4" />
                {preset.label}
              </Button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {selectedPermissionCount} permiss
            {selectedPermissionCount === 1 ? "ao" : "oes"} selecionada
            {selectedPermissionCount === 1 ? "" : "s"}.
          </p>

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
                        checked={data.permissions.includes(permission.value)}
                        onCheckedChange={() => togglePermission(permission.value)}
                        className="mt-0.5"
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-medium">
                          {permission.label}
                        </span>
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
      </div>

      <div className="space-y-5">
        <div className="sticky top-20 flex flex-col gap-2 rounded-2xl p-3 shadow-card glass">
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
    </form>
  );
}
