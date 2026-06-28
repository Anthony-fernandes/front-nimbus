import { FormEvent, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  Layers,
  Save,
  Target,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/app/Field";
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
import { listProjects } from "@/services/projectService";
import { saveSprint } from "@/services/sprintService";
import { listUsers } from "@/services/userService";

type SelectOption = { value: string; label: string };

export type SprintFormData = {
  name: string;
  project: string;
  lead: string;
  startAt: string;
  endAt: string;
  goal: string;
  status: string;
  capacity: string;
};

const empty: SprintFormData = {
  name: "",
  project: "",
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
    user.name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username ||
    "Usuário";
  return { value: user.id, label };
}

function calcDuration(start: string, end: string): string | null {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return null;
  const days = Math.round(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const rem = days % 7;
  if (weeks === 0) return `${days}d`;
  if (rem === 0) return `${weeks} sem`;
  return `${weeks} sem e ${rem}d`;
}

function formatDisplayDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_STYLES: Record<string, string> = {
  Planejada: "bg-muted text-muted-foreground",
  Ativa: "bg-primary text-primary-foreground",
  Concluida: "bg-success text-success-foreground",
  Cancelada: "bg-destructive text-destructive-foreground",
};

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
  const [saving, setSaving] = useState(false);

  const { data: users = [] } = useQuery({ queryKey: ["form-users"], queryFn: listUsers });
  const { data: projects = [] } = useQuery({ queryKey: ["form-projects"], queryFn: listProjects });

  const userOptions = users.map(toUserOption);
  const projectOptions = projects.filter(Boolean).map((p) => ({
    value: p!.id,
    label: p!.organization_name || p!.client_name
      ? `${p!.name} · ${p!.organization_name || p!.client_name}`
      : p!.name,
  }));

  const set = <K extends keyof SprintFormData>(key: K, value: SprintFormData[K]) =>
    setData((cur) => ({ ...cur, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data.name.trim() || !data.project) {
      toast.error("Preencha o nome da sprint e selecione o projeto.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveSprint(data, mode, entityId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sprints"] }),
        queryClient.invalidateQueries({ queryKey: ["sprint", saved.id] }),
      ]);
      toast.success(mode === "create" ? "Sprint criada com sucesso!" : "Sprint atualizada.");
      navigate({ to: `/sprints/${saved.id}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar sprint.");
    } finally {
      setSaving(false);
    }
  };

  const duration = calcDuration(data.startAt, data.endAt);
  const leadName = userOptions.find((u) => u.value === data.lead)?.label;
  const projectName = projectOptions.find((p) => p.value === data.project)?.label;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      {/* ── Left: form fields ── */}
      <div className="space-y-5">
        {/* Identity */}
        <section className="glass rounded-2xl p-6 shadow-card space-y-5 animate-fade-in-up">
          <div className="flex items-center gap-2.5 border-b border-border pb-4">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Identidade da sprint</h3>
              <p className="text-xs text-muted-foreground">Nome e objetivo principal do ciclo</p>
            </div>
          </div>

          <Field label="Nome da sprint" required>
            <Input
              placeholder="ex: Sprint 12 — Módulo de relatórios"
              value={data.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </Field>

          <Field label="Objetivo" hint="Descreva o resultado esperado ao encerrar este ciclo.">
            <Textarea
              placeholder="Ao final desta sprint, esperamos entregar…"
              value={data.goal}
              onChange={(e) => set("goal", e.target.value)}
              rows={3}
              className="resize-none"
            />
          </Field>
        </section>

        {/* Context */}
        <section className="glass rounded-2xl p-6 shadow-card space-y-5 animate-fade-in-up">
          <div className="flex items-center gap-2.5 border-b border-border pb-4">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Contexto e responsabilidade</h3>
              <p className="text-xs text-muted-foreground">Projeto, responsável e status inicial</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Projeto" required hint="A sprint herda a organização do projeto.">
              <Selectable
                value={data.project}
                onChange={(v) => set("project", v)}
                options={projectOptions}
                placeholder="Selecionar projeto"
                icon={<Layers className="h-3.5 w-3.5" />}
              />
            </Field>

            <Field label="Responsável">
              <Selectable
                value={data.lead}
                onChange={(v) => set("lead", v)}
                options={userOptions}
                placeholder="Sem responsável"
                allowEmpty
                icon={<User className="h-3.5 w-3.5" />}
              />
            </Field>

            <Field label="Status inicial">
              <Selectable
                value={data.status}
                onChange={(v) => set("status", v)}
                options={["Planejada", "Ativa", "Concluida", "Cancelada"].map((s) => ({
                  value: s,
                  label: formatSprintStatusLabel(s),
                }))}
                icon={<Flag className="h-3.5 w-3.5" />}
              />
            </Field>

            <Field label="Capacidade da equipe (h)" hint="Total de horas disponíveis no ciclo.">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  step="0.25"
                  placeholder="80"
                  value={data.capacity}
                  onChange={(e) => set("capacity", e.target.value)}
                  className="pl-9"
                />
              </div>
            </Field>
          </div>
        </section>

        {/* Timeline */}
        <section className="glass rounded-2xl p-6 shadow-card space-y-5 animate-fade-in-up">
          <div className="flex items-center gap-2.5 border-b border-border pb-4">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-success/10 text-success">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Período do ciclo</h3>
              <p className="text-xs text-muted-foreground">Datas de início e encerramento</p>
            </div>
            {duration && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {duration}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de início">
              <Input
                type="date"
                value={data.startAt}
                onChange={(e) => set("startAt", e.target.value)}
              />
            </Field>
            <Field label="Data de encerramento">
              <Input
                type="date"
                value={data.endAt}
                onChange={(e) => set("endAt", e.target.value)}
              />
            </Field>
          </div>

          {data.startAt && data.endAt && !duration && (
            <p className="text-xs text-destructive">A data de encerramento deve ser após o início.</p>
          )}
        </section>
      </div>

      {/* ── Right: preview + actions ── */}
      <div className="space-y-4">
        {/* Live preview card */}
        <div className="glass rounded-2xl p-5 shadow-card space-y-4 animate-fade-in-up">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5" />
            Prévia
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">Nome</p>
              <p className="text-sm font-semibold text-foreground truncate">
                {data.name || <span className="italic text-muted-foreground/60">Não preenchido</span>}
              </p>
            </div>

            {projectName && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-0.5">Projeto</p>
                <p className="text-sm text-foreground truncate">{projectName}</p>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[data.status] ?? "bg-muted text-muted-foreground"}`}>
                {formatSprintStatusLabel(data.status)}
              </span>
              {duration && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {duration}
                </span>
              )}
              {data.capacity && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {data.capacity}h cap.
                </span>
              )}
            </div>

            {(data.startAt || data.endAt) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span>{formatDisplayDate(data.startAt)}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{formatDisplayDate(data.endAt)}</span>
              </div>
            )}

            {leadName && (
              <div className="flex items-center gap-2">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-primary text-[9px] font-bold text-primary-foreground">
                  {leadName[0].toUpperCase()}
                </div>
                <span className="text-xs text-foreground">{leadName}</span>
              </div>
            )}

            {data.goal && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-[11px] text-muted-foreground mb-0.5">Objetivo</p>
                <p className="text-xs text-foreground/80 line-clamp-3">{data.goal}</p>
              </div>
            )}
          </div>
        </div>

        {/* Next steps */}
        <div className="glass rounded-2xl p-5 shadow-card space-y-3 animate-fade-in-up">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Próximos passos</p>
          <div className="space-y-2.5">
            {[
              { n: 1, text: "Salve a sprint com nome e projeto." },
              { n: 2, text: "Adicione atividades e chamados no planejamento." },
              { n: 3, text: "Distribua as horas por técnico." },
            ].map(({ n, text }) => (
              <div key={n} className="flex items-start gap-3">
                <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {n}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="sticky top-20 flex flex-col gap-2 rounded-2xl p-3 shadow-card glass">
          <Button
            type="submit"
            disabled={saving}
            className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {mode === "create" ? "Criar sprint" : "Salvar alterações"}
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
  icon,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Select
      value={value || (allowEmpty ? "__none__" : undefined)}
      onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
    >
      <SelectTrigger>
        {icon && <span className="mr-1.5 text-muted-foreground">{icon}</span>}
        <SelectValue placeholder={placeholder ?? "Selecionar"} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__none__">Nenhum</SelectItem>}
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
