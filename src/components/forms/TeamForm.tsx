import { FormEvent, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Info,
  Palette,
  Plus,
  Trash2,
  UserPlus,
  Users,
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
import type { Team, TeamMember } from "@/lib/types";
import {
  createTeam,
  updateTeam,
  addTeamMember,
  removeTeamMember,
  listTeamMembers,
} from "@/services/teamService";
import { listUsers } from "@/services/userService";

export type TeamFormData = {
  name: string;
  description: string;
  leader: string;
  status: string;
  color: string;
  icon: string;
  default_capacity: string;
};

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#0ea5e9", "#64748b",
];

const empty: TeamFormData = {
  name: "",
  description: "",
  leader: "",
  status: "Ativa",
  color: "#6366f1",
  icon: "",
  default_capacity: "",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function TeamForm({
  initial,
  mode = "create",
  entityId,
  onCancelHref = "/equipes",
  initialMembers = [],
}: {
  initial?: Partial<TeamFormData>;
  mode?: "create" | "edit";
  entityId?: string;
  onCancelHref?: string;
  initialMembers?: TeamMember[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [data, setData] = useState<TeamFormData>({ ...empty, ...initial });
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: users = [] } = useQuery({ queryKey: ["form-users"], queryFn: listUsers });

  const set = <K extends keyof TeamFormData>(key: K, value: TeamFormData[K]) =>
    setData((cur) => ({ ...cur, [key]: value }));

  const userOptions = useMemo(
    () => users.filter((u) => !members.some((m) => String(m.user) === String(u.id))),
    [users, members]
  );
  const leaderOptions = users.map((u) => ({
    value: String(u.id),
    label: u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Usuário",
  }));

  const leaderName = leaderOptions.find((o) => o.value === data.leader)?.label;

  async function handleAddMember(userId: string, userName: string) {
    if (mode === "edit" && entityId) {
      try {
        const saved = await addTeamMember({ team: entityId, user: userId });
        setMembers((prev) => [...prev, { ...saved, user_name: userName }]);
        toast.success(`${userName} adicionado(a).`);
      } catch {
        toast.error("Erro ao adicionar membro.");
      }
    } else {
      // draft mode: just keep in local list
      const draft: TeamMember = { id: `draft-${userId}`, team: "", user: userId, user_name: userName };
      setMembers((prev) => [...prev, draft]);
    }
    setShowUserPicker(false);
  }

  async function handleRemoveMember(member: TeamMember) {
    if (mode === "edit" && !member.id.startsWith("draft-")) {
      setRemovingId(member.id);
      try {
        await removeTeamMember(member.id);
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
        toast.success("Membro removido.");
      } catch {
        toast.error("Erro ao remover membro.");
      } finally {
        setRemovingId(null);
      }
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) {
      toast.error("Preencha o nome da equipe.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Team> = {
        name: data.name,
        description: data.description,
        leader: data.leader || null,
        status: data.status,
        color: data.color,
        icon: data.icon,
        default_capacity: data.default_capacity ? Number(data.default_capacity) : 0,
      };

      let saved: Team;
      if (mode === "edit" && entityId) {
        saved = await updateTeam(entityId, payload);
      } else {
        saved = await createTeam(payload);
        // Add members after creation
        await Promise.all(
          members.map((m) => addTeamMember({ team: saved.id, user: m.user }))
        );
      }

      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success(mode === "create" ? "Equipe criada!" : "Equipe atualizada.");
      navigate({ to: `/equipes/${saved.id}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar equipe.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* ── Left ── */}
      <div className="space-y-5">
        {/* Identity */}
        <section className="glass rounded-2xl p-6 shadow-card space-y-5 animate-fade-in-up">
          <SectionHeader icon={<Info className="h-4 w-4" />} color="text-primary bg-primary/10" title="Identidade da equipe" sub="Nome, descrição e status" />

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Nome da equipe" required>
              <Input placeholder="ex: Equipe Backend" value={data.name} onChange={(e) => set("name", e.target.value)} required />
            </Field>
            <Field label="Status">
              <Select value={data.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Inativa">Inativa</SelectItem>
                  <SelectItem value="Arquivada">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Descrição">
            <Textarea placeholder="Descreva a responsabilidade e foco desta equipe…" value={data.description} onChange={(e) => set("description", e.target.value)} rows={3} className="resize-none" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Líder da equipe">
              <Select value={data.leader || "__none__"} onValueChange={(v) => set("leader", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sem líder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem líder</SelectItem>
                  {leaderOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Capacidade padrão (h)" hint="Horas de referência para sprints.">
              <Input type="number" min={0} step={0.5} placeholder="80" value={data.default_capacity} onChange={(e) => set("default_capacity", e.target.value)} />
            </Field>
          </div>
        </section>

        {/* Visual */}
        <section className="glass rounded-2xl p-6 shadow-card space-y-5 animate-fade-in-up">
          <SectionHeader icon={<Palette className="h-4 w-4" />} color="text-accent bg-accent/10" title="Identidade visual" sub="Cor e ícone da equipe" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cor da equipe">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => set("color", c)}
                      className={`h-7 w-7 rounded-full transition-all ${data.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "opacity-70 hover:opacity-100 hover:scale-105"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <Input type="color" value={data.color} onChange={(e) => set("color", e.target.value)} className="h-8 w-full cursor-pointer" />
              </div>
            </Field>
            <Field label="Ícone / Sigla" hint="Até 3 caracteres exibidos no avatar.">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: data.color }}>
                  {data.icon || initials(data.name || "?")}
                </div>
                <Input maxLength={3} placeholder={initials(data.name || "?") || "AB"} value={data.icon} onChange={(e) => set("icon", e.target.value.toUpperCase())} />
              </div>
            </Field>
          </div>
        </section>

        {/* Members */}
        <section className="glass rounded-2xl p-6 shadow-card space-y-5 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <SectionHeader icon={<Users className="h-4 w-4" />} color="text-success bg-success/10" title="Membros da equipe" sub="Técnicos que compõem esta equipe" />
            <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowUserPicker(!showUserPicker)}>
              <UserPlus className="h-3.5 w-3.5" /> Adicionar membro
            </Button>
          </div>

          {showUserPicker && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Selecionar técnico</p>
              {userOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Todos os técnicos já foram adicionados.</p>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2 max-h-52 overflow-y-auto pr-1">
                  {userOptions.map((u) => {
                    const name = u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Usuário";
                    return (
                      <button key={u.id} type="button" onClick={() => handleAddMember(String(u.id), name)}
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

          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
              <Users className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum membro adicionado.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {members.map((m) => {
                const name = m.user_name || String(m.user);
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                      {initials(name)}
                    </div>
                    <span className="flex-1 text-sm font-medium truncate">{name}</span>
                    {m.role && <span className="text-xs text-muted-foreground">{m.role}</span>}
                    <button type="button" disabled={removingId === m.id}
                      onClick={() => handleRemoveMember(m)}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Right: preview + actions ── */}
      <div className="space-y-4">
        {/* Preview */}
        <div className="glass rounded-2xl p-5 shadow-card space-y-4 animate-fade-in-up">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prévia</p>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow" style={{ backgroundColor: data.color }}>
              {data.icon || initials(data.name || "?")}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{data.name || <span className="italic text-muted-foreground/60">Nome não preenchido</span>}</p>
              {leaderName && <p className="text-xs text-muted-foreground">Líder: {leaderName}</p>}
            </div>
            <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${data.status === "Ativa" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
              {data.status}
            </span>
          </div>

          {data.description && (
            <p className="text-xs text-muted-foreground line-clamp-3 border-t border-border pt-3">{data.description}</p>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <SummaryRow label="Membros" value={String(members.length)} />
            {data.default_capacity && <SummaryRow label="Capacidade padrão" value={`${data.default_capacity}h`} highlight />}
          </div>
        </div>

        {/* Actions */}
        <div className="sticky top-20 flex flex-col gap-2 rounded-2xl p-3 shadow-card glass">
          <Button type="submit" disabled={saving} className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            {saving
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              : <CheckCircle2 className="h-4 w-4" />}
            {mode === "create" ? "Criar equipe" : "Salvar alterações"}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => navigate({ to: onCancelHref })}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}

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
