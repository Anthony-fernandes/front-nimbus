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
import { formatHoursLabel } from "@/lib/activityFlow";
import type { User } from "@/lib/types";

export type SprintActivityPlanFormData = {
  activityId: string;
  responsibleIds: string[];
  plannedHours: string;
  storyPoints: string;
  plannedStartDate: string;
  plannedEndDate: string;
  order: string;
  notes: string;
};

export type SprintActivityPlanOption = {
  id: string;
  title: string;
  projectName?: string;
  estimatedHours: number;
  plannedHoursOutsideSprint: number;
  realizedHours: number;
  estimatedBalanceHours: number;
};

const empty: SprintActivityPlanFormData = {
  activityId: "",
  responsibleIds: [],
  plannedHours: "",
  storyPoints: "",
  plannedStartDate: "",
  plannedEndDate: "",
  order: "",
  notes: "",
};

function toUserOption(user: User): UserPickerOption {
  const label =
    user.name
    || [user.first_name, user.last_name].filter(Boolean).join(" ")
    || user.username
    || user.email
    || "Usuário";

  return {
    value: user.id,
    label,
    subtitle: user.job_title || user.specialty || user.email || "Responsável disponível",
    keywords: [user.username || "", user.email || "", user.job_title || "", user.specialty || ""],
  };
}

export function toSprintActivityPlanFormData(
  plan?: Partial<SprintActivityPlanFormData> | null,
): SprintActivityPlanFormData {
  return {
    activityId: plan?.activityId || "",
    responsibleIds: plan?.responsibleIds || [],
    plannedHours: plan?.plannedHours || "",
    storyPoints: plan?.storyPoints || "",
    plannedStartDate: plan?.plannedStartDate || "",
    plannedEndDate: plan?.plannedEndDate || "",
    order: plan?.order || "",
    notes: plan?.notes || "",
  };
}

export function SprintActivityPlanForm({
  initial,
  activities,
  users,
  saving = false,
  submitLabel = "Salvar planejamento",
  onSubmit,
}: {
  initial?: Partial<SprintActivityPlanFormData>;
  activities: SprintActivityPlanOption[];
  users: User[];
  saving?: boolean;
  submitLabel?: string;
  onSubmit: (data: SprintActivityPlanFormData) => Promise<void> | void;
}) {
  const [data, setData] = useState<SprintActivityPlanFormData>({ ...empty, ...initial });
  const userOptions = useMemo(() => users.map(toUserOption), [users]);
  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === data.activityId) || null,
    [activities, data.activityId],
  );
  const plannedHoursNow = Number(data.plannedHours || 0);
  const totalPlannedAfterSave = (selectedActivity?.plannedHoursOutsideSprint || 0) + plannedHoursNow;
  const exceedsEstimate =
    Boolean(selectedActivity)
    && (selectedActivity?.estimatedHours ?? 0) > 0
    && totalPlannedAfterSave > (selectedActivity?.estimatedHours ?? 0);

  const set = <K extends keyof SprintActivityPlanFormData>(
    key: K,
    value: SprintActivityPlanFormData[K],
  ) => setData((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Selecionar atividade"
        required
        hint="Escolha uma atividade do backlog ou do projeto para planejar dentro desta sprint."
      >
        <Select value={data.activityId || undefined} onValueChange={(value) => set("activityId", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar atividade" />
          </SelectTrigger>
          <SelectContent>
            {activities.map((activity) => (
              <SelectItem key={activity.id} value={activity.id}>
                {activity.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {selectedActivity ? (
        <div className="rounded-2xl border border-border bg-muted/15 p-4 text-sm">
          <div className="font-medium">{selectedActivity.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {selectedActivity.projectName || "Sem projeto vinculado"}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <SummaryLine label="Estimativa total" value={formatHoursLabel(selectedActivity.estimatedHours)} />
            <SummaryLine label="Ja planejado" value={formatHoursLabel(selectedActivity.plannedHoursOutsideSprint)} />
            <SummaryLine label="Ja realizado" value={formatHoursLabel(selectedActivity.realizedHours)} />
            <SummaryLine label="Saldo estimado" value={formatHoursLabel(selectedActivity.estimatedBalanceHours)} />
          </div>
          {exceedsEstimate ? (
            <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Esta atividade possui {formatHoursLabel(selectedActivity.estimatedHours)} estimadas, mas ficara com {formatHoursLabel(totalPlannedAfterSave)} planejadas no total.
            </div>
          ) : null}
        </div>
      ) : null}

      <Field
        label="Responsaveis pela execucao"
        hint="Opcional. Use quando a sprint ja tiver uma alocacao definida."
      >
        <UserPickerField
          options={userOptions}
          selected={data.responsibleIds}
          onChange={(selected) => set("responsibleIds", selected)}
          placeholder="Adicionar responsável..."
          emptySelectedText="Nenhum responsável planejado ainda."
          selectedLabel="Responsaveis planejados"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Horas planejadas para esta sprint" required>
          <Input
            type="number"
            min={0}
            step="0.25"
            value={data.plannedHours}
            onChange={(event) => set("plannedHours", event.target.value)}
            placeholder="Ex.: 5"
            required
          />
        </Field>

        <Field label="Story points">
          <Input
            type="number"
            min={0}
            value={data.storyPoints}
            onChange={(event) => set("storyPoints", event.target.value)}
            placeholder="Opcional"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Previsao de início">
          <Input
            type="date"
            value={data.plannedStartDate}
            onChange={(event) => set("plannedStartDate", event.target.value)}
          />
        </Field>

        <Field label="Previsao de termino">
          <Input
            type="date"
            value={data.plannedEndDate}
            onChange={(event) => set("plannedEndDate", event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ordem / prioridade dentro da sprint">
          <Input
            type="number"
            min={0}
            value={data.order}
            onChange={(event) => set("order", event.target.value)}
            placeholder="Opcional"
          />
        </Field>

        <Field label="Observação do planejamento">
          <Textarea
            value={data.notes}
            onChange={(event) => set("notes", event.target.value)}
            rows={3}
            placeholder="Ex.: executar no início da sprint para destravar homologacao."
          />
        </Field>
      </div>

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

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
