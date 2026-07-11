import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Copy, Mail, Plus, Trash2, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { useCan } from "@/components/app/Can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AutomationRule,
  type InboundMailbox,
  createAutomationRule,
  createMailbox,
  deleteAutomationRule,
  deleteMailbox,
  listAutomationRules,
  listMailboxes,
  toggleMailbox,
  updateAutomationRule,
} from "@/services/automationService";
import { API_BASE_URL } from "@/services/api";

export const Route = createFileRoute("/automations")({
  head: () => ({ meta: [{ title: "Automações · NimbusDesk" }] }),
  component: AutomationsPage,
});

const TRIGGER_LABELS: Record<string, string> = {
  on_create: "Ao criar chamado",
  on_update: "Ao atualizar chamado",
  on_status_change: "Ao mudar status",
  on_sla_breach: "Ao violar SLA",
};

const ACTION_LABELS: Record<string, string> = {
  set_priority: "Definir prioridade",
  set_status: "Definir status",
  set_category: "Definir categoria",
  assign_technician: "Atribuir técnico",
  assign_team: "Atribuir equipe",
  add_tag: "Adicionar tag(s)",
  send_notification: "Enviar notificação",
};

const PRIORITY_OPTIONS = ["Critica", "Alta", "Media", "Baixa"];
const STATUS_OPTIONS = [
  "Triagem",
  "Aguardando atendimento",
  "Em atendimento",
  "Aguardando cliente",
  "Validacao",
  "Pausado",
  "Cancelado",
  "Finalizado",
];

const ACTION_VALUE_HINTS: Record<string, string> = {
  set_category: "Nome da categoria",
  add_tag: "tags separadas por vírgula",
  assign_technician: "ID do técnico",
  assign_team: "ID da equipe",
  send_notification: "Mensagem da notificação (opcional)",
};

const CONDITION_FIELD_LABELS: Record<string, string> = {
  priority: "Prioridade",
  status: "Status",
  category: "Categoria",
  type: "Tipo",
  source: "Canal",
};

const CONDITION_OP_LABELS: Record<string, string> = {
  eq: "é igual a",
  neq: "é diferente de",
  in: "está em (lista)",
  contains: "contém",
};

type RuleForm = {
  name: string;
  trigger: string;
  conditions: { field: string; op: string; value: string }[];
  action: string;
  action_value: string;
  active: boolean;
  order: number;
};

const EMPTY_FORM: RuleForm = {
  name: "",
  trigger: "on_create",
  conditions: [],
  action: "set_priority",
  action_value: "",
  active: true,
  order: 0,
};

