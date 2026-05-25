import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Search, X } from "lucide-react";
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
  formatActivityStatusLabel,
  formatActivityTypeLabel,
  formatPriorityLabel,
} from "@/lib/labels";
import type { Ticket } from "@/lib/types";
import { saveActivity } from "@/services/activityService";
import { listActivityTags } from "@/services/activityTagService";
import { listProjects } from "@/services/projectService";
import { linkActivityToTicket, listTickets } from "@/services/ticketService";
import { listUsers } from "@/services/userService";

type SelectOption = {
  value: string;
  label: string;
};

export type ActivityFormData = {
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  calculateHourlyCost: boolean;
  assignee: string;
  project: string;
  ticket: string;
  estHours: string;
  tagIds: string[];
  legacyTagNames: string[];
  linkTicketOnSave: boolean;
};

const empty: ActivityFormData = {
  title: "",
  description: "",
  type: "Tarefa",
  status: "Backlog",
  priority: "Media",
  calculateHourlyCost: false,
  assignee: "",
  project: "",
  ticket: "",
  estHours: "",
  tagIds: [],
  legacyTagNames: [],
  linkTicketOnSave: false,
};

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
    user.name
    || [user.first_name, user.last_name].filter(Boolean).join(" ")
    || user.username
    || "Usuario";

  return {
    value: user.id,
    label,
    subtitle: user.job_title || user.specialty || user.email || user.username || "Usuario disponivel",
    keywords: [user.email || "", user.username || "", user.job_title || "", user.specialty || ""],
  };
}

