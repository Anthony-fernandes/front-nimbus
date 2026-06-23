import { useState } from "react";
import { toast } from "sonner";
import type { CustomField, CustomValue } from "@/services/customFieldService";

type Props = {
  entityId: string;
  entityType: "activity" | "project";
  fieldsQuery: { data?: CustomField[]; isLoading?: boolean };
  valuesQuery: { data?: CustomValue[]; isLoading?: boolean };
  onUpsert: (fieldId: string, value: string, existingId?: string) => Promise<CustomValue>;
  onRefresh: () => void;
};

function FieldInput({
  field,
  currentValue,
  onSave,
}: {
  field: CustomField;
  currentValue?: CustomValue;
  onSave: (value: string, existingId?: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(currentValue?.value ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(val, currentValue?.id);
      setEditing(false);
      toast.success("Campo atualizado.");
    } catch {
      toast.error("Não foi possível salvar o campo.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div
        className="flex items-center justify-between rounded-lg border border-border bg-muted/10 px-3 py-2 text-sm cursor-pointer hover:border-primary/40 transition-colors"
        onClick={() => { setVal(currentValue?.value ?? ""); setEditing(true); }}
      >
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{field.label}{field.required ? " *" : ""}</div>
          <div className="mt-0.5">{currentValue?.value || <span className="text-muted-foreground italic">Não preenchido</span>}</div>
        </div>
        <span className="text-xs text-muted-foreground">Editar</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-muted/10 px-3 py-2 space-y-2">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{field.label}{field.required ? " *" : ""}</div>
      {field.field_type === "boolean" ? (
        <select
          className="h-7 w-full rounded border border-border bg-background px-2 text-xs"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        >
          <option value="">—</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      ) : field.field_type === "select" ? (
        <select
          className="h-7 w-full rounded border border-border bg-background px-2 text-xs"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        >
          <option value="">—</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
          className="h-7 w-full rounded border border-border bg-background px-2 text-xs"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus
        />
      )}
      <div className="flex gap-1.5">
        <button
          className="rounded bg-primary px-2 py-0.5 text-[11px] text-primary-foreground disabled:opacity-50"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setEditing(false)}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function CustomFieldsSection({ fieldsQuery, valuesQuery, onUpsert, onRefresh }: Props) {
  const fields = (fieldsQuery.data || []).filter((f) => f.active);
  const values = valuesQuery.data || [];

  if (fieldsQuery.isLoading) {
    return <div className="text-xs text-muted-foreground">Carregando campos...</div>;
  }

  if (fields.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
        Nenhum campo personalizado configurado para este tipo.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => {
        const currentValue = values.find((v) => v.field === field.id);
        return (
          <FieldInput
            key={field.id}
            field={field}
            currentValue={currentValue}
            onSave={async (value, existingId) => {
              await onUpsert(field.id, value, existingId);
              onRefresh();
            }}
          />
        );
      })}
    </div>
  );
}
