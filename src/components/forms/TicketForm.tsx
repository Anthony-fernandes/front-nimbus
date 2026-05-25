import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Field, FormSection } from "@/components/app/Field";
import { UserPickerField, type UserPickerOption } from "@/components/forms/UserPickerField";
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
import { Textarea } from "@/components/ui/textarea";
import {
  findTicketCategory,
  getCategoryDefaults,
  INTERNAL_TICKET_TYPE_OPTIONS,
  resolveTicketOpeningStatus,
  TICKET_IMPACT_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  TICKET_URGENCY_OPTIONS,
} from "@/lib/tickets";
import {
  formatImpactLabel,
  formatPriorityLabel,
  formatTicketStatusLabel,
  formatTicketTypeLabel,
  formatUrgencyLabel,
} from "@/lib/labels";
import { isClientUser } from "@/lib/auth";
import { listActivities } from "@/services/activityService";
import { listClients } from "@/services/clientService";
import { listTicketCategories } from "@/services/ticketCategoryService";
import { saveTicket } from "@/services/ticketService";
import { listUsers } from "@/services/userService";

type SelectOption = {
  value: string;
  label: string;
};

export type TicketFormData = {
  title: string;
  description: string;
  client: string;
  requester: string;
  category: string;
  categoryId: string;
  type: string;
  priority: string;
  impact: string;
  urgency: string;
  sla: string;
  status: string;
  tech: string[];
  team: string;
  project: string;
  linkedActivity: string;
  responsibleTechnician: string;
  openedAt: string;
  dueAt: string;
  estHours: string;
  doneHours: string;
  tags: string[];
  checklist: { text: string; done: boolean }[];
  origin: string;
  approvalRequired: boolean;
  approvalStatus: string;
  requiresClientValidation: boolean;
  internalNotes: string;
  convertToProjectActivity: boolean;
};

const empty: TicketFormData = {
  title: "",
  description: "",
  client: "",
  requester: "",
  category: "",
  categoryId: "",
  type: "Solicitacao",
  priority: "Pendente",
  impact: "Pendente",
  urgency: "Media",
  sla: "8h",
  status: "Aberto",
  tech: [],
  team: "",
  project: "",
  linkedActivity: "",
  responsibleTechnician: "",
  openedAt: new Date().toISOString().slice(0, 10),
  dueAt: "",
  estHours: "",
  doneHours: "0",
  tags: [],
  checklist: [],
  origin: "Interno",
  approvalRequired: false,
  approvalStatus: "",
  requiresClientValidation: true,
  internalNotes: "",
  convertToProjectActivity: false,
};

function toUserOption(user: {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string;
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
    subtitle: user.job_title || user.specialty || user.email || user.username || "Técnico disponível",
    keywords: [user.email || "", user.username || "", user.job_title || "", user.specialty || ""],
  };
}

