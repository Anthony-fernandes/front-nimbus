import { FormEvent, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { z } from "zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, LayoutTemplate, Plus, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { getUserDisplayName, getUserOrganizationIds, isClientUser } from "@/lib/auth";
import type { User } from "@/lib/types";
import { Field, FormSection } from "@/components/app/Field";
import { UserPickerField, type UserPickerOption } from "@/components/forms/UserPickerField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/services/api";
import { listActivities } from "@/services/activityService";
import { listActivityTags } from "@/services/activityTagService";
import { listOrganizations } from "@/services/clientService";
import { listTicketCategories } from "@/services/ticketCategoryService";
import { saveTicket } from "@/services/ticketService";
import { listUsers } from "@/services/userService";
import { getStoredUser } from "@/services/authService";
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

type SelectOption = {
  value: string;
  label: string;
};

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

function sanitizeSelectOptions(options: SelectOption[]) {
  const seen = new Set<string>();

  return options.flatMap((option) => {
    const normalizedValue = String(option.value ?? "").trim();
    const normalizedLabel = String(option.label ?? "").trim() || normalizedValue;

    if (!normalizedValue || seen.has(normalizedValue)) {
      return [];
    }

    seen.add(normalizedValue);

    return [
      {
        value: normalizedValue,
        label: normalizedLabel,
      },
    ];
  });
}

export type TicketFormData = {
  title: string;
  description: string;
  organization: string;
  requesterUser: string;
  contactResponsibleName: string;
  contactResponsiblePhone: string;
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
  organization: "",
  requesterUser: "",
  contactResponsibleName: "",
  contactResponsiblePhone: "",
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
    "Usuario";

  return {
    value: user.id,
    label,
    subtitle: user.job_title || user.specialty || user.email || user.username || "Usuario disponivel",
    keywords: [user.email || "", user.username || "", user.job_title || "", user.specialty || ""],
  };
}

function toUserSelectOption(user: {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
}): SelectOption {
  return {
    value: user.id,
    label:
      user.name ||
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.username ||
      user.email ||
      "Usuario",
  };
}

function getUserPhone(user: { phone?: string | null }): string {
  return user.phone ?? "";
}

function getRequesterAutofill(user: {
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  phone?: string | null;
} | null) {
  if (!user) return null;

  return {
    name: getUserDisplayName(user as Partial<User>),
    phone: getUserPhone(user),
  };
}

function findUserById(users: User[], id: string) {
  const normalizedId = normalizeId(id);
  if (!normalizedId) return null;
  return users.find((user) => normalizeId(user.id) === normalizedId) || null;
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
  const currentUser = useMemo(() => getStoredUser<User>(), []);
  const [data, setData] = useState<TicketFormData>({ ...empty, ...initial });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [tagSearch, setTagSearch] = useState("");
  const [checkInput, setCheckInput] = useState("");
  const contactAutofillRef = useRef<{ name: string; phone: string } | null>(null);

  // Template selector state
  type TicketTemplate = {
    id: string;
    name: string;
    title: string;
    type: string;
    priority: string;
    description_template: string;
    tags: string[];
  };
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const openTemplateDialog = useCallback(async () => {
    setTemplateDialogOpen(true);
    if (templates.length > 0) return;
    setTemplatesLoading(true);
    try {
      const res = await api.get("/ticket-templates/");
      setTemplates(res.data as TicketTemplate[]);
    } catch {
      // ignore
    } finally {
      setTemplatesLoading(false);
    }
  }, [templates.length]);

  const applyTemplate = (template: TicketTemplate) => {
    setData((current) => ({
      ...current,
      title: template.title || current.title,
      type: template.type || current.type,
      priority: template.priority || current.priority,
      description: template.description_template || current.description,
      tags: template.tags?.length ? template.tags : current.tags,
    }));
    setTemplateDialogOpen(false);
    toast.success(`Template "${template.name}" aplicado.`);
  };

  const { data: organizations = [] } = useQuery({
    queryKey: ["form-organizations"],
    queryFn: () => listOrganizations(),
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
  const { data: activityTags = [] } = useQuery({
    queryKey: ["activity-tag-configs"],
    queryFn: () => listActivityTags(),
  });

  const organizationOptions = organizations.map((organization) => ({
    value: organization.id,
    label: organization.name,
  }));
  const technicianOptions = users.filter((user) => !isClientUser(user)).map(toUserOption);
  const technicianSelectOptions = users
    .filter((user) => !isClientUser(user))
    .map(toUserSelectOption);
  const requesterOptions = users
    .filter((user) => {
      if (!data.organization) return true;
      return getUserOrganizationIds(user).includes(data.organization);
    })
    .map(toUserOption);
  const requesterSelectOptions = users
    .filter((user) => {
      if (!data.organization) return true;
      return getUserOrganizationIds(user).includes(data.organization);
    })
    .map(toUserSelectOption);
  const requesterUser = useMemo(
    () => findUserById(users, data.requesterUser),
    [data.requesterUser, users],
  );
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
  const selectedTagNames = useMemo(
    () => new Set(data.tags.map((tagName) => normalizeSearch(tagName))),
    [data.tags],
  );
  const selectedConfiguredTags = useMemo(
    () =>
      data.tags
        .map((tagName) =>
          activityTags.find((tag) => normalizeSearch(tag.name) === normalizeSearch(tagName)),
        )
        .filter((tag): tag is NonNullable<typeof activityTags[number]> => Boolean(tag)),
    [activityTags, data.tags],
  );
  const selectedLegacyTagNames = useMemo(
    () =>
      data.tags.filter(
        (tagName) =>
          !activityTags.some((tag) => normalizeSearch(tag.name) === normalizeSearch(tagName)),
      ),
    [activityTags, data.tags],
  );
  const availableTags = useMemo(() => {
    const normalizedQuery = normalizeSearch(tagSearch);

    return activityTags.filter((tag) => {
      if (!tag.active || selectedTagNames.has(normalizeSearch(tag.name))) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return normalizeSearch([tag.name, tag.description || ""].join(" ")).includes(
        normalizedQuery,
      );
    });
  }, [activityTags, selectedTagNames, tagSearch]);

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

  useEffect(() => {
    if (!data.organization) return;

    const scopedUserIds = new Set(
      users
        .filter((user) => getUserOrganizationIds(user).includes(data.organization))
        .map((user) => user.id),
    );

    setData((current) => {
      const requesterStillValid =
        current.requesterUser && scopedUserIds.has(current.requesterUser);

      if (requesterStillValid) {
        return current;
      }

      const previousAutofill = contactAutofillRef.current;
      const shouldClearName =
        !current.contactResponsibleName
        || current.contactResponsibleName === previousAutofill?.name;
      const shouldClearPhone =
        !current.contactResponsiblePhone
        || current.contactResponsiblePhone === previousAutofill?.phone;

      contactAutofillRef.current = null;

      return {
        ...current,
        requesterUser: "",
        contactResponsibleName: shouldClearName ? "" : current.contactResponsibleName,
        contactResponsiblePhone: shouldClearPhone ? "" : current.contactResponsiblePhone,
      };
    });
  }, [data.organization, users]);

  useEffect(() => {
    if (!requesterUser) {
      return;
    }

    const autofill = getRequesterAutofill(requesterUser);
    if (!autofill) {
      return;
    }

    setData((current) => {
      const previousAutofill = contactAutofillRef.current;
      const shouldUpdateName =
        !current.contactResponsibleName
        || current.contactResponsibleName === previousAutofill?.name;
      const shouldUpdatePhone =
        !current.contactResponsiblePhone
        || current.contactResponsiblePhone === previousAutofill?.phone;

      if (!shouldUpdateName && !shouldUpdatePhone) {
        return current;
      }

      return {
        ...current,
        contactResponsibleName: shouldUpdateName
          ? autofill.name
          : current.contactResponsibleName,
        contactResponsiblePhone: shouldUpdatePhone
          ? autofill.phone
          : current.contactResponsiblePhone,
      };
    });

    contactAutofillRef.current = autofill;
  }, [requesterUser]);

  const set = <K extends keyof TicketFormData>(key: K, value: TicketFormData[K]) =>
    setData((current) => ({ ...current, [key]: value }));

  const handleRequesterChange = (requesterId: string) => {
    const selectedRequester = findUserById(users, requesterId);
    const autofill = getRequesterAutofill(selectedRequester)
      || getRequesterAutofill(
        currentUser && normalizeId(currentUser.id) === normalizeId(requesterId) ? currentUser : null,
      );

    setData((current) => ({
      ...current,
      requesterUser: normalizeId(requesterId),
      contactResponsibleName: autofill?.name || "",
      contactResponsiblePhone: autofill?.phone || "",
    }));

    contactAutofillRef.current = autofill;
  };

  useEffect(() => {
    if (!currentUser || !isClientUser(currentUser) || !data.organization || data.requesterUser) {
      return;
    }

    const currentUserOrganizationIds = getUserOrganizationIds(currentUser);
    if (!currentUserOrganizationIds.includes(data.organization)) {
      return;
    }

    const requesterExistsInOptions = users.some(
      (user) => normalizeId(user.id) === normalizeId(currentUser.id),
    );
    if (!requesterExistsInOptions) {
      return;
    }

    handleRequesterChange(currentUser.id);
  }, [currentUser, data.organization, data.requesterUser, users]);

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

  const addTag = (tagName: string) => {
    if (!tagName.trim() || selectedTagNames.has(normalizeSearch(tagName))) return;
    set("tags", [...data.tags, tagName]);
    setTagSearch("");
  };

  const addChecklistItem = () => {
    if (!checkInput.trim()) return;
    set("checklist", [...data.checklist, { text: checkInput.trim(), done: false }]);
    setCheckInput("");
  };

  const removeTag = (tagName: string) => {
    const normalizedTagName = normalizeSearch(tagName);
    set(
      "tags",
      data.tags.filter((entry) => normalizeSearch(entry) !== normalizedTagName),
    );
  };

  const ticketSchema = z.object({
    title: z.string().min(3, "Título deve ter ao menos 3 caracteres"),
    priority: z.string().min(1, "Prioridade é obrigatória"),
    description: z.string().max(2000, "Descrição deve ter no máximo 2000 caracteres"),
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const validation = ticketSchema.safeParse({
      title: data.title,
      priority: data.priority,
      description: data.description,
    });
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

    if (!data.organization || !data.requesterUser) {
      toast.error("Preencha organizacao atendida e solicitante.");
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
      {/* Template selector button — fetches /ticket-templates/ and pre-fills form */}
      <div className="lg:col-span-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={openTemplateDialog}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Usar template
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </div>

      <div className="space-y-5 lg:col-span-2">
        <FormSection
          title="Dados da solicitacao"
          description="Informacoes basicas do chamado, da organizacao atendida e dos envolvidos."
        >
          <Field label="Titulo" required>
            <Input
              value={data.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Ex.: Erro ao autenticar via SSO"
              required
              maxLength={140}
            />
            {formErrors.title && (
              <p className="mt-1 text-xs text-destructive">{formErrors.title}</p>
            )}
          </Field>
          <Field
            label="Descricao"
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
            {formErrors.description && (
              <p className="mt-1 text-xs text-destructive">{formErrors.description}</p>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Organizacao atendida"
              required
              hint="Selecione a organizacao, cliente, setor ou area atendida."
            >
              <Selectable
                value={data.organization}
                onChange={(value) => set("organization", value)}
                options={organizationOptions}
                placeholder="Selecionar organizacao"
              />
            </Field>
            <Field
              label="Solicitante"
              required
              hint="Selecione o usuario que abriu ou solicitou a demanda."
            >
              <Selectable
                value={data.requesterUser}
                onChange={handleRequesterChange}
                options={requesterSelectOptions}
                placeholder="Selecionar solicitante"
              />
            </Field>
            <Field
              label="Contato responsavel"
              hint="Pessoa de referencia para duvidas, validacao e aprovacao da demanda."
            >
              <Input
                value={data.contactResponsibleName}
                onChange={(event) => set("contactResponsibleName", event.target.value)}
                placeholder="Nome do contato responsavel"
                maxLength={140}
              />
            </Field>
            <Field
              label="Telefone do contato"
              hint="Use o telefone principal para duvidas, alinhamentos e aprovacao."
            >
              <Input
                value={data.contactResponsiblePhone}
                onChange={(event) => set("contactResponsiblePhone", event.target.value)}
                placeholder="(00) 00000-0000"
                maxLength={30}
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
          title="Categorizacao interna"
          description="Defina a classificacao e as regras operacionais do chamado."
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
              {formErrors.priority && (
                <p className="mt-1 text-xs text-destructive">{formErrors.priority}</p>
              )}
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
            <Field label="Urgencia">
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
            <Field label="Exige aprovacao">
              <ToggleField
                checked={data.approvalRequired}
                onCheckedChange={(checked) => set("approvalRequired", checked)}
                label={
                  selectedCategory?.approval_required
                    ? "Categoria exige aprovacao."
                    : "Sem aprovacao obrigatoria."
                }
              />
            </Field>
            <Field label="Exige avaliacao da organizacao">
              <ToggleField
                checked={data.requiresClientValidation}
                onCheckedChange={(checked) => set("requiresClientValidation", checked)}
                label={
                  data.requiresClientValidation
                    ? "Retorna para validacao da organizacao."
                    : "Pode ser finalizado internamente."
                }
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Atendimento tecnico"
          description="Equipe, responsaveis, esforco e controles internos do chamado."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Equipe responsavel">
              <Input
                value={data.team}
                onChange={(event) => set("team", event.target.value)}
                placeholder="Ex.: Suporte N2"
              />
            </Field>
            <Field
              label="Responsavel tecnico"
              hint="Selecione o tecnico ou responsavel interno pelo atendimento."
            >
              <Selectable
                value={data.responsibleTechnician}
                onChange={(value) => set("responsibleTechnician", value)}
                options={technicianSelectOptions}
                placeholder="Selecionar responsavel tecnico"
                allowEmpty
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
              <div className="text-xs font-medium text-muted-foreground">Tecnicos envolvidos</div>
              <p className="text-[11px] text-muted-foreground">
                Use multiplos tecnicos quando o atendimento exigir colaboracao.
              </p>
            </div>
            <UserPickerField
              options={technicianOptions}
              selected={data.tech}
              onChange={(selected) => set("tech", selected)}
              placeholder="Adicionar tecnico..."
              emptySelectedText="Nenhum tecnico envolvido ainda."
            />
          </div>
        </FormSection>

        <FormSection
          title="Checklist e observacoes"
          description="Estruture a execucao tecnica e registre o contexto interno."
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
                    {item.done ? <Check className="h-3 w-3 text-success-foreground" /> : null}
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
          <Field label="Observacoes internas">
            <Textarea
              value={data.internalNotes}
              onChange={(event) => set("internalNotes", event.target.value)}
              rows={4}
              placeholder="Use este campo para contexto tecnico, riscos e decisoes internas."
            />
          </Field>
        </FormSection>
      </div>

      <div className="space-y-5">
        <FormSection title="Datas e esforco">
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
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/15">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <Input
                  value={tagSearch}
                  onChange={(event) => setTagSearch(event.target.value)}
                  placeholder="Selecionar tags..."
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="max-h-[220px] space-y-1 overflow-y-auto overscroll-contain p-2">
                {availableTags.length === 0 ? (
                  <div className="rounded-xl px-3 py-3 text-sm text-muted-foreground">
                    {activityTags.length === 0 ? (
                      <>
                        Nenhuma tag cadastrada ainda. Cadastre as tags em{" "}
                        <Link to="/settings" className="text-primary underline underline-offset-4">
                          Configuracoes
                        </Link>
                        .
                      </>
                    ) : (
                      "Nenhuma tag ativa encontrada para o filtro atual."
                    )}
                  </div>
                ) : (
                  availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => addTag(tag.name)}
                      className="flex w-full items-center justify-between rounded-xl border border-transparent bg-muted/10 px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/30"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-white/10"
                            style={{ backgroundColor: tag.color || "#5ea8ff" }}
                          />
                          <span className="truncate text-sm font-medium">{tag.name}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {tag.description || "Tag ativa disponivel para selecao."}
                        </div>
                      </div>
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] text-primary">
                        Adicionar
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Tags selecionadas
              </div>
              {selectedConfiguredTags.length === 0 && selectedLegacyTagNames.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
                  Nenhuma tag selecionada.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedConfiguredTags.map((tag) => (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                        tag.active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-warning/30 bg-warning/10 text-warning"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full border border-white/10"
                        style={{ backgroundColor: tag.color || "#5ea8ff" }}
                      />
                      <span>{tag.name}</span>
                      {!tag.active ? <span className="text-[10px] uppercase">Inativa</span> : null}
                      <button
                        type="button"
                        onClick={() => removeTag(tag.name)}
                        aria-label={`Remover ${tag.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}

                  {selectedLegacyTagNames.map((tagName) => (
                    <span
                      key={`legacy:${tagName}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/20 px-3 py-1 text-xs text-muted-foreground"
                    >
                      <span>{tagName}</span>
                      <span className="text-[10px] uppercase">Legada</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tagName)}
                        aria-label={`Remover ${tagName}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection title="Anexos">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/40">
            <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">
              A interface esta pronta para anexos. A API atual pode ainda nao persistir os arquivos.
            </p>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={() => toast.success("Arquivos preparados para envio.")}
            />
          </label>
        </FormSection>

        <div className="glass sticky bottom-0 flex flex-col gap-2 rounded-2xl p-3 shadow-card">
          <Button
            type="submit"
            className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {mode === "create" ? "Criar chamado" : "Salvar alteracoes"}
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

      {/* Template selector dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar template</DialogTitle>
          </DialogHeader>
          {templatesLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum template disponível.</p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto py-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="flex w-full items-start gap-3 rounded-xl border border-transparent bg-muted/20 px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/40"
                >
                  <LayoutTemplate className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-sm font-medium">{tpl.name}</div>
                    {tpl.title && (
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">{tpl.title}</div>
                    )}
                    <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
                      {tpl.type && <span>{tpl.type}</span>}
                      {tpl.priority && <span>· {tpl.priority}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
  const normalizedValue = String(value ?? "").trim();
  const normalizedOptions = sanitizeSelectOptions(options);

  return (
    <Select
      value={normalizedValue || (allowEmpty ? "__none__" : undefined)}
      disabled={disabled}
      onValueChange={(nextValue) => onChange(nextValue === "__none__" ? "" : nextValue)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "Selecionar"} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? <SelectItem value="__none__">Nenhum</SelectItem> : null}
        {normalizedOptions.map((option) => (
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

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
