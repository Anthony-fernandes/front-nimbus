import { FormEvent, useMemo, useState } from "react";
import { Save } from "lucide-react";

import { Field, FormSection } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { slugifyTicketWorkflowStatus } from "@/lib/ticketWorkflow";
import type { TicketWorkflowStatusConfig } from "@/lib/types";

export type TicketStatusConfigFormData = {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  active: boolean;
  pausesSla: boolean;
  isFinal: boolean;
  allowsResume: boolean;
  order: number;
  originStatuses: string[];
  nextStatuses: string[];
  system: boolean;
};

const EMPTY_FORM: TicketStatusConfigFormData = {
  id: "",
  name: "",
  slug: "",
  description: "",
  color: "#5ea8ff",
  active: true,
  pausesSla: false,
  isFinal: false,
  allowsResume: false,
  order: 999,
  originStatuses: [],
  nextStatuses: [],
  system: false,
};

export function toTicketStatusConfigFormData(
  status?: TicketWorkflowStatusConfig | null,
): TicketStatusConfigFormData {
  return {
    id: status?.id || "",
    name: status?.name || "",
    slug: status?.slug || "",
    description: status?.description || "",
    color: status?.color || "#5ea8ff",
    active: status?.active ?? true,
    pausesSla: Boolean(status?.pauses_sla),
    isFinal: Boolean(status?.is_final),
    allowsResume: Boolean(status?.allows_resume),
    order: typeof status?.order === "number" ? status.order : 999,
    originStatuses: status?.origin_statuses || [],
    nextStatuses: status?.next_statuses || [],
    system: Boolean(status?.system),
  };
}

export function TicketStatusConfigForm({
  initial,
  statusOptions,
  saving = false,
  submitLabel = "Salvar status",
  onSubmit,
}: {
  initial?: Partial<TicketStatusConfigFormData>;
  statusOptions: TicketWorkflowStatusConfig[];
  saving?: boolean;
  submitLabel?: string;
  onSubmit: (data: TicketStatusConfigFormData) => Promise<void> | void;
}) {
  const [data, setData] = useState<TicketStatusConfigFormData>({ ...EMPTY_FORM, ...initial });

  const relationOptions = useMemo(
    () =>
      statusOptions
        .filter((status) => status.slug !== data.slug)
        .map((status) => ({ slug: status.slug, name: status.name })),
    [data.slug, statusOptions],
  );

  const setField = <K extends keyof TicketStatusConfigFormData>(
    key: K,
    value: TicketStatusConfigFormData[K],
  ) => setData((current) => ({ ...current, [key]: value }));

  const toggleRelation = (
    field: "originStatuses" | "nextStatuses",
    slug: string,
  ) => {
    setData((current) => ({
      ...current,
      [field]: current[field].includes(slug)
        ? current[field].filter((entry) => entry !== slug)
        : [...current[field], slug],
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      ...data,
      slug: data.slug || slugifyTicketWorkflowStatus(data.name),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormSection
        title="Status de chamados"
        description="Controle a ordem, o comportamento do SLA e as transições permitidas do workflow."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required>
            <Input
              value={data.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="Ex.: Aguardando fornecedor"
              disabled={data.system}
              required
            />
          </Field>
          <Field label="Código interno / slug" required>
            <Input
              value={data.slug}
              onChange={(event) => setField("slug", slugifyTicketWorkflowStatus(event.target.value))}
              placeholder="Ex.: aguardando_fornecedor"
              disabled={data.system}
              required
            />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Textarea
              value={data.description}
              onChange={(event) => setField("description", event.target.value)}
              rows={3}
              placeholder="Descreva quando esse status deve ser usado."
            />
          </Field>
          <Field label="Cor">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
              <input
                type="color"
                value={data.color}
                onChange={(event) => setField("color", event.target.value)}
                className="h-8 w-10 rounded border border-border bg-transparent"
              />
              <Input
                value={data.color}
                onChange={(event) => setField("color", event.target.value)}
                className="border-0 bg-transparent px-0 shadow-none"
              />
            </div>
          </Field>
          <Field label="Ordem de exibição">
            <Input
              type="number"
              min={1}
              value={String(data.order)}
              onChange={(event) => setField("order", Number(event.target.value || 0))}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Comportamento">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleField
            label="Status ativo"
            checked={data.active}
            disabled={data.system}
            onCheckedChange={(value) => setField("active", value)}
          />
          <ToggleField
            label="Pausa SLA"
            checked={data.pausesSla}
            disabled={data.system}
            onCheckedChange={(value) => setField("pausesSla", value)}
          />
          <ToggleField
            label="É status final"
            checked={data.isFinal}
            disabled={data.system}
            onCheckedChange={(value) => setField("isFinal", value)}
          />
          <ToggleField
            label="Permite retomar atendimento"
            checked={data.allowsResume}
            disabled={data.system}
            onCheckedChange={(value) => setField("allowsResume", value)}
          />
        </div>
      </FormSection>

      <FormSection title="Workflow permitido">
        <div className="grid gap-4 lg:grid-cols-2">
          <RelationField
            label="Status de origem permitidos"
            options={relationOptions}
            selected={data.originStatuses}
            disabled={data.system}
            onToggle={(slug) => toggleRelation("originStatuses", slug)}
          />
          <RelationField
            label="Próximos status permitidos"
            options={relationOptions}
            selected={data.nextStatuses}
            disabled={data.system}
            onToggle={(slug) => toggleRelation("nextStatuses", slug)}
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

function RelationField({
  label,
  options,
  selected,
  disabled = false,
  onToggle,
}: {
  label: string;
  options: Array<{ slug: string; name: string }>;
  selected: string[];
  disabled?: boolean;
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/10 p-3">
        {options.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum outro status disponível.</div>
        ) : (
          options.map((option) => (
            <label
              key={option.slug}
              className={`flex items-start gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 transition-colors ${
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:border-primary/40"
              }`}
            >
              <Checkbox
                checked={selected.includes(option.slug)}
                disabled={disabled}
                onCheckedChange={() => onToggle(option.slug)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm">{option.name}</div>
                <div className="text-[11px] text-muted-foreground">{option.slug}</div>
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-primary/40"
      }`}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
        className="mt-0.5"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
