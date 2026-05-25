import { FormEvent, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Field, FormSection } from "@/components/app/Field";
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
import { formatSprintStatusLabel } from "@/lib/labels";
import { saveSprint } from "@/services/sprintService";
import { listUsers } from "@/services/userService";

type SelectOption = {
  value: string;
  label: string;
};

export type SprintFormData = {
  name: string;
  lead: string;
  startAt: string;
  endAt: string;
  goal: string;
  status: string;
  capacity: string;
};

const empty: SprintFormData = {
  name: "",
  lead: "",
  startAt: "",
  endAt: "",
  goal: "",
  status: "Planejada",
  capacity: "",
};

function toUserOption(user: {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}): SelectOption {
  const label =
    user.name
    || [user.first_name, user.last_name].filter(Boolean).join(" ")
    || user.username
    || "Usuario";

  return { value: user.id, label };
}

export function SprintForm({
  initial,
  mode = "create",
  onCancelHref = "/sprints",
  entityId,
}: {
  initial?: Partial<SprintFormData>;
  mode?: "create" | "edit";
  onCancelHref?: string;
  entityId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [data, setData] = useState<SprintFormData>({ ...empty, ...initial });

  const { data: users = [] } = useQuery({
    queryKey: ["form-users"],
    queryFn: () => listUsers(),
  });

  const userOptions = users.map(toUserOption);

  const set = <K extends keyof SprintFormData>(key: K, value: SprintFormData[K]) =>
    setData((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!data.name.trim()) {
      toast.error("Preencha o nome da sprint.");
      return;
    }

    try {
      const saved = await saveSprint(data, mode, entityId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sprints"] }),
        queryClient.invalidateQueries({ queryKey: ["sprint", saved.id] }),
      ]);
      toast.success(mode === "create" ? "Sprint criada." : "Sprint atualizada.");
      navigate({ to: `/sprints/${saved.id}` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar sprint.");
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <FormSection
          title="Dados da sprint"
          description="Cadastre apenas os dados do ciclo. O planejamento das atividades acontece depois, dentro da sprint."
        >
          <Field label="Nome" required>
            <Input
              value={data.name}
              onChange={(event) => set("name", event.target.value)}
              required
            />
          </Field>

          <Field label="Objetivo" hint="Defina o resultado esperado ao final do ciclo.">
            <Textarea
              value={data.goal}
              onChange={(event) => set("goal", event.target.value)}
              rows={4}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Responsavel">
              <Selectable
                value={data.lead}
                onChange={(value) => set("lead", value)}
                options={userOptions}
                placeholder="Sem responsavel"
                allowEmpty
              />
            </Field>

            <Field label="Status">
              <Selectable
                value={data.status}
                onChange={(value) => set("status", value)}
                options={["Planejada", "Ativa", "Concluida", "Cancelada"].map((item) => ({
                  value: item,
                  label: formatSprintStatusLabel(item),
                }))}
              />
            </Field>

            <Field label="Capacidade da equipe (h)">
              <Input
                type="number"
                min={0}
                step="0.25"
                value={data.capacity}
                onChange={(event) => set("capacity", event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Inicio">
              <Input
                type="date"
                value={data.startAt}
                onChange={(event) => set("startAt", event.target.value)}
              />
            </Field>

            <Field label="Fim">
              <Input
                type="date"
                value={data.endAt}
                onChange={(event) => set("endAt", event.target.value)}
              />
            </Field>
          </div>
        </FormSection>
      </div>

      <div className="space-y-5">
        <FormSection
          title="Proximo passo"
          description="Depois de salvar a sprint, adicione as atividades e distribua horas planejadas diretamente na tela de detalhes da sprint."
        >
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>1. Salve a sprint.</p>
            <p>2. Abra a tela da sprint.</p>
            <p>3. Planeje as atividades com horas, responsaveis e previsoes.</p>
          </div>
        </FormSection>

        <div className="sticky top-20 flex flex-col gap-2 rounded-2xl p-3 shadow-card glass">
          <Button
            type="submit"
            className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {mode === "create" ? "Criar sprint" : "Salvar alteracoes"}
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