export function ActivityForm({
  initial,
  mode = "create",
  onCancelHref = "/activities",
  entityId,
  sourceTicketSnapshot,
  duplicateWarningMessage,
}: {
  initial?: Partial<ActivityFormData>;
  mode?: "create" | "edit";
  onCancelHref?: string;
  entityId?: string;
  sourceTicketSnapshot?: Ticket | null;
  duplicateWarningMessage?: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [data, setData] = useState<ActivityFormData>({ ...empty, ...initial });
  const [tagSearch, setTagSearch] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["form-users"],
    queryFn: () => listUsers(),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["form-projects"],
    queryFn: () => listProjects(),
  });
  const { data: tickets = [] } = useQuery({
    queryKey: ["form-tickets"],
    queryFn: () => listTickets(),
  });
  const { data: activityTags = [] } = useQuery({
    queryKey: ["activity-tag-configs"],
    queryFn: () => listActivityTags(),
  });

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === data.ticket) || null,
    [tickets, data.ticket],
  );

  const userOptions = users.map(toUserOption);
  const projectOptions = projects.map((project) => ({ value: project.id, label: project.name }));
  const ticketOptions = tickets.map((ticket) => ({
    value: ticket.id,
    label: `${ticket.code || ticket.id.slice(0, 8)} · ${ticket.title}`,
  }));

  const selectedConfiguredTags = useMemo(
    () =>
      data.tagIds
        .map((tagId) => activityTags.find((tag) => tag.id === tagId))
        .filter((tag): tag is NonNullable<typeof activityTags[number]> => Boolean(tag)),
    [activityTags, data.tagIds],
  );

  const availableTags = useMemo(() => {
    const normalizedQuery = normalizeSearch(tagSearch);
    const selectedLegacyMatches = new Set(
      data.legacyTagNames.map((tagName) => normalizeSearch(tagName)),
    );

    return activityTags.filter((tag) => {
      if (!tag.active || data.tagIds.includes(tag.id) || selectedLegacyMatches.has(normalizeSearch(tag.name))) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return normalizeSearch([tag.name, tag.description || ""].join(" ")).includes(normalizedQuery);
    });
  }, [activityTags, data.legacyTagNames, data.tagIds, tagSearch]);

  useEffect(() => {
    if (!activityTags.length || !data.legacyTagNames.length) {
      return;
    }

    const configuredByName = new Map(
      activityTags.map((tag) => [normalizeSearch(tag.name), tag]),
    );
    const matchedTagIds: string[] = [];
    const unmatchedLegacyTagNames: string[] = [];

    data.legacyTagNames.forEach((tagName) => {
      const matchedTag = configuredByName.get(normalizeSearch(tagName));

      if (matchedTag) {
        matchedTagIds.push(matchedTag.id);
        return;
      }

      unmatchedLegacyTagNames.push(tagName);
    });

    const nextTagIds = Array.from(new Set([...data.tagIds, ...matchedTagIds]));
    const tagsChanged =
      nextTagIds.length !== data.tagIds.length
      || nextTagIds.some((tagId, index) => tagId !== data.tagIds[index]);
    const legacyChanged =
      unmatchedLegacyTagNames.length !== data.legacyTagNames.length
      || unmatchedLegacyTagNames.some((tagName, index) => tagName !== data.legacyTagNames[index]);

    if (!tagsChanged && !legacyChanged) {
      return;
    }

    setData((current) => ({
      ...current,
      tagIds: nextTagIds,
      legacyTagNames: unmatchedLegacyTagNames,
    }));
  }, [activityTags, data.legacyTagNames, data.tagIds]);

  const set = <K extends keyof ActivityFormData>(key: K, value: ActivityFormData[K]) =>
    setData((current) => ({ ...current, [key]: value }));

  const addTag = (tagId: string) => {
    if (data.tagIds.includes(tagId)) {
      return;
    }

    set("tagIds", [...data.tagIds, tagId]);
    setTagSearch("");
  };

  const removeTag = (tagId: string) => {
    if (tagId.startsWith("legacy:")) {
      const tagName = data.legacyTagNames.find(
        (entry) => `legacy:${normalizeSearch(entry)}` === tagId,
      );

      if (!tagName) {
        return;
      }

      set(
        "legacyTagNames",
        data.legacyTagNames.filter((entry) => entry !== tagName),
      );
      return;
    }

    set("tagIds", data.tagIds.filter((entry) => entry !== tagId));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!data.title.trim()) {
      toast.error("Informe o titulo da atividade.");
      return;
    }

    if (!data.project) {
      toast.error("Selecione o projeto da atividade.");
      return;
    }

    try {
      const saved = await saveActivity(data, mode, entityId);
      const linkedTicketId = data.ticket || sourceTicketSnapshot?.id || "";
      let ticketLinkWarning: string | null = null;

      if (mode === "create" && linkedTicketId && data.linkTicketOnSave) {
        try {
          await linkActivityToTicket(linkedTicketId, {
            id: saved.id,
            title: saved.title,
            project: saved.project || data.project || null,
          });
        } catch (error) {
          ticketLinkWarning =
            error instanceof Error
              ? error.message
              : "Nao foi possivel atualizar o vinculo da atividade com o chamado.";
        }

      }

      const ticketIdsToRefresh = Array.from(
        new Set([data.ticket, sourceTicketSnapshot?.id].filter(Boolean)),
      ) as string[];

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["activities"] }),
        queryClient.invalidateQueries({ queryKey: ["activity", saved.id] }),
        saved.project
          ? queryClient.invalidateQueries({ queryKey: ["project", saved.project] })
          : Promise.resolve(),
        ...ticketIdsToRefresh.map((ticketId) =>
          queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
        ),
        ...ticketIdsToRefresh.map((ticketId) =>
          queryClient.invalidateQueries({ queryKey: ["ticket-timeline", ticketId] }),
        ),
        ...ticketIdsToRefresh.map((ticketId) =>
          queryClient.invalidateQueries({ queryKey: ["ticket-activities", ticketId] }),
        ),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      ]);

      toast.success(mode === "create" ? "Atividade criada." : "Atividade atualizada.");
      if (ticketLinkWarning) {
        toast.warning(
          `A atividade foi criada, mas o vinculo com o chamado nao foi sincronizado pela API. ${ticketLinkWarning}`,
        );
      }
      navigate({ to: `/activities/${saved.id}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar atividade.");
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <FormSection
          title="Dados da atividade"
          description="Cadastre a demanda base da atividade. O planejamento detalhado acontece depois, na sprint."
        >
          <Field label="Titulo" required>
            <Input
              value={data.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Ex.: Configurar status padroes de chamados"
              required
              maxLength={140}
            />
          </Field>

          <Field label="Descricao" hint="Descreva o objetivo, escopo e criterios da atividade.">
            <Textarea
              value={data.description}
              onChange={(event) => set("description", event.target.value)}
              rows={6}
              maxLength={4000}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tipo">
              <Selectable
                value={data.type}
                onChange={(value) => set("type", value)}
                options={["Tarefa", "Historia", "Bug", "Spike", "Epic", "Subtarefa"].map(
                  (item) => ({ value: item, label: formatActivityTypeLabel(item) }),
                )}
              />
            </Field>

            <Field label="Status">
              <Selectable
                value={data.status}
                onChange={(value) => set("status", value)}
                options={["Backlog", "A fazer", "Em progresso", "Em revisao", "Bloqueado", "Concluido"].map(
                  (item) => ({ value: item, label: formatActivityStatusLabel(item) }),
                )}
              />
            </Field>

            <Field label="Prioridade">
              <Selectable
                value={data.priority}
                onChange={(value) => set("priority", value)}
                options={["Critica", "Alta", "Media", "Baixa"].map((item) => ({
                  value: item,
                  label: formatPriorityLabel(item),
                }))}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Origem e vinculos"
          description="Associe a atividade ao projeto, ao chamado de origem e ao responsavel sugerido."
        >
          {duplicateWarningMessage ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              {duplicateWarningMessage}
            </div>
          ) : null}

          {sourceTicketSnapshot ? (
            <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-4 text-sm">
              <div className="font-medium">
                Dados importados do chamado {sourceTicketSnapshot.code || sourceTicketSnapshot.id.slice(0, 8)}
              </div>
              <div className="mt-1 text-muted-foreground">
                Revise os campos preenchidos automaticamente antes de salvar a atividade.
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="text-muted-foreground">
                  Cliente: <span className="text-foreground">{sourceTicketSnapshot.client_name || "Nao informado"}</span>
                </div>
                <div className="text-muted-foreground">
                  Categoria: <span className="text-foreground">{sourceTicketSnapshot.category_name || sourceTicketSnapshot.category || "Nao informada"}</span>
                </div>
                <div className="text-muted-foreground">
                  Projeto: <span className="text-foreground">{sourceTicketSnapshot.project_name || "Nao vinculado"}</span>
                </div>
                <div className="text-muted-foreground">
                  Tecnico: <span className="text-foreground">{sourceTicketSnapshot.responsible_technician_name || sourceTicketSnapshot.technician_names?.[0] || "Nao definido"}</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Projeto" required>
              <Selectable
                value={data.project}
                onChange={(value) => set("project", value)}
                options={projectOptions}
                placeholder="Selecionar projeto"
              />
            </Field>

            <Field label="Chamado de origem">
              <Selectable
                value={data.ticket}
                onChange={(value) => set("ticket", value)}
                options={ticketOptions}
                placeholder="Nenhum chamado"
                allowEmpty={!sourceTicketSnapshot}
              />
            </Field>
          </div>

          <Field label="Responsavel sugerido" hint="Opcional. O responsavel real pode ser ajustado depois no planejamento da sprint.">
            <UserPickerField
              options={userOptions}
              selected={data.assignee ? [data.assignee] : []}
              onChange={(selected) => set("assignee", selected[0] || "")}
              placeholder="Adicionar responsavel sugerido..."
              emptySelectedText="Nenhum responsavel sugerido."
              maxSelections={1}
            />
          </Field>

          {selectedTicket ? (
            <div className="rounded-xl border border-border bg-muted/15 p-4 text-sm">
              <div className="font-medium">
                Chamado vinculado: {selectedTicket.code || selectedTicket.id.slice(0, 8)}
              </div>
              <div className="mt-1 text-muted-foreground">{selectedTicket.title}</div>
            </div>
          ) : null}

          {data.ticket ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 transition-colors hover:border-primary/40">
              <Checkbox
                checked={data.linkTicketOnSave}
                onCheckedChange={(value) => set("linkTicketOnSave", Boolean(value))}
                className="mt-0.5"
                disabled={Boolean(sourceTicketSnapshot)}
              />
              <span className="space-y-1 text-sm">
                <span className="block font-medium">Manter vinculo com o chamado</span>
                <span className="block text-muted-foreground">
                  Ao salvar, a atividade continua vinculada ao chamado e o historico do ticket e atualizado.
                </span>
              </span>
            </label>
          ) : null}
        </FormSection>
      </div>

      <div className="space-y-5">
        <FormSection
          title="Estimativa e custo"
          description="A estimativa pertence a atividade. O custo so nasce quando houver apontamentos reais."
        >
          <Field
            label="Estimativa total de horas"
            hint="Use a estimativa total da atividade, independentemente de sprint."
          >
            <Input
              type="number"
              min={0}
              step="0.25"
              value={data.estHours}
              onChange={(event) => set("estHours", event.target.value)}
              placeholder="Ex.: 8"
            />
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/15 px-4 py-3 transition-colors hover:border-primary/40">
            <Checkbox
              checked={data.calculateHourlyCost}
              onCheckedChange={(value) => set("calculateHourlyCost", Boolean(value))}
              className="mt-0.5"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">Calcular custo por hora</span>
              <span className="block text-sm text-muted-foreground">
                Quando ativado, os apontamentos de horas desta atividade gerarao custos automaticamente no projeto.
              </span>
            </span>
          </label>
        </FormSection>

        <FormSection
          title="Tags da atividade"
          description="Selecione apenas tags pre-cadastradas nas configuracoes. Nao e permitido criar tag livre nesta tela."
        >
          <Field
            label="Selecionar tags"
            hint="Somente tags ativas podem ser escolhidas em novas atividades. Tags antigas ou inativas continuam visiveis abaixo."
          >
            <div className="rounded-2xl border border-border bg-muted/15">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={tagSearch}
                  onChange={(event) => setTagSearch(event.target.value)}
                  placeholder="Selecionar tags..."
                  className="h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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
                      onClick={() => addTag(tag.id)}
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
          </Field>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Tags selecionadas
            </div>
            {selectedConfiguredTags.length === 0 && data.legacyTagNames.length === 0 ? (
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
                    <button type="button" onClick={() => removeTag(tag.id)} aria-label={`Remover ${tag.name}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}

                {data.legacyTagNames.map((tagName) => (
                  <span
                    key={`legacy:${tagName}`}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/20 px-3 py-1 text-xs text-muted-foreground"
                  >
                    <span>{tagName}</span>
                    <span className="text-[10px] uppercase">Legada</span>
                    <button
                      type="button"
                      onClick={() => removeTag(`legacy:${normalizeSearch(tagName)}`)}
                      aria-label={`Remover ${tagName}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </FormSection>

        <div className="sticky bottom-0 flex flex-col gap-2 rounded-2xl p-3 shadow-card glass">
          <Button
            type="submit"
            className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {mode === "create" ? "Criar atividade" : "Salvar alteracoes"}
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

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
