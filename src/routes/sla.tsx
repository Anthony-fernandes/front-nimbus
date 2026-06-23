import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createSLAPolicy,
  deleteSLAPolicy,
  getSLAAlerts,
  getSLAReport,
  listSLAPolicies,
  updateSLAPolicy,
  type SLAAlert,
  type SLAPolicy,
} from "@/services/reportService";
import {
  listBusinessHours,
  createBusinessHours,
  updateBusinessHours,
  deleteBusinessHours,
  listCompanyHolidays,
  createCompanyHoliday,
  deleteCompanyHoliday,
} from "@/services/businessHoursService";
import type { BusinessHours, CompanyHoliday } from "@/lib/types";

export const Route = createFileRoute("/sla")({
  head: () => ({ meta: [{ title: "SLA · NimbusDesk" }] }),
  component: SLAPage,
});

const PRIORITY_OPTIONS = [
  { value: "", label: "Qualquer prioridade" },
  { value: "Critica", label: "Crítica" },
  { value: "Alta", label: "Alta" },
  { value: "Media", label: "Média" },
  { value: "Baixa", label: "Baixa" },
];

const PRIORITY_COLOR: Record<string, string> = {
  Critica: "bg-destructive/15 text-destructive",
  Alta: "bg-orange-500/15 text-orange-400",
  Media: "bg-warning/15 text-warning",
  Baixa: "bg-info/15 text-info",
};

/** Format milliseconds remaining as "2h 15min restantes" or "Violado" */
function formatCountdown(dueAtIso: string): { label: string; urgent: boolean } {
  const diff = new Date(dueAtIso).getTime() - Date.now();
  if (diff <= 0) return { label: "Violado", urgent: true };
  const totalMin = Math.floor(diff / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const label = hours > 0 ? `${hours}h ${mins}min restantes` : `${mins}min restantes`;
  return { label, urgent: diff < 3600000 };
}

function CountdownBadge({ dueAt }: { dueAt: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { label, urgent } = formatCountdown(dueAt);
  void tick; // force re-render
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        urgent ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning",
      )}
    >
      {label}
    </span>
  );
}

type AlertFilter = "all" | "breached" | "warning";

