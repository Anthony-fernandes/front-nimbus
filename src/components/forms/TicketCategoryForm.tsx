import { FormEvent, useState } from "react";
import { Save } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { INTERNAL_TICKET_TYPE_OPTIONS, TICKET_IMPACT_OPTIONS, TICKET_PRIORITY_OPTIONS } from "@/lib/tickets";
import type { TicketCategory } from "@/lib/types";

export type TicketCategoryFormData = {
  name: string;
  description: string;
  active: boolean;
  sla: string;
  slaUnit: string;
  approvalRequired: boolean;
  defaultType: string;
  defaultPriority: string;
  defaultImpact: string;
  defaultTeam: string;
  allowProjectActivity: boolean;
  requiresTechnicalCategorization: boolean;
  requiresClientValidation: boolean;
  color: string;
  icon: string;
};

const empty: TicketCategoryFormData = {
  name: "",
  description: "",
  active: true,
  sla: "8h",
  slaUnit: "horas",
  approvalRequired: false,
  defaultType: "Solicitacao",
  defaultPriority: "Pendente",
  defaultImpact: "Pendente",
  defaultTeam: "",
  allowProjectActivity: false,
  requiresTechnicalCategorization: true,
  requiresClientValidation: true,
  color: "",
  icon: "",
};

export function toTicketCategoryFormData(
  category?: Partial<TicketCategory> | null,
): TicketCategoryFormData {
  return {
    name: category?.name || "",
    description: category?.description || "",
    active: category?.active ?? true,
    sla: category?.sla || "8h",
    slaUnit: category?.sla_unit || "horas",
    approvalRequired: Boolean(category?.approval_required),
    defaultType: category?.default_type || "Solicitacao",
    defaultPriority: category?.default_priority || "Pendente",
    defaultImpact: category?.default_impact || "Pendente",
    defaultTeam: category?.default_team || "",
    allowProjectActivity: Boolean(category?.allow_project_activity),
    requiresTechnicalCategorization: Boolean(category?.requires_technical_categorization ?? true),
    requiresClientValidation: Boolean(category?.requires_client_validation ?? true),
    color: category?.color || "",
    icon: category?.icon || "",
  };
}

export function TicketCategoryForm({
  initial,
  saving = false,
  submitLabel = "Salvar categoria",
  onSubmit,
}: {
  initial?: Partial<TicketCategoryFormData>;
  saving?: boolean;
  submitLabel?: string;
  onSubmit: (data: TicketCategoryFormData) => Promise<void> | void;
}) {
  const [data, setData] = useState<TicketCategoryFormData>({ ...empty, ...initial });

  const set = <K extends keyof TicketCategoryFormData>(
    key: K,
    value: TicketCategoryFormData[K],
  ) => setData((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormSection
        title="Categoria de chamado"
        description="Defina regras de aprovação, SLA e comportamento padrão da categoria."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required>
            <Input
              value={data.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Ex.: Melhoria"
              required
            />
          </Field>
          <Field label="SLA padrao">
            <Input
              value={data.sla}
              onChange={(event) => set("sla", event.target.value)}
              placeholder="Ex.: 8h"
            />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Textarea
              value={data.description}
              onChange={(event) => set("description", event.target.value)}
              rows={4}
              placeholder="Descreva quando essa categoria deve ser usada."
            />
          </Field>
          <Field label="Unidade do SLA">
            <Select value={data.slaUnit} onValueChange={(value) => set("slaUnit", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="horas">Horas</SelectItem>
                <SelectItem value="dias">Dias</SelectItem>
                <SelectItem value="uteis">Dias uteis</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Equipe responsável padrão">
            <Input
              value={data.defaultTeam}
              onChange={(event) => set("defaultTeam", event.target.value)}
              placeholder="Ex.: Suporte N2"
            />
          </Field>
          <Field label="Tipo padrao">
            <Select value={data.defaultType} onValueChange={(value) => set("defaultType", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {INTERNAL_TICKET_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prioridade padrao">
            <Select
              value={data.defaultPriority}
              onValueChange={(value) => set("defaultPriority", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar prioridade" />
              </SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Impacto padrao">
            <Select value={data.defaultImpact} onValueChange={(value) => set("defaultImpact", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar impacto" />
              </SelectTrigger>
              <SelectContent>
                {TICKET_IMPACT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cor">
            <Input
              value={data.color}
              onChange={(event) => set("color", event.target.value)}
              placeholder="Ex.: #7c3aed"
            />
          </Field>
          <Field label="Icone">
            <Input
              value={data.icon}
              onChange={(event) => set("icon", event.target.value)}
              placeholder="Ex.: wrench"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Regras">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleField
            label="Categoria ativa"
            checked={data.active}
            onCheckedChange={(value) => set("active", value)}
          />
          <ToggleField
            label="Exige aprovação"
            checked={data.approvalRequired}
            onCheckedChange={(value) => set("approvalRequired", value)}
          />
          <ToggleField
            label="Permite virar atividade de projeto"
            checked={data.allowProjectActivity}
            onCheckedChange={(value) => set("allowProjectActivity", value)}
          />
          <ToggleField
            label="Exige categorização técnica"
            checked={data.requiresTechnicalCategorization}
            onCheckedChange={(value) => set("requiresTechnicalCategorization", value)}
          />
          <ToggleField
            label="Exige avaliação do cliente"
            checked={data.requiresClientValidation}
            onCheckedChange={(value) => set("requiresClientValidation", value)}
          />
        </div>
      </FormSection>

      <div className="flex justify-end">
        <Button
          type="submit"
          className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          disabled={saving}
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function ToggleField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
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
