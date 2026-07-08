import { FormEvent, useEffect, useMemo, useState } from "react";

import { Field } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectCost, ProjectCostRelatedType, ProjectCostType } from "@/lib/types";
import { PROJECT_COST_CATEGORY_OPTIONS } from "@/services/projectCostService";
import { formatCurrency, formatDate, toNumber } from "@/services/utils";

type CollaboratorOption = {
  value: string;
  label: string;
  subtitle?: string;
};

type RelatedItemOption = {
  id: string;
  type: ProjectCostRelatedType;
  label: string;
  subtitle?: string;
};

export type ProjectCostFormInput = {
  type: ProjectCostType;
  description?: string;
  collaboratorId?: string;
  collaboratorName?: string;
  relatedItemId?: string;
  relatedItemType?: ProjectCostRelatedType;
  relatedItemTitle?: string;
  category: string;
  date: string;
  hours?: number;
  hourlyRate?: number;
  amount: number;
  notes?: string;
};

type FormState = {
  type: ProjectCostType;
  description: string;
  collaboratorId: string;
  relatedItemValue: string;
  category: string;
  date: string;
  hours: string;
  hourlyRate: string;
  amount: string;
  notes: string;
};

const emptyState: FormState = {
  type: "manual",
  description: "",
  collaboratorId: "",
  relatedItemValue: "",
  category: "Outros",
  date: new Date().toISOString().slice(0, 10),
  hours: "",
  hourlyRate: "",
  amount: "",
  notes: "",
};

function toRelatedItemValue(type?: ProjectCostRelatedType, id?: string) {
  if (!type || !id) return "";
  return `${type}:${id}`;
}

function parseRelatedItemValue(value: string) {
  if (!value) {
    return { relatedItemId: undefined, relatedItemType: undefined as ProjectCostRelatedType | undefined };
  }

  const [type, ...idParts] = value.split(":");
  const relatedItemType = (type === "activity" || type === "ticket" ? type : undefined) as ProjectCostRelatedType | undefined;
  const relatedItemId = idParts.join(":") || undefined;

  return { relatedItemId, relatedItemType };
}

function buildInitialState(initial?: ProjectCost | null): FormState {
  if (!initial) {
    return {
      ...emptyState,
      category: "Outros",
      date: new Date().toISOString().slice(0, 10),
    };
  }

  return {
    type: initial.type,
    description: initial.description || "",
    collaboratorId: initial.collaboratorId || "",
    relatedItemValue: toRelatedItemValue(initial.relatedItemType, initial.relatedItemId),
    category: initial.category || (initial.type === "hours" ? "Mao de obra" : "Outros"),
    date: initial.date || new Date().toISOString().slice(0, 10),
    hours: initial.hours == null ? "" : String(initial.hours),
    hourlyRate: initial.hourlyRate == null ? "" : String(initial.hourlyRate),
    amount: String(initial.amount ?? ""),
    notes: initial.notes || "",
  };
}

