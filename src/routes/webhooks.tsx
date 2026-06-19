import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FlaskConical, Pencil, Plus, Trash2, Webhook, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createWebhook,
  deleteWebhook,
  getAvailableEvents,
  getWebhookDeliveries,
  listWebhooks,
  retryWebhookDelivery,
  testWebhook,
  updateWebhook,
  type Webhook as WebhookType,
  type WebhookDelivery,
} from "@/services/webhookService";

export const Route = createFileRoute("/webhooks")({
  head: () => ({ meta: [{ title: "Webhooks · NimbusDesk" }] }),
  component: WebhooksPage,
});

function WebhooksPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookType | null>(null);
  const [deliveriesWebhook, setDeliveriesWebhook] = useState<WebhookType | null>(null);

  const webhooksQuery = useQuery({ queryKey: ["webhooks"], queryFn: listWebhooks });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: () => {
      toast.success("Webhook removido.");
      void queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
    onError: () => toast.error("Erro ao remover webhook."),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => testWebhook(id),
    onSuccess: () => toast.success("Entrega de teste enviada com sucesso."),
    onError: () => toast.error("Erro ao enviar teste."),
  });

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(webhook: WebhookType) {
    setEditing(webhook);
    setFormOpen(true);
  }

  function handleDelete(webhook: WebhookType) {
    if (confirm(`Remover webhook "${webhook.name}"?`)) {
      deleteMutation.mutate(webhook.id);
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl space-y-6">
        <PageHeader
          title="Webhooks"
          subtitle="Gerencie integrações via webhook para receber notificações de eventos."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Webhook className="h-4 w-4" />
            </span>
          }
        />

        <div className="glass rounded-2xl p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Webhooks configurados</p>
            <Button size="sm" className="gap-1.5" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Novo Webhook
            </Button>
          </div>

          {webhooksQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (webhooksQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum webhook cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último disparo</TableHead>
                  <TableHead>Último código</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(webhooksQuery.data ?? []).map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground font-mono">
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      {webhook.active ? (
                        <Badge variant="outline" className="text-success border-success/40 bg-success/10">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {webhook.last_triggered_at
                        ? new Date(webhook.last_triggered_at).toLocaleString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {webhook.last_status_code ? (
                        <span
                          className={
                            webhook.last_status_code >= 200 && webhook.last_status_code < 300
                              ? "text-success"
                              : "text-destructive"
                          }
                        >
                          {webhook.last_status_code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          title="Testar"
                          disabled={testMutation.isPending}
                          onClick={() => testMutation.mutate(webhook.id)}
                        >
                          <FlaskConical className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          title="Entregas"
                          onClick={() => setDeliveriesWebhook(webhook)}
                        >
                          Entregas
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          title="Editar"
                          onClick={() => openEdit(webhook)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          title="Remover"
                          onClick={() => handleDelete(webhook)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <WebhookFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["webhooks"] });
          setFormOpen(false);
        }}
      />

      <DeliveriesDialog
        webhook={deliveriesWebhook}
        onOpenChange={(open) => { if (!open) setDeliveriesWebhook(null); }}
      />
    </AppShell>
  );
}

function WebhookFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: WebhookType | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [active, setActive] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const eventsQuery = useQuery({ queryKey: ["webhook-events"], queryFn: getAvailableEvents });

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setUrl(editing?.url ?? "");
      setSecret("");
      setActive(editing?.active ?? true);
      setSelectedEvents(editing?.events ?? []);
    }
  }, [open, editing]);

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { name, url, active, events: selectedEvents };
      if (secret) payload.secret = secret;
      return editing
        ? updateWebhook(editing.id, payload as Parameters<typeof updateWebhook>[1])
        : createWebhook(payload as Parameters<typeof createWebhook>[0]);
    },
    onSuccess: () => {
      toast.success(editing ? "Webhook atualizado." : "Webhook criado.");
      onSaved();
    },
    onError: () => toast.error("Erro ao salvar webhook."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Webhook" : "Novo Webhook"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Notificações Slack"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Secret</label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Deixe vazio para não assinar"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="webhook-active" checked={active} onCheckedChange={setActive} />
            <label htmlFor="webhook-active" className="text-sm cursor-pointer">
              Webhook ativo
            </label>
          </div>
          <Separator />
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Eventos</label>
            {eventsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Carregando eventos...</p>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {(eventsQuery.data ?? []).map((ev) => (
                  <div key={ev.event} className="flex items-center gap-2">
                    <Checkbox
                      id={`event-${ev.event}`}
                      checked={selectedEvents.includes(ev.event)}
                      onCheckedChange={() => toggleEvent(ev.event)}
                    />
                    <label htmlFor={`event-${ev.event}`} className="text-sm cursor-pointer">
                      {ev.label}
                      <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                        {ev.event}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={saveMutation.isPending || !name || !url || selectedEvents.length === 0}
            onClick={() => saveMutation.mutate()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliveriesDialog({
  webhook,
  onOpenChange,
}: {
  webhook: WebhookType | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const deliveriesQuery = useQuery({
    queryKey: ["webhook-deliveries", webhook?.id],
    queryFn: () => getWebhookDeliveries(webhook!.id),
    enabled: !!webhook,
  });
  const retryMutation = useMutation({
    mutationFn: (deliveryId: string) => retryWebhookDelivery(webhook!.id, deliveryId),
    onSuccess: () => {
      toast.success("Reenvio iniciado.");
      void queryClient.invalidateQueries({ queryKey: ["webhook-deliveries", webhook?.id] });
    },
    onError: () => toast.error("Não foi possível reenviar."),
  });

  return (
    <Dialog open={!!webhook} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Entregas — {webhook?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {deliveriesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (deliveriesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma entrega registrada.</p>
          ) : (
            (deliveriesQuery.data ?? []).slice(0, 20).map((delivery: WebhookDelivery) => (
              <div
                key={delivery.id}
                className="flex items-start justify-between rounded-xl border border-border bg-muted/10 px-4 py-2.5 gap-3"
              >
                <div className="flex items-center gap-2 shrink-0">
                  {delivery.success ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span
                    className={`text-xs font-mono font-semibold ${
                      delivery.success ? "text-success" : "text-destructive"
                    }`}
                  >
                    {delivery.status_code ?? "ERR"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-muted-foreground truncate">{delivery.event}</p>
                  {delivery.error && (
                    <p className="text-[11px] text-destructive mt-0.5 truncate">{delivery.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(delivery.created_at).toLocaleString("pt-BR")}
                  </span>
                  {!delivery.success && (
                    <button
                      type="button"
                      title="Reenviar"
                      onClick={() => retryMutation.mutate(delivery.id)}
                      disabled={retryMutation.isPending}
                      className="rounded px-1.5 py-0.5 text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Reenviar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
