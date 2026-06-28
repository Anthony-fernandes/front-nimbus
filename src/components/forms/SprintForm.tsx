import { FormEvent, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  Pencil,
  Plus,
  Target,
  Trash2,
  Users,
  UserPlus,
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
import type { SprintParticipant, Team } from "@/lib/types";
import { saveSprint } from "@/services/sprintService";
import { listUsers } from "@/services/userService";
import { listTeams } from "@/services/teamService";

export type SprintFormData = {
  name: string;
  goal: string;
  observations: string;
  startAt: string;
  endAt: string;
  status: string;
};

// Draft participant before sprint exists (no id yet)
type DraftParticipant = Omit<SprintParticipant, "id" | "sprintId"> & {
  _key: string; // local unique key
};

const empty: SprintFormData = {
  name: "",
  goal: "",
  observations: "",
  startAt: "",
  endAt: "",
  status: "Planejada",
};

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

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
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
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const { data: users = [] } = useQuery({ queryKey: ["form-users"], queryFn: listUsers });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: listTeams });

  const set = <K extends keyof SprintFormData>(key: K, value: SprintFormData[K]) =>
    setData((cur) => ({ ...cur, [key]: value }));

  // Derived
  const duration = calcDuration(data.startAt, data.endAt);
  const totalCapacity = participants.reduce((s, p) => s + (p.capacity || 0), 0);

  // Add a single user (dedup by userId)
  function addUser(userId: string, userName: string, teamId?: string, teamName?: string, inclusionMode: "team" | "manual" = "manual") {
    setParticipants((prev) => {
      if (prev.some((p) => p.userId === userId)) return prev; // dedup
      const newP: DraftParticipant = {
        _key: `${userId}-${Date.now()}`,
        userId,
        userName,
        teamId: teamId || null,
        teamName: teamName || null,
        inclusionMode,
        hoursPerDay: 8,
        workingDays: 0,
        availabilityFactor: 100,
        capacity: 0,
        storyPointsPlanned: 0,
        storyPointsCompleted: 0,
        hoursPlanned: 0,
        hoursExecuted: 0,
        isAvailable: true,
        notes: "",
      };
      return [...prev, newP];
    });
  }

  // Add all members of a team
  function addTeam(team: Team) {
    const members = team.members ?? [];
    members.forEach((m) => addUser(m.user, m.user_name || m.user, team.id, team.name, "team"));
    setShowTeamPicker(false);
    toast.success(`${members.length} técnico(s) da equipe "${team.name}" adicionados.`);
  }

  function removeParticipant(key: string) {
    setParticipants((prev) => prev.filter((p) => p._key !== key));
  }

  function updateParticipant(key: string, patch: Partial<DraftParticipant>) {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p._key !== key) return p;
        const updated = { ...p, ...patch };
        // Recalculate capacity
        updated.capacity = updated.hoursPerDay * updated.workingDays * (updated.availabilityFactor / 100);
        return updated;
      })
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) {
      toast.error("Preencha o nome da sprint.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveSprint(data, mode, entityId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sprints"] }),
        queryClient.invalidateQueries({ queryKey: ["sprint", saved.id] }),
      ]);
      toast.success(mode === "create" ? "Sprint criada!" : "Sprint atualizada.");
      navigate({ to: `/sprints/${saved.id}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar sprint.");
    } finally {
      setSaving(false);
    }
  };

  // Users not yet added
  const availableUsers = useMemo(
    () => users.filter((u) => !participants.some((p) => p.userId === String(u.id))),
    [users, participants]
  );

  const availableTeams = teams; // all teams can be added (members deduped)

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* ── Left ── */}
      <div className="space-y-5">
        {/* Identity */}
        <section className="glass rounded-2xl p-6 shadow-card space-y-5 animate-fade-in-up">
          <SectionHeader icon={<Target className="h-4 w-4" />} color="text-primary bg-primary/10" title="Identidade da sprint" sub="Nome, objetivo e período do ciclo" />

          <Field label="Nome da sprint" required>
            <Input placeholder="ex: Sprint 12 — Entregas de junho" value={data.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>

          <Field label="Objetivo" hint="Descreva o resultado esperado ao encerrar este ciclo.">
            <Textarea placeholder="Ao final desta sprint, esperamos entregar…" value={data.goal} onChange={(e) => set("goal", e.target.value)} rows={3} className="resize-none" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Status inicial">
              <Select value={data.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><Flag className="mr-2 h-3.5 w-3.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Planejada", "Ativa", "Concluida", "Cancelada"].map((s) => (
                    <SelectItem key={s} value={s}>{formatSprintStatusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div /> {/* spacer */}
          </div>
        </section>

        {/* Period */}
        <section className="glass rounded-2xl p-6 shadow-card space-y-5 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <SectionHeader icon={<CalendarDays className="h-4 w-4" />} color="text-success bg-success/10" title="Período do ciclo" sub="Datas de início e encerramento" />
            {duration && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{duration}</span>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início"><Input type="date" value={data.startAt} onChange={(e) => set("startAt", e.target.value)} /></Field>
            <Field label="Encerramento"><Input type="date" value={data.endAt} onChange={(e) => set("endAt", e.target.value)} /></Field>
          </div>
          {data.startAt && data.endAt && !duration && (
            <p className="text-xs text-destructive">A data de encerramento deve ser após o início.</p>
          )}
        </section>

        {/* Participants */}
        <section className="glass rounded-2xl p-6 shadow-card space-y-5 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <SectionHeader icon={<Users className="h-4 w-4" />} color="text-accent bg-accent/10" title="Participantes" sub="Equipes e técnicos que atuam neste ciclo" />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setShowTeamPicker(true); setShowUserPicker(false); }}>
                <Users className="h-3.5 w-3.5" /> Adicionar equipe
              </Button>
              <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setShowUserPicker(true); setShowTeamPicker(false); }}>
                <UserPlus className="h-3.5 w-3.5" /> Adicionar técnico
              </Button>
            </div>
          </div>

          {/* Team picker */}
          {showTeamPicker && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Selecionar equipe</p>
              {availableTeams.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma equipe cadastrada.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableTeams.map((t) => (
                    <button key={t.id} type="button" onClick={() => addTeam(t)}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: t.color || "#6366f1" }}>
                        {t.icon || initials(t.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.member_count ?? t.members?.length ?? 0} membro(s)</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={() => setShowTeamPicker(false)}>Fechar</Button>
            </div>
          )}

          {/* User picker */}
          {showUserPicker && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Selecionar técnico</p>
              {availableUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Todos os técnicos já foram adicionados.</p>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2 max-h-52 overflow-y-auto pr-1">
                  {availableUsers.map((u) => {
                    const name = u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Usuário";
                    return (
                      <button key={u.id} type="button" onClick={() => { addUser(String(u.id), name); setShowUserPicker(false); }}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors">
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                          {initials(name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{name}</p>
                          {u.job_title && <p className="text-[10px] text-muted-foreground truncate">{u.job_title}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={() => setShowUserPicker(false)}>Fechar</Button>
            </div>
          )}

          {/* Participants table */}
          {participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum participante adicionado.</p>
              <p className="text-xs text-muted-foreground/70">Use os botões acima para adicionar equipes ou técnicos.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Participante</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Origem</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">h/dia</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Dias</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Disp%</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Cap.</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <ParticipantRow
                      key={p._key}
                      p={p}
                      editing={editingKey === p._key}
                      onEdit={() => setEditingKey(editingKey === p._key ? null : p._key)}
                      onRemove={() => removeParticipant(p._key)}
                      onUpdate={(patch) => updateParticipant(p._key, patch)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Observations */}
          <Field label="Observações">
            <Textarea placeholder="Notas gerais sobre a sprint…" value={data.observations} onChange={(e) => set("observations", e.target.value)} rows={2} className="resize-none" />
          </Field>
        </section>
      </div>

      {/* ── Right: summary + actions ── */}
      <div className="space-y-4">
        {/* Live summary */}
        <div className="glass rounded-2xl p-5 shadow-card space-y-4 animate-fade-in-up">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5" /> Resumo
          </div>

          {/* Sprint preview */}
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-foreground truncate">
              {data.name || <span className="italic text-muted-foreground/60">Nome não preenchido</span>}
            </p>

            <div className="flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[data.status] ?? "bg-muted text-muted-foreground"}`}>
                {formatSprintStatusLabel(data.status)}
              </span>
              {duration && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{duration}</span>}
            </div>

            {(data.startAt || data.endAt) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span>{formatDisplayDate(data.startAt)}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{formatDisplayDate(data.endAt)}</span>
              </div>
            )}

            {data.goal && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-foreground/80 line-clamp-2">{data.goal}</p>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <SummaryRow label="Participantes" value={String(participants.length)} />
            <SummaryRow label="Equipes" value={String(new Set(participants.filter(p => p.teamId).map(p => p.teamId)).size)} />
            <SummaryRow label="Técnicos individuais" value={String(participants.filter(p => p.inclusionMode === "manual").length)} />
            <SummaryRow
              label="Capacidade total"
              value={totalCapacity > 0 ? `${totalCapacity.toFixed(1)}h` : "—"}
              highlight={totalCapacity > 0}
            />
          </div>
        </div>

        {/* Next steps */}
        <div className="glass rounded-2xl p-5 shadow-card space-y-3 animate-fade-in-up">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Próximos passos</p>
          <div className="space-y-2.5">
            {[
              "Salve a sprint com nome e período.",
              "Adicione atividades e chamados no planejamento.",
              "Distribua as horas planejadas por técnico.",
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="sticky top-20 flex flex-col gap-2 rounded-2xl p-3 shadow-card glass">
          <Button type="submit" disabled={saving} className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            {saving
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              : <CheckCircle2 className="h-4 w-4" />}
            {mode === "create" ? "Criar sprint" : "Salvar alterações"}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => navigate({ to: onCancelHref })}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon, color, title, sub }: { icon: React.ReactNode; color: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`grid h-8 w-8 place-items-center rounded-lg ${color}`}>{icon}</div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function ParticipantRow({
  p,
  editing,
  onEdit,
  onRemove,
  onUpdate,
}: {
  p: DraftParticipant;
  editing: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<DraftParticipant>) => void;
}) {
  const name = p.userName || p.userId;
  const cap = p.hoursPerDay * p.workingDays * (p.availabilityFactor / 100);

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
              {name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{name}</p>
              {p.teamName && <p className="text-[10px] text-muted-foreground truncate">{p.teamName}</p>}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 hidden sm:table-cell">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.inclusionMode === "team" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
            {p.inclusionMode === "team" ? "Equipe" : "Manual"}
          </span>
        </td>
        <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{p.hoursPerDay}h</td>
        <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{p.workingDays}d</td>
        <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{p.availabilityFactor}%</td>
        <td className="px-3 py-2.5 text-center text-xs font-semibold text-foreground">{cap > 0 ? `${cap.toFixed(0)}h` : "—"}</td>
        <td className="px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1">
            <button type="button" onClick={onEdit} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onRemove} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-border bg-muted/30">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Horas/dia</span>
                <Input type="number" min={1} max={24} step={0.5} value={p.hoursPerDay}
                  onChange={(e) => onUpdate({ hoursPerDay: Number(e.target.value) })} className="h-7 text-xs" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Dias úteis</span>
                <Input type="number" min={0} max={31} value={p.workingDays}
                  onChange={(e) => onUpdate({ workingDays: Number(e.target.value) })} className="h-7 text-xs" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Disponibilidade %</span>
                <Input type="number" min={0} max={100} value={p.availabilityFactor}
                  onChange={(e) => onUpdate({ availabilityFactor: Number(e.target.value) })} className="h-7 text-xs" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Observações</span>
                <Input value={p.notes || ""} onChange={(e) => onUpdate({ notes: e.target.value })} className="h-7 text-xs" placeholder="Opcional" />
              </label>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={p.isAvailable !== false} onChange={(e) => onUpdate({ isAvailable: e.target.checked })} className="rounded" />
                Disponível
              </label>
              <span className="text-xs text-muted-foreground">
                Capacidade calculada: <strong className="text-foreground">{(p.hoursPerDay * p.workingDays * (p.availabilityFactor / 100)).toFixed(1)}h</strong>
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
