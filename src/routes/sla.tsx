import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, Plus, ShieldCheck, Trash2 } from "lucide-react";
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
  listSLAPolicies,
  updateSLAPolicy,
  type SLAPolicy,
} from "@/services/reportService";

export const Route = createFileRoute("/sla")({
  head: () => ({ meta: [{ title: "SLA · Stratos Suite" }] }),
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

function SLAPage() {
  const queryClient = useQueryClient();
  const [policyOpen, setPolicyOpen] = useState(false);
  const [editing, setEditing] = useState<SLAPolicy | null>(null);

  const alertsQuery = useQuery({ queryKey: ["sla-alerts"], queryFn: getSLAAlerts, refetchInterval: 120000 });
  const policiesQuery = useQuery({ queryKey: ["sla-policies"], queryFn: listSLAPolicies });

  const breached = alertsQuery.data?.breached ?? [];
  const warning = alertsQuery.data?.warning ?? [];

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

        {/* Alerts */}
        {(breached.length > 0 || warning.length > 0) && (
          <div className="space-y-3">
            {breached.length > 0 && (
              <div className="glass rounded-2xl border border-destructive/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4" /> {breached.length} chamado(s) com SLA violado
                </div>
                <div className="space-y-1">
                  {breached.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-destructive/5 px-3 py-1.5 text-xs">
                      <span className="font-mono text-muted-foreground">{t.code}</span>
                      <span className="flex-1 px-2 truncate">{t.title}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", PRIORITY_COLOR[t.priority] || "bg-muted")}>{t.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {warning.length > 0 && (
              <div className="glass rounded-2xl border border-warning/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-warning text-sm font-semibold">
                  <Clock className="h-4 w-4" /> {warning.length} chamado(s) prestes a violar SLA
                </div>
                <div className="space-y-1">
                  {warning.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-warning/5 px-3 py-1.5 text-xs">
                      <span className="font-mono text-muted-foreground">{t.code}</span>
                      <span className="flex-1 px-2 truncate">{t.title}</span>
                      <span className="text-muted-foreground">{new Date(t.sla_due_at).toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