export function TicketForm({
  initial,
  mode = "create",
  onCancelHref = "/tickets",
  entityId,
}: {
  initial?: Partial<TicketFormData>;
  mode?: "create" | "edit";
  onCancelHref?: string;
  entityId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [data, setData] = useState<TicketFormData>({ ...empty, ...initial });
  const [tagInput, setTagInput] = useState("");
  const [checkInput, setCheckInput] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["form-clients"],
    queryFn: () => listClients(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["form-users"],
    queryFn: () => listUsers(),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: () => listTicketCategories(),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["form-activities"],
    queryFn: () => listActivities(),
  });

  const clientOptions = clients.map((client) => ({ value: client.id, label: client.name }));
  const technicianOptions = users
    .filter((user) => !isClientUser(user))
    .map(toUserOption);
  const categoryOptions = categories
    .filter((category) => category.active ?? true)
    .map((category) => ({ value: category.id, label: category.name }));
  const linkedActivityOptions = activities
    .filter(
      (activity) =>
        !entityId || activity.ticket === entityId || activity.id === data.linkedActivity,
    )
    .map((activity) => ({
      value: activity.id,
      label: `${activity.title}${activity.project_name ? ` · ${activity.project_name}` : ""}`,
    }));

  const selectedCategory = useMemo(
    () => findTicketCategory(categories, data.categoryId || data.category),
    [categories, data.category, data.categoryId],
  );

  useEffect(() => {
    if (data.categoryId || !data.category) return;
    const category = findTicketCategory(categories, data.category);
    if (!category) return;
    setData((current) => ({
      ...current,
      categoryId: category.id,
      category: category.name,
    }));
  }, [categories, data.category, data.categoryId]);

  const set = <K extends keyof TicketFormData>(key: K, value: TicketFormData[K]) =>
    setData((current) => ({ ...current, [key]: value }));

  const applyCategoryDefaults = (categoryId: string) => {
    const category = findTicketCategory(categories, categoryId);
    if (!category) {
      set("categoryId", categoryId);
      set("category", categoryId);
      return;
    }

    const defaults = getCategoryDefaults(category);
    setData((current) => ({
      ...current,
      categoryId: category.id,
      category: category.name,
      type:
        current.type && current.type !== "Solicitacao"
          ? current.type
          : defaults.type,
      priority:
        current.priority && current.priority !== "Pendente"
          ? current.priority
          : defaults.priority,
      impact:
        current.impact && current.impact !== "Pendente"
          ? current.impact
          : defaults.impact,
      team: current.team || defaults.team,
      sla: current.sla && current.sla !== "8h" ? current.sla : defaults.sla,
      approvalRequired: defaults.approvalRequired,
      requiresClientValidation: defaults.requiresClientValidation,
      status:
        current.status === "Aberto" || current.status === "Aguardando aprovacao"
          ? resolveTicketOpeningStatus(category)
          : current.status,
    }));
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    set("tags", [...data.tags, tagInput.trim()]);
    setTagInput("");
  };

  const addChecklistItem = () => {
    if (!checkInput.trim()) return;
    set("checklist", [...data.checklist, { text: checkInput.trim(), done: false }]);
    setCheckInput("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!data.title.trim() || !data.client || !data.requester.trim()) {
      toast.error("Preencha título, cliente e solicitante.");
      return;
    }

    try {
      const saved = await saveTicket(data, mode, entityId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["ticket", saved.id] }),
      ]);
      toast.success(mode === "create" ? "Chamado criado com sucesso." : "Chamado atualizado.");
      navigate({ to: `/tickets/${saved.id}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar chamado.");
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <FormSection
          title="Dados da solicitação"
          description="Informações básicas do chamado e do solicitante."
        >
          <Field label="Título" required>
            <Input
              value={data.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Ex.: Erro ao autenticar via SSO"
              required
              maxLength={140}
            />
          </Field>
          <Field
            label="Descrição"
            required
            hint="Descreva o contexto, o impacto e o comportamento esperado."
          >
            <Textarea
              value={data.description}
              onChange={(event) => set("description", event.target.value)}
              rows={6}
              required
              maxLength={4000}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente" required>
              <Selectable
                value={data.client}
                onChange={(value) => set("client", value)}
                options={clientOptions}
                placeholder="Selecionar cliente"
              />
            </Field>
            <Field label="Solicitante" required>
              <Input
                value={data.requester}
                onChange={(event) => set("requester", event.target.value)}
                placeholder="Nome do solicitante"
                required
              />
            </Field>
            <Field label="Origem">
              <Input value={data.origin} disabled />
            </Field>
            <Field
              label={mode === "create" ? "Status inicial" : "Status"}
              hint={
                mode === "edit"
                  ? "O status segue o workflow do chamado e deve ser alterado pelas acoes de fluxo."
                  : undefined
              }
            >
              <Selectable
                value={data.status}
                onChange={(value) => set("status", value)}
                options={TICKET_STATUS_OPTIONS.map((status) => ({
                  value: status,
                  label: formatTicketStatusLabel(status),
                }))}
                disabled={mode === "edit"}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Categorização interna"
          description="Defina a classificação e as regras operacionais do chamado."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Categoria">
              <Selectable
                value={data.categoryId || data.category}
                onChange={applyCategoryDefaults}
                options={categoryOptions}
                placeholder="Selecionar categoria"
              />
            </Field>
            <Field label="Tipo">
              <Selectable
                value={data.type}
                onChange={(value) => set("type", value)}
                options={INTERNAL_TICKET_TYPE_OPTIONS.map((item) => ({
                  value: item,
                  label: formatTicketTypeLabel(item),
                }))}
              />
            </Field>
            <Field label="Prioridade">
              <Selectable
                value={data.priority}
                onChange={(value) => set("priority", value)}
                options={TICKET_PRIORITY_OPTIONS.map((item) => ({
                  value: item,
                  label: formatPriorityLabel(item),
                }))}
              />
            </Field>
            <Field label="Impacto">
              <Selectable
                value={data.impact}
                onChange={(value) => set("impact", value)}
                options={TICKET_IMPACT_OPTIONS.map((item) => ({
                  value: item,
                  label: formatImpactLabel(item),
                }))}
              />
            </Field>
            <Field label="Urgência">
              <Selectable
                value={data.urgency}
                onChange={(value) => set("urgency", value)}
                options={TICKET_URGENCY_OPTIONS.map((item) => ({
                  value: item,
                  label: formatUrgencyLabel(item),
                }))}
              />
            </Field>
            <Field label="SLA">
              <Input
                value={data.sla}
                onChange={(event) => set("sla", event.target.value)}
                placeholder="Ex.: 8h"
              />
            </Field>
            <Field label="Exige aprovação">
              <ToggleField
                checked={data.approvalRequired}
                onCheckedChange={(checked) => set("approvalRequired", checked)}
                label={
                  selectedCategory?.approval_required
                    ? "Categoria exige aprovação."
                    : "Sem aprovação obrigatória."
                }
              />
            </Field>
            <Field label="Exige avaliação do cliente">
              <ToggleField
                checked={data.requiresClientValidation}
                onCheckedChange={(checked) => set("requiresClientValidation", checked)}
                label={
                  data.requiresClientValidation
                    ? "Retorna para validação do cliente."
                    : "Pode ser finalizado internamente."
                }
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Atendimento técnico"
          description="Equipe, responsáveis, esforço e controles internos do chamado."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Equipe responsável">
              <Input
                value={data.team}
                onChange={(event) => set("team", event.target.value)}
                placeholder="Ex.: Suporte N2"
              />
            </Field>
            <Field label="Técnico responsável">
              <UserPickerField
                options={technicianOptions}
                selected={data.responsibleTechnician ? [data.responsibleTechnician] : []}
                onChange={(selected) => set("responsibleTechnician", selected[0] || "")}
                placeholder="Adicionar responsável..."
                emptySelectedText="Nenhum responsável adicionado ainda."
                maxSelections={1}
              />
            </Field>
            <Field label="Atividade vinculada">
              <Selectable
                value={data.linkedActivity}
                onChange={(value) => set("linkedActivity", value)}
                options={linkedActivityOptions}
                placeholder="Nenhuma atividade"
                allowEmpty
              />
            </Field>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Técnicos envolvidos</div>
              <p className="text-[11px] text-muted-foreground">
                Use múltiplos técnicos quando o atendimento exigir colaboração.
              </p>
            </div>
            <UserPickerField
              options={technicianOptions}
              selected={data.tech}
              onChange={(selected) => set("tech", selected)}
              placeholder="Adicionar responsável..."
              emptySelectedText="Nenhum responsável adicionado ainda."
            />
          </div>
        </FormSection>

        <FormSection
          title="Checklist e observações"
          description="Estruture a execução técnica e registre o contexto interno."
        >
          <div className="flex gap-2">
            <Input
              value={checkInput}
              onChange={(event) => setCheckInput(event.target.value)}
              placeholder="Nova etapa..."
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addChecklistItem();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addChecklistItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {data.checklist.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">Nenhuma etapa adicionada.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.checklist.map((item, index) => (
                <li
                  key={`${item.text}-${index}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "checklist",
                        data.checklist.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, done: !entry.done } : entry,
                        ),
                      )
                    }
                    className={`grid h-4 w-4 place-items-center rounded border ${
                      item.done ? "border-success bg-success" : "border-border"
                    }`}
                  >
                    {item.done && <Check className="h-3 w-3 text-success-foreground" />}
                  </button>
                  <span className={item.done ? "text-muted-foreground line-through" : ""}>
                    {item.text}
                  </span>
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      set(
                        "checklist",
                        data.checklist.filter((_, entryIndex) => entryIndex !== index),
                      )
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Field label="Observações internas">
            <Textarea
              value={data.internalNotes}
              onChange={(event) => set("internalNotes", event.target.value)}
              rows={4}
              placeholder="Use este campo para contexto técnico, riscos e decisões internas."
            />
          </Field>
        </FormSection>
      </div>

      <div className="space-y-5">
        <FormSection title="Datas e esforço">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Abertura">
              <Input
                type="date"
                value={data.openedAt}
                onChange={(event) => set("openedAt", event.target.value)}
              />
            </Field>
            <Field label="Prazo">
              <Input
                type="date"
                value={data.dueAt}
                onChange={(event) => set("dueAt", event.target.value)}
              />
            </Field>
            <Field label="Estimadas (h)">
              <Input
                type="number"
                min={0}
                value={data.estHours}
                onChange={(event) => set("estHours", event.target.value)}
              />
            </Field>
            <Field label="Trabalhadas (h)">
              <Input
                type="number"
                min={0}
                value={data.doneHours}
                onChange={(event) => set("doneHours", event.target.value)}
              />
            </Field>
          </div>
        </FormSection>

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

        <FormSection title="Conversão em atividade de projeto">
          <ToggleField
            checked={data.convertToProjectActivity}
            onCheckedChange={(checked) => set("convertToProjectActivity", checked)}
            label={
              data.convertToProjectActivity
                ? "Este chamado deve virar atividade de projeto."
                : "Resolver como chamado normal."
            }
          />
          <p className="text-xs text-muted-foreground">
            O chamado continua independente do projeto. Quando for convertido, escolha o projeto
            diretamente na atividade criada a partir dele.
          </p>
        </FormSection>

        <FormSection title="Anexos">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/40">
            <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">
              A interface está pronta para anexos. A API atual pode ainda não persistir os arquivos.
            </p>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={() => toast.success("Arquivos preparados para envio.")}
            />
          </label>
        </FormSection>

        <div className="sticky bottom-0 flex flex-col gap-2 rounded-2xl p-3 shadow-card glass">
          <Button
            type="submit"
            className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {mode === "create" ? "Criar chamado" : "Salvar alterações"}
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
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value || (allowEmpty ? "__none__" : undefined)}
      disabled={disabled}
      onValueChange={(nextValue) => onChange(nextValue === "__none__" ? "" : nextValue)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "Selecionar"} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__none__">Nenhum</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleField({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 transition-colors hover:border-primary/40">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
        className="mt-0.5"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