function SLAPage() {
  const queryClient = useQueryClient();
  const [policyOpen, setPolicyOpen] = useState(false);
  const [editing, setEditing] = useState<SLAPolicy | null>(null);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");

  const alertsQuery = useQuery({ queryKey: ["sla-alerts"], queryFn: getSLAAlerts, refetchInterval: 120000 });
  const policiesQuery = useQuery({ queryKey: ["sla-policies"], queryFn: listSLAPolicies });
  const reportQuery = useQuery({ queryKey: ["sla-report"], queryFn: () => getSLAReport() });
  const businessHoursQuery = useQuery({ queryKey: ["business-hours"], queryFn: listBusinessHours });
  const holidaysQuery = useQuery({ queryKey: ["company-holidays"], queryFn: listCompanyHolidays });
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [addingHoliday, setAddingHoliday] = useState(false);

  const breached = alertsQuery.data?.breached ?? [];
  const warning = alertsQuery.data?.warning ?? [];

  const visibleBreached: SLAAlert[] = alertFilter === "warning" ? [] : breached;
  const visibleWarning: SLAAlert[] = alertFilter === "breached" ? [] : warning;
  const hasAlerts = visibleBreached.length > 0 || visibleWarning.length > 0;

  const report = reportQuery.data;
  const totalSLA = report?.total ?? 0;
  const onTimeRate = report?.on_time_rate != null ? Math.round(report.on_time_rate) : null;
  const breachedCount = report?.breached_open ?? breached.length;

  function openNew() {
    setEditing(null);
    setPolicyOpen(true);
  }

  function openEdit(policy: SLAPolicy) {
    setEditing(policy);
    setPolicyOpen(true);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSLAPolicy(id),
    onSuccess: () => {
      toast.success("Política removida.");
      void queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
    },
  });

  return (
    <AppShell>
      <div className="max-w-5xl space-y-6">
        <PageHeader
          title="SLA"
          subtitle="Políticas de prazo de atendimento e alertas de violação."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <ShieldCheck className="h-4 w-4" />
            </span>
          }
        />

        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass flex flex-col gap-1 rounded-2xl p-4 shadow-card">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Total c/ SLA</span>
            <span className="text-2xl font-bold">{totalSLA || "—"}</span>
          </div>
          <div className="glass flex flex-col gap-1 rounded-2xl p-4 shadow-card">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">No prazo</span>
            <span className={cn("text-2xl font-bold", onTimeRate != null && onTimeRate >= 80 ? "text-success" : "text-warning")}>
              {onTimeRate != null ? `${onTimeRate}%` : "—"}
            </span>
          </div>
          <div className="glass flex flex-col gap-1 rounded-2xl p-4 shadow-card">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Violados (abertos)</span>
            <span className={cn("text-2xl font-bold", breachedCount > 0 ? "text-destructive" : "text-success")}>
              {breachedCount}
            </span>
          </div>
        </div>

        {/* Filter + Alerts */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Filtrar alertas:</span>
            {(["all", "breached", "warning"] as AlertFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setAlertFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  alertFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted",
                )}
              >
                {f === "all" ? "Todos" : f === "breached" ? "Violados" : "Em risco"}
              </button>
            ))}
          </div>

          {alertsQuery.isLoading ? (
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando alertas...</div>
          ) : !hasAlerts ? (
            <div className="glass flex items-center gap-3 rounded-2xl p-4">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <p className="text-sm text-muted-foreground">
                {alertFilter === "all"
                  ? "Nenhum chamado com SLA em risco no momento."
                  : "Nenhum resultado para o filtro selecionado."}
              </p>
            </div>
          ) : (
            <>
              {visibleBreached.length > 0 && (
                <div className="glass rounded-2xl border border-destructive/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4" /> {visibleBreached.length} chamado(s) com SLA violado
                  </div>
                  <div className="space-y-1">
                    {visibleBreached.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg bg-destructive/5 px-3 py-1.5 text-xs">
                        <span className="font-mono text-muted-foreground">{t.code}</span>
                        <span className="flex-1 px-2 truncate">{t.title}</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", PRIORITY_COLOR[t.priority] || "bg-muted")}>{t.priority}</span>
                        <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium bg-destructive/15 text-destructive">Violado</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {visibleWarning.length > 0 && (
                <div className="glass rounded-2xl border border-warning/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-warning text-sm font-semibold">
                    <Clock className="h-4 w-4" /> {visibleWarning.length} chamado(s) prestes a violar SLA
                  </div>
                  <div className="space-y-1">
                    {visibleWarning.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg bg-warning/5 px-3 py-1.5 text-xs">
                        <span className="font-mono text-muted-foreground">{t.code}</span>
                        <span className="flex-1 px-2 truncate">{t.title}</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", PRIORITY_COLOR[t.priority] || "bg-muted")}>{t.priority}</span>
                        <CountdownBadge dueAt={t.sla_due_at} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Policies list */}
        <div className="glass rounded-2xl p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Políticas de SLA</p>
            <Button size="sm" className="gap-1.5" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Nova política
            </Button>
          </div>
          {policiesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (policiesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma política cadastrada. Os prazos padrão por prioridade serão usados.</p>
          ) : (
            <div className="space-y-2">
              {(policiesQuery.data ?? []).map((policy) => (
                <div key={policy.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/10 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", PRIORITY_COLOR[policy.priority] || "bg-muted text-muted-foreground")}>
                      {policy.priority || "Qualquer"}
                    </span>
                    <span className="text-sm font-medium">{policy.name}</span>
                    {policy.category && <span className="text-xs text-muted-foreground">· {policy.category}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-primary">{policy.response_time}</span>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(policy)}>Editar</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(policy.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Business Hours */}
      <div className="glass rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Horário de funcionamento</p>
          <span className="text-xs text-muted-foreground">Usado no cálculo de SLA</span>
        </div>
        {businessHoursQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (businessHoursQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum horário configurado. O SLA será calculado em horas corridas.</p>
        ) : (
          <div className="space-y-2">
            {(businessHoursQuery.data ?? []).map((bh) => {
              const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
              return (
                <div key={bh.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/10 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", bh.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                      {DAYS[bh.weekday]}
                    </span>
                    <span className="text-sm font-mono">{bh.start_time} – {bh.end_time}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={async () => {
                      await deleteBusinessHours(bh.id);
                      void queryClient.invalidateQueries({ queryKey: ["business-hours"] });
                      toast.success("Horário removido.");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Company Holidays */}
      <div className="glass rounded-2xl p-5 shadow-card space-y-4">
        <p className="text-sm font-semibold">Feriados / Dias bloqueados</p>
        {holidaysQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (holidaysQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum feriado cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {(holidaysQuery.data ?? []).map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/10 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted-foreground">{h.date}</span>
                  <span className="text-sm">{h.name}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={async () => {
                    await deleteCompanyHoliday(h.id);
                    void queryClient.invalidateQueries({ queryKey: ["company-holidays"] });
                    toast.success("Feriado removido.");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="date"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
          />
          <input
            className="h-8 flex-1 rounded-md border border-border bg-background px-3 text-xs"
            placeholder="Nome do feriado..."
            value={newHolidayName}
            onChange={(e) => setNewHolidayName(e.target.value)}
          />
          <Button
            size="sm"
            className="h-8"
            disabled={addingHoliday || !newHolidayDate || !newHolidayName.trim()}
            onClick={async () => {
              if (!newHolidayDate || !newHolidayName.trim()) return;
              setAddingHoliday(true);
              try {
                await createCompanyHoliday({ date: newHolidayDate, name: newHolidayName.trim(), active: true });
                setNewHolidayDate("");
                setNewHolidayName("");
                void queryClient.invalidateQueries({ queryKey: ["company-holidays"] });
                toast.success("Feriado cadastrado.");
              } catch {
                toast.error("Não foi possível cadastrar o feriado.");
              } finally {
                setAddingHoliday(false);
              }
            }}
          >
            {addingHoliday ? "..." : <><Plus className="h-3.5 w-3.5" /> Adicionar</>}
          </Button>
        </div>
      </div>

      <PolicyDialog
        open={policyOpen}
        onOpenChange={setPolicyOpen}
        editing={editing}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["sla-policies"] });
          setPolicyOpen(false);
        }}
      />
    </AppShell>
  );
}

function PolicyDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: SLAPolicy | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [priority, setPriority] = useState(editing?.priority ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [responseTime, setResponseTime] = useState(editing?.response_time ?? "8h");

  // Reset on open
  useState(() => {
    setName(editing?.name ?? "");
    setPriority(editing?.priority ?? "");
    setCategory(editing?.category ?? "");
    setResponseTime(editing?.response_time ?? "8h");
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = { name, priority, category, response_time: responseTime, active: true };
      return editing ? updateSLAPolicy(editing.id, data) : createSLAPolicy(data);
    },
    onSuccess: () => {
      toast.success(editing ? "Política atualizada." : "Política criada.");
      onSaved();
    },
    onError: () => toast.error("Erro ao salvar política."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar política de SLA" : "Nova política de SLA"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: SLA Crítico 2h" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Categoria (opcional)</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Infraestrutura" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Prazo de resposta</label>
            <Input value={responseTime} onChange={(e) => setResponseTime(e.target.value)} placeholder="Ex: 2h, 1d, 30m" />
            <p className="text-[11px] text-muted-foreground">Use h (horas), d (dias) ou m (minutos)</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" disabled={saveMutation.isPending || !name || !responseTime} onClick={() => saveMutation.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
