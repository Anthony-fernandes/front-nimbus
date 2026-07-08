import { FormEvent, useMemo, useState } from "react";
import { z } from "zod";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Field, FormSection } from "@/components/app/Field";
import { UserPickerField, type UserPickerOption } from "@/components/forms/UserPickerField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getUserOrganizationIds, isClientUser } from "@/lib/auth";
import { formatProjectStatusLabel } from "@/lib/labels";
import type { ProjectStage } from "@/lib/types";
import { listOrganizations } from "@/services/clientService";
import { listDepartments } from "@/services/orgService";
import { saveProject } from "@/services/projectService";
import { formatDate , parseApiError} from "@/services/utils";
import { listUsers } from "@/services/userService";

type SelectOption = {
  value: string;
  label: string;
};

export type ProjectFormData = {
  name: string;
  organization: string;
  department: string;
  tipo: "interno" | "cliente";
  metodologia: "scrum" | "kanban" | "hibrido" | "tradicional";
  contactPrincipal: string;
  leader: string;
  team: string[];
  status: string;
  startAt: string;
  endAt: string;
  budget: string;
  costReal: string;
  estHours: string;
  usedHours: string;
  tags: string[];
  description: string;
  stages: ProjectStage[];
};

const empty: ProjectFormData = {
  name: "",
  organization: "",
  department: "",
  tipo: "cliente",
  metodologia: "scrum",
  contactPrincipal: "",
  leader: "",
  team: [],
  status: "Planejado",
  startAt: new Date().toISOString().slice(0, 10),
  endAt: "",
  budget: "",
  costReal: "0",
  estHours: "",
  usedHours: "0",
  tags: [],
  description: "",
  stages: [],
};

function createProjectStageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `stage-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function toUserOption(user: {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  job_title?: string;
  specialty?: string;
}): UserPickerOption {
  const label =
    user.name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username ||
    "Usuário";

  return {
    value: user.id,
    label,
    subtitle: user.job_title || user.specialty || user.email || user.username || "Usuário da equipe",
    keywords: [user.email || "", user.username || "", user.job_title || "", user.specialty || ""],
  };
}

export function ProjectForm({
  initial,
  mode = "create",
  onCancelHref = "/projects",
  entityId,
}: {
  initial?: Partial<ProjectFormData>;
  mode?: "create" | "edit";
  onCancelHref?: string;
  entityId?: string;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectFormData>({ ...empty, ...initial });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState("");
  const [stageTitleInput, setStageTitleInput] = useState("");
  const [stageExpectedEndInput, setStageExpectedEndInput] = useState("");

  const { data: organizations = [] } = useQuery({
    queryKey: ["form-organizations"],
    queryFn: () => listOrganizations(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => listDepartments(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["form-users"],
    queryFn: () => listUsers(),
  });

  const organizationOptions: SelectOption[] = organizations.map((organization) => ({
    value: organization.id,
    label: organization.name,
  }));
  const internalUserOptions: UserPickerOption[] = users
    .filter((user) => !isClientUser(user))
    .map(toUserOption);
  const organizationUserOptions: UserPickerOption[] = users
    .filter((user) => {
      if (!data.organization) return true;
      return getUserOrganizationIds(user).includes(data.organization);
    })
    .map(toUserOption);
  const progressPreview = useMemo(() => {
    const estHours = Number(data.estHours || 0);
    const usedHours = Number(data.usedHours || 0);
    if (!estHours) return 0;
    return Math.min(100, Math.round((usedHours / estHours) * 100));
  }, [data.estHours, data.usedHours]);

  const set = <K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) =>
    setData((current) => ({ ...current, [key]: value }));

  const addStage = () => {
    if (!stageTitleInput.trim()) return;

    set("stages", [
      ...data.stages,
      {
        id: createProjectStageId(),
        title: stageTitleInput.trim(),
        expectedEndDate: stageExpectedEndInput || undefined,
        completed: false,
      },
    ]);
    setStageTitleInput("");
    setStageExpectedEndInput("");
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    set("tags", [...data.tags, tagInput.trim()]);
    setTagInput("");
  };

  const projectSchema = z.object({
    name: z.string().min(1, "Nome do projeto é obrigatório"),
    endAt: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: "Data de término inválida" }),
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const validation = projectSchema.safeParse({ name: data.name, endAt: data.endAt });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      }
      setFormErrors(fieldErrors);
      return;
    }
    setFormErrors({});

    if (data.tipo === "cliente" && !data.organization) {
      toast.error("Selecione o cliente atendido");
      return;
    }
    if (data.tipo === "interno" && !data.department) {
      toast.error("Selecione o departamento responsável");
      return;
    }

    try {
      await saveProject(data, mode, entityId);
      toast.success(mode === "create" ? "Projeto criado" : "Projeto atualizado");
      navigate({ to: onCancelHref });
    } catch (error) {
      toast.error(parseApiError(error, "Erro ao salvar projeto"));
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <FormSection
          title="Informações do projeto"
          description="Escopo principal, organização atendida e lideranca interna da entrega."
        >
          <Field label="Nome do projeto" required>
            <Input
              value={data.name}
              onChange={(event) => set("name", event.target.value)}
              required
            />
            {formErrors.name && (
              <p className="mt-1 text-xs text-destructive">{formErrors.name}</p>
            )}
          </Field>
          <Field label="Descrição">
            <Textarea
              value={data.description}
              onChange={(event) => set("description", event.target.value)}
              rows={5}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de projeto" required>
              <Select value={data.tipo} onValueChange={(v) => set("tipo", v as ProjectFormData["tipo"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Para cliente externo</SelectItem>
                  <SelectItem value="interno">Interno (departamento)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Metodologia">
              <Select value={data.metodologia} onValueChange={(v) => set("metodologia", v as ProjectFormData["metodologia"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scrum">Scrum</SelectItem>
                  <SelectItem value="kanban">Kanban</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                  <SelectItem value="tradicional">Tradicional</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {data.tipo === "cliente" ? (
            <Field
              label="Cliente atendido"
              required
              hint="Empresa ou cliente externo para quem o projeto será entregue."
            >
              <Selectable
                value={data.organization}
                onChange={(value) => set("organization", value)}
                options={organizationOptions}
                placeholder="Selecionar cliente"
              />
            </Field>
            ) : (
            <Field
              label="Departamento responsável"
              required
              hint="Departamento interno para quem o projeto pertence."
            >
              <Selectable
                value={data.department}
                onChange={(value) => set("department", value)}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                placeholder="Selecionar departamento"
              />
            </Field>
            )}
            <Field
              label="Contato principal"
              hint="Pessoa da organização que acompanha escopo, dúvidas e validações do projeto."
            >
              <UserPickerField
                options={organizationUserOptions}
                selected={data.contactPrincipal ? [data.contactPrincipal] : []}
                onChange={(selected) => set("contactPrincipal", selected[0] || "")}
                placeholder="Selecionar contato principal..."
                emptySelectedText="Nenhum contato principal definido."
                maxSelections={1}
              />
            </Field>
            <Field
              label="Lider do projeto"
              hint="Selecione a pessoa responsável por conduzir o projeto."
            >
              <UserPickerField
                options={internalUserOptions}
                selected={data.leader ? [data.leader] : []}
                onChange={(selected) => set("leader", selected[0] || "")}
                placeholder="Selecionar lider do projeto..."
                emptySelectedText="Nenhum lider selecionado."
                maxSelections={1}
              />
            </Field>
            <Field label="Status">
              <Select value={data.status} onValueChange={(value) => set("status", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar status" />
                </SelectTrigger>
                <SelectContent>
                  {["Planejado", "Em andamento", "Em risco", "Pausado", "Concluido"].map(
                    (option) => (
                      <SelectItem key={option} value={option}>
                        {formatProjectStatusLabel(option)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Equipe do projeto"
          description="Adicione os membros que participarao das atividades e sprints."
        >
          <UserPickerField
            options={internalUserOptions}
            selected={data.team}
            onChange={(selected) => set("team", selected)}
            placeholder="Adicionar membro da equipe..."
            emptySelectedText="Nenhum membro da equipe adicionado ainda."
          />
        </FormSection>

        <FormSection title="Cronograma">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de início">
              <Input
                type="date"
                value={data.startAt}
                onChange={(event) => set("startAt", event.target.value)}
              />
            </Field>
            <Field label="Data de termino">
              <Input
                type="date"
                value={data.endAt}
                onChange={(event) => set("endAt", event.target.value)}
              />
              {formErrors.endAt && (
                <p className="mt-1 text-xs text-destructive">{formErrors.endAt}</p>
              )}
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Custos e esforco"
          description="Orcamento e horas usadas para projetar o progresso."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Orcamento (R$)">
              <Input
                type="number"
                min={0}
                value={data.budget}
                onChange={(event) => set("budget", event.target.value)}
              />
            </Field>
            <Field
              label="Custo realizado (R$)"
              hint="Calculado pelos lancamentos da aba Custos no detalhe do projeto."
            >
              <Input
                type="number"
                min={0}
                value={data.costReal}
                readOnly
                className="cursor-not-allowed opacity-80"
              />
            </Field>
            <Field label="Horas estimadas">
              <Input
                type="number"
                min={0}
                value={data.estHours}
                onChange={(event) => set("estHours", event.target.value)}
              />
            </Field>
            <Field label="Horas consumidas">
              <Input
                type="number"
                min={0}
                value={data.usedHours}
                onChange={(event) => set("usedHours", event.target.value)}
              />
            </Field>
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Progresso estimado
              </div>
              <div className="mt-1 text-lg font-semibold">{progressPreview}%</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-primary"
                  style={{ width: `${progressPreview}%` }}
                />
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Etapas do projeto"
          description="Cadastre as principais etapas e suas previsoes de termino."
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
            <Field label="Nome da etapa">
              <Input
                value={stageTitleInput}
                onChange={(event) => setStageTitleInput(event.target.value)}
                placeholder="Nome da etapa..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addStage();
                  }
                }}
              />
            </Field>
            <Field label="Previsao de termino">
              <Input
                type="date"
                value={stageExpectedEndInput}
                onChange={(event) => setStageExpectedEndInput(event.target.value)}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full lg:w-10 lg:px-0"
              onClick={addStage}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {data.stages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                Nenhuma etapa cadastrada ainda.
              </div>
            ) : (
              data.stages.map((stage) => (
                <div
                  key={stage.id}
                  className="rounded-xl border border-border bg-muted/30 px-4 py-3 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{stage.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {stage.expectedEndDate
                          ? `Previsao de termino: ${formatDate(stage.expectedEndDate)}`
                          : "Sem previsao de termino definida."}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground transition hover:text-destructive"
                      onClick={() =>
                        set(
                          "stages",
                          data.stages.filter((entry) => entry.id !== stage.id),
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </FormSection>
      </div>

      <div className="space-y-5">
        <FormSection title="Tags">
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="Adicionar tag"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() =>
                    set("tags", data.tags.filter((_, tagIndex) => tagIndex !== index))
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </FormSection>

        <FormSection title="Anexos">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition hover:border-primary/40">
            <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">Enviar documentos do projeto</p>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={() => toast.success("Arquivos prontos para upload")}
            />
          </label>
        </FormSection>

        <div className="glass sticky bottom-0 flex flex-col gap-2 rounded-2xl p-3 shadow-card">
          <Button
            type="submit"
            className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {mode === "create" ? "Criar projeto" : "Salvar alterações"}
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

function Selectable({
  value,
  onChange,
  options,
  placeholder,
  allowEmpty = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  return (
    <Select
      value={value || (allowEmpty ? "__none__" : undefined)}
      onValueChange={(nextValue) => onChange(nextValue === "__none__" ? "" : nextValue)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "Selecionar"} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? <SelectItem value="__none__">Nenhum</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
