import { FormEvent, useState } from "react";

import { Field } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityTag } from "@/lib/types";

export type ActivityTagConfigFormData = {
  id: string;
  name: string;
  color: string;
  description: string;
  active: boolean;
};

const empty: ActivityTagConfigFormData = {
  id: "",
  name: "",
  color: "#5ea8ff",
  description: "",
  active: true,
};

export function toActivityTagConfigFormData(
  tag?: ActivityTag | null,
): ActivityTagConfigFormData {
  return {
    id: tag?.id || "",
    name: tag?.name || "",
    color: tag?.color || "#5ea8ff",
    description: tag?.description || "",
    active: tag?.active ?? true,
  };
}

export function ActivityTagConfigForm({
  initial,
  saving = false,
  submitLabel = "Salvar tag",
  onSubmit,
}: {
  initial?: Partial<ActivityTagConfigFormData>;
  saving?: boolean;
  submitLabel?: string;
  onSubmit: (data: ActivityTagConfigFormData) => Promise<void> | void;
}) {
  const [data, setData] = useState<ActivityTagConfigFormData>({ ...empty, ...initial });

  const set = <K extends keyof ActivityTagConfigFormData>(
    key: K,
    value: ActivityTagConfigFormData[K],
  ) => setData((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome da tag" required>
        <Input
          value={data.name}
          onChange={(event) => set("name", event.target.value)}
          placeholder="Ex.: Backend"
          required
          maxLength={80}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[0.7fr_0.3fr]">
        <Field label="Descricao">
          <Textarea
            value={data.description}
            onChange={(event) => set("description", event.target.value)}
            rows={4}
            placeholder="Explique quando essa tag deve ser usada."
          />
        </Field>

        <Field label="Cor">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/15 px-3 py-3">
            <input
              type="color"
              value={data.color}
              onChange={(event) => set("color", event.target.value)}
              className="h-10 w-12 rounded-lg border border-border bg-transparent"
            />
            <div className="min-w-0">
              <div className="text-sm font-medium">Visual da tag</div>
              <div className="truncate text-xs text-muted-foreground">{data.color}</div>
            </div>
          </div>
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/15 px-4 py-3 transition-colors hover:border-primary/40">
        <Checkbox
          checked={data.active}
          onCheckedChange={(value) => set("active", Boolean(value))}
          className="mt-0.5"
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium">Tag ativa</span>
          <span className="block text-sm text-muted-foreground">
            Tags inativas continuam aparecendo em atividades antigas, mas nao podem ser escolhidas em novos cadastros.
          </span>
        </span>
      </label>

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