export function ProjectCostDialog({
  open,
  onOpenChange,
  mode,
  initial,
  collaborators,
  relatedItems,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: ProjectCost | null;
  collaborators: CollaboratorOption[];
  relatedItems: RelatedItemOption[];
  onSubmit: (payload: ProjectCostFormInput) => Promise<void> | void;
  submitting?: boolean;
}) {
  const [form, setForm] = useState<FormState>(buildInitialState(initial));

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(initial));
    }
  }, [initial, open]);

  const totalAmount = useMemo(() => {
    if (form.type === "hours") {
      return toNumber(form.hours, 0) * toNumber(form.hourlyRate, 0);
    }

    return toNumber(form.amount, 0);
  }, [form.amount, form.hours, form.hourlyRate, form.type]);

  const collaboratorLabel =
    collaborators.find((option) => option.value === form.collaboratorId)?.label || "";
  const relatedItem = relatedItems.find((option) => `${option.type}:${option.id}` === form.relatedItemValue);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (form.type === "hours" && !form.collaboratorId) {
      return;
    }

    if (form.type === "manual" && !form.description.trim()) {
      return;
    }

    const { relatedItemId, relatedItemType } = parseRelatedItemValue(form.relatedItemValue);

    await onSubmit({
      type: form.type,
      description: form.type === "manual" ? form.description.trim() : form.description.trim(),
      collaboratorId: form.type === "hours" ? form.collaboratorId : undefined,
      collaboratorName: form.type === "hours" ? collaboratorLabel : undefined,
      relatedItemId,
      relatedItemType,
      relatedItemTitle: relatedItem?.label,
      category: form.type === "hours" ? "Mao de obra" : form.category,
      date: form.date,
      hours: form.type === "hours" ? toNumber(form.hours, 0) : undefined,
      hourlyRate: form.type === "hours" ? toNumber(form.hourlyRate, 0) : undefined,
      amount: totalAmount,
      notes: form.notes.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-3xl">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle>
            {mode === "create" ? "Adicionar custo" : "Editar lançamento de custo"}
          </DialogTitle>
          <DialogDescription>
            Registre aquisicoes, despesas operacionais ou custos por hora para acompanhar o consumo do projeto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-5">
            <section className="rounded-2xl border border-border bg-muted/15 p-4 shadow-card">
              <Field
                label="Tipo"
                hint="Escolha se este lançamento representa uma aquisição/despesa do projeto ou um custo por hora da equipe."
              >
                <Select
                  value={form.type}
                  onValueChange={(value) => set("type", value as ProjectCostType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar tipo de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Aquisicao / despesa</SelectItem>
                    <SelectItem value="hours">Custo por hora</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="mt-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                {form.type === "hours"
                  ? "Use custo por hora quando quiser registrar esforco da equipe com base nas horas executadas."
                  : "Use aquisicao / despesa para compras, serviços, licencas, infraestrutura e outros gastos avulsos."}
              </div>
            </section>

            {form.type === "hours" ? (
              <section className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4 shadow-card">
                <div>
                  <div className="text-sm font-semibold">Custo por hora</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Lance horas aplicadas no projeto com colaborador, valor hora e item relacionado.
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Colaborador" required hint="Selecione quem executou as horas registradas.">
                    <Select
                      value={form.collaboratorId || undefined}
                      onValueChange={(value) => set("collaboratorId", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar colaborador" />
                      </SelectTrigger>
                      <SelectContent>
                        {collaborators.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Atividade ou chamado" hint="Relacionamento opcional com a entrega ou atendimento.">
                    <Select
                      value={form.relatedItemValue || undefined}
                      onValueChange={(value) => set("relatedItemValue", value === "none" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar item relacionado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem item relacionado</SelectItem>
                        {relatedItems.length > 0 && <SelectSeparator />}
                        {relatedItems.some((item) => item.type === "activity") && (
                          <SelectGroup>
                            <SelectLabel>Atividades</SelectLabel>
                            {relatedItems
                              .filter((item) => item.type === "activity")
                              .map((item) => (
                                <SelectItem key={`activity-${item.id}`} value={`activity:${item.id}`}>
                                  {item.label}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        )}
                        {relatedItems.some((item) => item.type === "ticket") && (
                          <SelectGroup>
                            <SelectLabel>Chamados</SelectLabel>
                            {relatedItems
                              .filter((item) => item.type === "ticket")
                              .map((item) => (
                                <SelectItem key={`ticket-${item.id}`} value={`ticket:${item.id}`}>
                                  {item.label}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Data do lançamento" required>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(event) => set("date", event.target.value)}
                    />
                  </Field>
                  <Field label="Horas" required>
                    <Input
                      type="number"
                      min={0}
                      step="0.25"
                      value={form.hours}
                      onChange={(event) => set("hours", event.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Valor hora" required>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.hourlyRate}
                      onChange={(event) => set("hourlyRate", event.target.value)}
                      placeholder="0,00"
                    />
                  </Field>
                  <Field label="Valor total calculado">
                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-2.5 text-sm font-semibold">
                      {formatCurrency(totalAmount)}
                    </div>
                  </Field>
                </div>
                <Field label="Observação" hint="Campo opcional para detalhar o contexto do lançamento.">
                  <Textarea
                    rows={4}
                    value={form.notes}
                    onChange={(event) => set("notes", event.target.value)}
                    placeholder="Ex.: reunião de alinhamento, execução da implementação, revisão técnica..."
                  />
                </Field>
              </section>
            ) : (
              <section className="space-y-4 rounded-2xl border border-border bg-muted/10 p-4 shadow-card">
                <div>
                  <div className="text-sm font-semibold">Aquisicao / despesa</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Registre gastos diretos do projeto como licencas, terceiros, deslocamento, equipamentos e infraestrutura.
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Descrição" required hint="Informe claramente o que está sendo lançado.">
                    <Input
                      value={form.description}
                      onChange={(event) => set("description", event.target.value)}
                      placeholder="Ex.: renovacao de licenca, deslocamento para reunião, serviço terceiro..."
                    />
                  </Field>
                  <Field label="Categoria" required>
                    <Select
                      value={form.category || undefined}
                      onValueChange={(value) => set("category", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_COST_CATEGORY_OPTIONS.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Data do lançamento" required>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(event) => set("date", event.target.value)}
                    />
                  </Field>
                  <Field label="Valor" required>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.amount}
                      onChange={(event) => set("amount", event.target.value)}
                      placeholder="0,00"
                    />
                  </Field>
                </div>
                <Field label="Observação" hint="Campo opcional para anotar detalhes do custo.">
                  <Textarea
                    rows={4}
                    value={form.notes}
                    onChange={(event) => set("notes", event.target.value)}
                    placeholder="Ex.: despesa aprovada na reunião de kickoff, item comprado para homologacao..."
                  />
                </Field>
              </section>
            )}

            <section className="rounded-2xl border border-border bg-muted/10 p-4 shadow-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">Resumo do lançamento</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {form.type === "hours"
                      ? "O total e recalculado automaticamente com base em horas e valor hora."
                      : "O valor informado sera somado ao realizado do projeto assim que salvar."}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-primary/80">
                    Total previsto
                  </div>
                  <div className="mt-1 text-xl font-semibold text-primary">
                    {formatCurrency(totalAmount)}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="border-t border-border/60 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              disabled={
                submitting
                || (form.type === "hours"
                  ? !form.collaboratorId || !form.date || !toNumber(form.hours, 0) || !toNumber(form.hourlyRate, 0)
                  : !form.description.trim() || !form.date || !toNumber(form.amount, 0))
              }
            >
              {submitting
                ? "Salvando..."
                : mode === "create"
                  ? "Adicionar custo"
                  : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