function AutomationsPage() {
  const qc = useQueryClient();
  const { can } = useCan();
  const canManage = can("settings.edit");
  const { data: rules = [], isLoading: loadingRules } = useQuery({ queryKey: ["automation-rules"], queryFn: listAutomationRules });
  const { data: mailboxes = [], isLoading: loadingMailboxes } = useQuery({ queryKey: ["mailboxes"], queryFn: listMailboxes });

  const [ruleDialog, setRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);

  const [mailboxDialog, setMailboxDialog] = useState(false);
  const [mailboxForm, setMailboxForm] = useState({ name: "", email_address: "" });

  function openNew() {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setRuleDialog(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      trigger: rule.trigger,
      conditions: rule.conditions || [],
      action: rule.action,
      action_value: rule.action_value || "",
      active: rule.active,
      order: (rule as { order?: number }).order ?? 0,
    });
    setRuleDialog(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, conditions: form.conditions } as Partial<AutomationRule>;
      if (editingRule) return updateAutomationRule(editingRule.id, payload);
      return createAutomationRule(payload);
    },
    onSuccess: () => {
      toast.success(editingRule ? "Regra atualizada." : "Regra criada.");
      setRuleDialog(false);
      qc.invalidateQueries({ queryKey: ["automation-rules"] });
    },
    onError: () => toast.error("Não foi possível salvar a regra."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAutomationRule(id),
    onSuccess: () => { toast.success("Regra removida."); qc.invalidateQueries({ queryKey: ["automation-rules"] }); },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateAutomationRule(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
  });

  const saveMailboxMutation = useMutation({
    mutationFn: () => createMailbox(mailboxForm),
    onSuccess: () => { toast.success("Caixa criada."); setMailboxDialog(false); setMailboxForm({ name: "", email_address: "" }); qc.invalidateQueries({ queryKey: ["mailboxes"] }); },
    onError: () => toast.error("Não foi possível criar a caixa de entrada."),
  });

  const toggleMailboxMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleMailbox(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mailboxes"] }),
  });

  const deleteMailboxMutation = useMutation({
    mutationFn: (id: string) => deleteMailbox(id),
    onSuccess: () => { toast.success("Caixa removida."); qc.invalidateQueries({ queryKey: ["mailboxes"] }); },
  });

  function addCondition() {
    setForm((f) => ({ ...f, conditions: [...f.conditions, { field: "priority", op: "eq", value: "" }] }));
  }

  function removeCondition(i: number) {
    setForm((f) => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  }

  function setCondition(i: number, key: string, val: string) {
    setForm((f) => ({
      ...f,
      conditions: f.conditions.map((c, idx) => idx === i ? { ...c, [key]: val } : c),
    }));
  }

  const webhookBase = API_BASE_URL.replace("/api", "");

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Automações</h1>
            <p className="text-sm text-muted-foreground">Regras IF/THEN para chamados e caixas de entrada de e-mail.</p>
          </div>
        </div>

        {/* ── Automation Rules ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Regras de Automação</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{rules.length}</span>
            </div>
            {canManage && (
              <Button size="sm" onClick={openNew} className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                <Plus className="h-3.5 w-3.5" /> Nova regra
              </Button>
            )}
          </div>

          {loadingRules ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : rules.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center shadow-card space-y-3">
              <Bot className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma regra de automação configurada.</p>
              {canManage && (
                <Button size="sm" onClick={openNew} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeira regra
                </Button>
              )}
            </div>
          ) : (
            <div className="glass rounded-2xl shadow-card overflow-hidden">
              {rules.map((rule, idx) => (
                <div key={rule.id} className={`flex items-center gap-4 px-5 py-4 ${idx > 0 ? "border-t border-border" : ""}`}>
                  <button
                    onClick={() => canManage && toggleRuleMutation.mutate({ id: rule.id, active: !rule.active })}
                    disabled={!canManage}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition disabled:cursor-default disabled:hover:text-muted-foreground"
                  >
                    {rule.active
                      ? <ToggleRight className="h-5 w-5 text-success" />
                      : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground/70">{TRIGGER_LABELS[rule.trigger] || rule.trigger}</span>
                      {rule.conditions.length > 0 && <> · {rule.conditions.length} condição{rule.conditions.length > 1 ? "ões" : ""}</>}
                      {" → "}
                      <span className="text-primary">{ACTION_LABELS[rule.action] || rule.action}</span>
                      {rule.action_value && <> "{rule.action_value}"</>}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(rule)}>
                        <Bot className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Inbound Mailboxes ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Caixas de Entrada</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{mailboxes.length}</span>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setMailboxDialog(true)} className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                <Plus className="h-3.5 w-3.5" /> Nova caixa
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            E-mails enviados para um endereço configurado criam chamados automaticamente via webhook POST.
          </p>

          {loadingMailboxes ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : mailboxes.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center shadow-card space-y-3">
              <Mail className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma caixa de entrada configurada.</p>
            </div>
          ) : (
            <div className="glass rounded-2xl shadow-card overflow-hidden">
              {mailboxes.map((mb, idx) => (
                <div key={mb.id} className={`flex items-start gap-4 px-5 py-4 ${idx > 0 ? "border-t border-border" : ""}`}>
                  <button
                    onClick={() => canManage && toggleMailboxMutation.mutate({ id: mb.id, active: !mb.active })}
                    disabled={!canManage}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition disabled:cursor-default disabled:hover:text-muted-foreground"
                  >
                    {mb.active ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-sm">{mb.name}</p>
                    <p className="text-xs text-muted-foreground">{mb.email_address}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <code className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground truncate max-w-xs">
                        {webhookBase}/api/tickets/inbound/{mb.webhook_token}/
                      </code>
                      <button
                        className="text-muted-foreground hover:text-foreground transition"
                        onClick={() => {
                          navigator.clipboard.writeText(`${webhookBase}/api/tickets/inbound/${mb.webhook_token}/`);
                          toast.success("URL copiada!");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteMailboxMutation.mutate(mb.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Rule Dialog */}
      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar regra" : "Nova regra de automação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome da regra</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex.: Escalar prioridade crítica" />
            </div>

            <div className="space-y-1">
              <Label>Gatilho</Label>
              <Select value={form.trigger} onValueChange={(v) => setForm((f) => ({ ...f, trigger: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Condições (todas devem ser verdadeiras)</Label>
                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addCondition}>+ Adicionar</Button>
              </div>
              {form.conditions.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem condições — a regra se aplica a todos os chamados.</p>
              )}
              {form.conditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={cond.field} onValueChange={(v) => setCondition(i, "field", v)}>
                    <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONDITION_FIELD_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={cond.op} onValueChange={(v) => setCondition(i, "op", v)}>
                    <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONDITION_OP_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 flex-1 text-xs"
                    value={cond.value}
                    onChange={(e) => setCondition(i, "value", e.target.value)}
                    placeholder="valor"
                  />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeCondition(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Ação</Label>
                <Select value={form.action} onValueChange={(v) => setForm((f) => ({ ...f, action: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor da ação</Label>
                {form.action === "set_priority" ? (
                  <Select value={form.action_value} onValueChange={(v) => setForm((f) => ({ ...f, action_value: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar prioridade..." /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : form.action === "set_status" ? (
                  <Select value={form.action_value} onValueChange={(v) => setForm((f) => ({ ...f, action_value: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar status..." /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.action_value}
                    onChange={(e) => setForm((f) => ({ ...f, action_value: e.target.value }))}
                    placeholder={ACTION_VALUE_HINTS[form.action] || "Valor"}
                  />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Ordem de execução</Label>
              <Input
                type="number"
                min={0}
                className="w-28"
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">
                Regras com ordem menor executam primeiro dentro do mesmo gatilho.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (form.conditions.some((c) => !c.value.trim())) {
                  toast.error("Preencha o valor de todas as condições ou remova as vazias.");
                  return;
                }
                if (form.action !== "send_notification" && !form.action_value.trim()) {
                  toast.error("Informe o valor da ação.");
                  return;
                }
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending || !form.name}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mailbox Dialog */}
      <Dialog open={mailboxDialog} onOpenChange={setMailboxDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova caixa de entrada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={mailboxForm.name} onChange={(e) => setMailboxForm((f) => ({ ...f, name: e.target.value }))} placeholder="Suporte geral" />
            </div>
            <div className="space-y-1">
              <Label>Endereço de e-mail</Label>
              <Input value={mailboxForm.email_address} onChange={(e) => setMailboxForm((f) => ({ ...f, email_address: e.target.value }))} placeholder="suporte@empresa.com" type="email" />
            </div>
            <p className="text-xs text-muted-foreground">Um token de webhook será gerado automaticamente. Configure seu provedor de e-mail para fazer POST nessa URL quando chegar um e-mail.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMailboxDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveMailboxMutation.mutate()} disabled={saveMailboxMutation.isPending || !mailboxForm.name || !mailboxForm.email_address}>
              {saveMailboxMutation.isPending ? "Criando..." : "Criar caixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
