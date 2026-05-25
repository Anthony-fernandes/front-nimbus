import { FormEvent, useMemo, useState } from "react";

import { Field } from "@/components/app/Field";
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
import type { ActivityTimeEntry, User } from "@/lib/types";

export type ActivityTimeEntryFormData = {
  collaboratorId: string;
  date: string;
  hours: string;
  sprintId: string;
  workDescription: string;
};

type SelectOption = {
  value: string;
  label: string;
};

const empty: ActivityTimeEntryFormData = {
  collaboratorId: "",
  date: new Date().toISOString().slice(0, 10),
  hours: "",
  sprintId: "",
  workDescription: "",
};

function toUserOption(user: User): UserPickerOption {
  const label =
    user.name
    || [user.first_name, user.last_name].filter(Boolean).join(" ")
    || user.username
    || user.email
    || "Usuario";

  return {
    value: user.id,
    label,
    subtitle: user.job_title || user.specialty || user.email || "Colaborador disponivel",
    keywords: [user.username || "", user.email || "", user.job_title || "", user.specialty || ""],
  };
}

export function toActivityTimeEntryFormData(
  entry?: Partial<ActivityTimeEntry> | null,
): ActivityTimeEntryFormData {
  return {
    collaboratorId: entry?.collaboratorId || "",
    date: entry?.date || new Date().toISOString().slice(0, 10),
    hours: entry?.hours != null ? String(entry.hours) : "",
    sprintId: entry?.sprintId || "",
    workDescription: entry?.workDescription || "",
  };
}

export function ActivityTimeEntryForm({
  initial,
  users,
  sprintOptions,
  calculateHourlyCost,
  saving = false,
  submitLabel = "Salvar apontamento",
  onSubmit,
}: {
  initial?: Partial<ActivityTimeEntryFormData>;
  users: User[];
  sprintOptions: SelectOption[];
  calculateHourlyCost: boolean;
  saving?: boolean;
  submitLabel?: string;
  onSubmit: (data: ActivityTimeEntryFormData) => Promise<void> | void;
}) {
  const [data, setData] = useState<ActivityTimeEntryFormData>({ ...empty, ...initial });
  const userOptions = useMemo(() => users.map(toUserOption), [users]);

  const set = <K extends keyof ActivityTimeEntryFormData>(
    key: K,
    value: ActivityTimeEntryFormData[K],
  ) => setData((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Colaborador"
        required
        hint={
          calculateHourlyCost
            ? "O custo por hora deste colaborador sera usado para gerar o custo automatico."
            : "Apontamento operacional sem geracao automatica de custo."
        }
      >
        <UserPickerField
          options={userOptions}
          selected={data.collaboratorId ? [data.collaboratorId] : []}
          onChange={(selected) => set("collaboratorId", selected[0] || "")}
          placeholder="Selecionar colaborador..."
          emptySelectedText="Nenhum colaborador selecionado."
          maxSelections={1}
          selectedLabel="Colaborador selecionado"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data" required>
          <Input
            type="date"
            value={data.date}
            onChange={(event) => set("date", event.target.value)}
            required
          />
        </Field>

        <Field label="Horas gastas" required>
          <Input
            type="number"
            min={0}
            step="0.25"
            value={data.hours}
            onChange={(event) => set("hours", event.target.value)}
            placeholder="Ex.: 2.5"
            required
          />
        </Field>
      </div>

      <Field
        label="Sprint"
        hint="Opcional. Use quando o apontamento estiver relacionado a um planejamento da sprint."
      >
        <Select
          value={data.sprintId || "__none__"}
          onValueChange={(value) => set("sprintId", value === "__none__" ? "" : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sem sprint vinculada" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem sprint vinculada</SelectItem>
            {sprintOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Descricao do trabalho realizado"
        hint="Explique resumidamente o que foi executado neste apontamento."
      >
        <Textarea
          value={data.workDescription}
          onChange={(event) => set("workDescription", event.target.value)}
          rows={5}
          placeholder="Ex.: configuracao do workflow, testes e ajustes finais."
        />
      </Field>

      <Button
        type="submit"
        className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
        disabled={saving}
      >
        {saving ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
