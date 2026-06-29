import { FormEvent, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Info,
  Palette,
  Trash2,
  UserPlus,
  Users,
  Zap,
  // icon picker icons
  Rocket, Code2, Database, Globe, Layout, Layers, Server,
  ShieldCheck, Cpu, Bug, GitBranch, Terminal, Wifi, Lock,
  Wrench, Settings, BarChart3, LineChart, PieChart, TrendingUp,
  HeartPulse, Stethoscope, FlaskConical, Microscope, Atom,
  BookOpen, GraduationCap, Library, Newspaper, Pencil,
  Camera, Music, Gamepad2, Brush, Film,
  Package, Truck, ShoppingCart, Store, CreditCard,
  Building2, Home, Map, Navigation, Compass,
  PhoneCall, Mail, MessageSquare, Bell, Send,
  Sun, Moon, Star, Sparkles, Flame,
  type LucideIcon,
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

type IconEntry = { key: string; icon: LucideIcon };

const ICON_LIST: IconEntry[] = [
  { key: "Users", icon: Users },
  { key: "Rocket", icon: Rocket },
  { key: "Code2", icon: Code2 },
  { key: "Database", icon: Database },
  { key: "Globe", icon: Globe },
  { key: "Layout", icon: Layout },
  { key: "Layers", icon: Layers },
  { key: "Server", icon: Server },
  { key: "ShieldCheck", icon: ShieldCheck },
  { key: "Cpu", icon: Cpu },
  { key: "Bug", icon: Bug },
  { key: "GitBranch", icon: GitBranch },
  { key: "Terminal", icon: Terminal },
  { key: "Wifi", icon: Wifi },
  { key: "Lock", icon: Lock },
  { key: "Wrench", icon: Wrench },
  { key: "Settings", icon: Settings },
  { key: "BarChart3", icon: BarChart3 },
  { key: "LineChart", icon: LineChart },
  { key: "PieChart", icon: PieChart },
  { key: "TrendingUp", icon: TrendingUp },
  { key: "HeartPulse", icon: HeartPulse },
  { key: "Stethoscope", icon: Stethoscope },
  { key: "FlaskConical", icon: FlaskConical },
  { key: "Microscope", icon: Microscope },
  { key: "Atom", icon: Atom },
  { key: "BookOpen", icon: BookOpen },
  { key: "GraduationCap", icon: GraduationCap },
  { key: "Library", icon: Library },
  { key: "Newspaper", icon: Newspaper },
  { key: "Pencil", icon: Pencil },
  { key: "Camera", icon: Camera },
  { key: "Music", icon: Music },
  { key: "Gamepad2", icon: Gamepad2 },
  { key: "Brush", icon: Brush },
  { key: "Film", icon: Film },
  { key: "Package", icon: Package },
  { key: "Truck", icon: Truck },
  { key: "ShoppingCart", icon: ShoppingCart },
  { key: "Store", icon: Store },
  { key: "CreditCard", icon: CreditCard },
  { key: "Building2", icon: Building2 },
  { key: "Home", icon: Home },
  { key: "Map", icon: Map },
  { key: "Navigation", icon: Navigation },
  { key: "Compass", icon: Compass },
  { key: "PhoneCall", icon: PhoneCall },
  { key: "Mail", icon: Mail },
  { key: "MessageSquare", icon: MessageSquare },
  { key: "Bell", icon: Bell },
  { key: "Send", icon: Send },
  { key: "Sun", icon: Sun },
  { key: "Moon", icon: Moon },
  { key: "Star", icon: Star },
  { key: "Sparkles", icon: Sparkles },
  { key: "Flame", icon: Flame },
  { key: "Zap", icon: Zap },
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

  // icon can be a lucide key (e.g. "Rocket") or custom text sigla
  const selectedIconEntry = ICON_LIST.find((e) => e.key === data.icon);
  const SelectedIconComponent = selectedIconEntry?.icon ?? null;
  const teamIconLabel = !data.icon ? initials(data.name || "?") : selectedIconEntry ? null : data.icon;

  async function handleAddMember(userId: string, userName: string) {
    if (mode === "edit" && entityId) {
      try {
        const saved = await addTeamMember({ team: entityId, user: userId });
        setMembers((prev) => [...prev, { ...saved, user_name: userName }]);
        toast.success(`${userName} adicionado(a).`);
      } catch {
        toast.error("Não foi possível adicionar o membro. Tente novamente.");
      }
    } else {
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
        toast.error("Não foi possível remover o membro. Tente novamente.");
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
        await Promise.all(
          members.map((m) => addTeamMember({ team: saved.id, user: m.user }))
        );
      }

      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success(mode === "create" ? "Equipe criada!" : "Equipe atualizada.");
      navigate({ to: `/equipes/${saved.id}` });
    } catch {
      toast.error("Não foi possível salvar a equipe. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      {/* ── Left column ── */}
      <div className="space-y-5">
        {/* Identity */}
        <section className="glass rounded-2xl shadow-card animate-fade-in-up overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Identidade da equipe</h3>
              <p className="text-xs text-muted-foreground">Nome, descrição e configurações gerais</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
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
          </div>
        </section>

        {/* Members */}
        <section className="glass rounded-2xl shadow-card animate-fade-in-up overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-success/10 text-success">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Membros da equipe</h3>
                <p className="text-xs text-muted-foreground">Técnicos que compõem esta equipe</p>
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowUserPicker(!showUserPicker)}>
              <UserPlus className="h-3.5 w-3.5" /> Adicionar membro
            </Button>
          </div>

          <div className="p-5 space-y-4">
            {showUserPicker && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Selecionar técnico</p>
                {userOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Todos os técnicos já foram adicionados.</p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-52 overflow-y-auto pr-1">
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
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhum membro adicionado.</p>
                <Button type="button" size="sm" variant="outline" className="gap-1.5 text-xs mt-1" onClick={() => setShowUserPicker(true)}>
                  <UserPlus className="h-3.5 w-3.5" /> Adicionar primeiro membro
                </Button>
              </div>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {members.map((m) => {
                  const name = m.user_name || String(m.user);
                  return (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                        {initials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {m.role && <p className="text-xs text-muted-foreground">{m.role}</p>}
                      </div>
                      <button type="button" disabled={removingId === m.id}
                        onClick={() => handleRemoveMember(m)}
                        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Right sidebar ── */}
      <div className="space-y-5">
        {/* Preview */}
        <div className="glass rounded-2xl shadow-card animate-fade-in-up overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prévia</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow-md" style={{ backgroundColor: data.color }}>
                {SelectedIconComponent ? <SelectedIconComponent className="h-5 w-5 text-white" /> : teamIconLabel}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{data.name || <span className="italic text-muted-foreground/60">Nome não preenchido</span>}</p>
                {leaderName && <p className="text-xs text-muted-foreground truncate">Líder: {leaderName}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${data.status === "Ativa" ? "bg-success/15 text-success" : data.status === "Inativa" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
                {data.status}
              </span>
            </div>

            {data.description && (
              <p className="text-xs text-muted-foreground line-clamp-3 border-t border-border pt-3 leading-relaxed">{data.description}</p>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">Membros</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{members.length}</p>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">Capacidade</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{data.default_capacity ? `${data.default_capacity}h` : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Visual identity */}
        <div className="glass rounded-2xl shadow-card animate-fade-in-up overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
              <Palette className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Identidade visual</h3>
              <p className="text-xs text-muted-foreground">Cor e ícone da equipe</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Color */}
            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cor</p>
              <div className="flex flex-wrap gap-2.5">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set("color", c)}
                    className={`h-8 w-8 rounded-full transition-all ${data.color === c ? "ring-2 ring-offset-2 ring-white/60 scale-110 shadow-lg" : "opacity-60 hover:opacity-100 hover:scale-105"}`}
                    style={{ backgroundColor: c }} />
                ))}
                {/* custom color */}
                <label className="relative h-8 w-8 cursor-pointer rounded-full border-2 border-dashed border-border hover:border-primary/60 transition-colors grid place-items-center" title="Cor personalizada">
                  <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                  <input type="color" value={data.color} onChange={(e) => set("color", e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-full" />
                </label>
              </div>
            </div>

            {/* Icon picker */}
            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ícone</p>
              <div className="grid grid-cols-6 gap-2 max-h-56 overflow-y-auto">
                {/* Reset to initials */}
                <button
                  type="button"
                  title="Usar iniciais"
                  onClick={() => set("icon", "")}
                  className={`relative flex h-10 w-full items-center justify-center rounded-xl border text-[11px] font-bold transition-all col-span-1 ${!data.icon ? "border-primary bg-primary/15 text-primary shadow-sm" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:bg-muted/60"}`}
                >
                  {initials(data.name || "AB") || "AB"}
                  {!data.icon && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary" />}
                </button>
                {ICON_LIST.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    title={key}
                    onClick={() => set("icon", key)}
                    className={`relative flex h-10 w-full items-center justify-center rounded-xl border transition-all ${data.icon === key ? "border-primary bg-primary/15 text-primary shadow-sm" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"}`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {data.icon === key && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions — sticky */}
        <div className="sticky top-20 glass rounded-2xl shadow-card overflow-hidden animate-fade-in-up">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Ações</p>
          </div>
          <div className="p-4 space-y-2">
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
      </div>
    </form>
  );
}
