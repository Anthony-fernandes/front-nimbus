import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Mail, Pencil, Send } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getStoredUser } from "@/services/authService";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  getAvailableEvents,
  listEmailTemplates,
  updateEmailTemplate,
  type AvailableEvent,
  type EmailTemplate,
} from "@/services/emailTemplateService";
import { api } from "@/services/api";

export const Route = createFileRoute("/email-templates")({
  head: () => ({ meta: [{ title: "Templates de E-mail · Stratos Suite" }] }),
  component: EmailTemplatesPage,
});

const TEMPLATE_VARIABLES = [
  { key: "{{ticket_title}}", label: "Título do chamado" },
  { key: "{{user_name}}", label: "Nome do usuário" },
  { key: "{{ticket_code}}", label: "Código do chamado" },
  { key: "{{ticket_priority}}", label: "Prioridade" },
  { key: "{{ticket_url}}", label: "URL do chamado" },
  { key: "{{new_status}}", label: "Novo status" },
  { key: "{{activity_title}}", label: "Título da atividade" },
  { key: "{{company_name}}", label: "Nome da empresa" },
];

function EmailTemplatesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AvailableEvent | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const storedUser = getStoredUser();

  const { data: availableEvents = [] } = useQuery({
    queryKey: ["email-templates-events"],
    queryFn: getAvailableEvents,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates"],
    queryFn: listEmailTemplates,
  });

  const existingTemplate: EmailTemplate | null =
    selectedEvent
      ? (templates.find((t) => t.event === selectedEvent.event) ?? null)
      : null;

  useEffect(() => {
    if (!selectedEvent) return;
    if (existingTemplate) {
      setSubject(existingTemplate.subject);
      setBody(existingTemplate.body);
      setActive(existingTemplate.active);
    } else {
      setSubject(selectedEvent.default_subject);
      setBody(selectedEvent.default_body);
      setActive(true);
    }
    setShowPreview(false);
  }, [selectedEvent, existingTemplate]);

  useEffect(() => {
    if (storedUser) {
      setTestEmail((storedUser as any).email ?? "");
    }
  }, []);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["email-templates"] });
  }

  function openEditor(ev: AvailableEvent) {
    setSelectedEvent(ev);
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (existingTemplate) {
        return updateEmailTemplate(existingTemplate.id, { subject, body, active });
      }
      return createEmailTemplate({ event: selectedEvent!.event, subject, body, active });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Template salvo com sucesso.");
    },
    onError: () => {
      toast.error("Erro ao salvar template.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEmailTemplate(existingTemplate!.id),
    onSuccess: () => {
      invalidate();
      if (selectedEvent) {
        setSubject(selectedEvent.default_subject);
        setBody(selectedEvent.default_body);
        setActive(true);
      }
      toast.success("Template restaurado para o padrão.");
    },
    onError: () => {
      toast.error("Erro ao restaurar template.");
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!existingTemplate) throw new Error("Salve o template antes de testar.");
      await api.post(`/email-templates/${existingTemplate.id}/test/`, {
        email: testEmail || (storedUser as any)?.email,
      });
    },
    onSuccess: () => {
      toast.success(`E-mail de teste enviado para ${testEmail}.`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Erro ao enviar e-mail de teste.");
    },
  });

  function insertVariable(variable: string) {
    const textarea = bodyRef.current;
    if (!textarea) {
      setBody((prev) => prev + variable);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.slice(0, start) + variable + body.slice(end);
    setBody(newBody);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Templates de E-mail"
          subtitle="Personalize os e-mails enviados pela plataforma para cada empresa."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Mail className="h-4 w-4" />
            </span>
          }
        />

        <div className="glass overflow-hidden rounded-2xl shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Eventos de e-mail</h2>
            <p className="text-xs text-muted-foreground">
              {availableEvents.length} eventos disponíveis · clique em Editar para personalizar o template.
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Nenhum evento disponível.
                  </TableCell>
                </TableRow>
              ) : (
                availableEvents.map((ev) => {
                  const custom = templates.find((t) => t.event === ev.event);
                  return (
                    <TableRow key={ev.event}>
                      <TableCell>
                        <div className="font-medium">{ev.label}</div>
                        <div className="text-xs text-muted-foreground">{ev.event}</div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                            custom
                              ? "bg-green-500/15 text-green-600"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {custom ? "Personalizado" : "Padrão"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => openEditor(ev)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedEvent(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.label ?? "Template de e-mail"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? (
                  <><EyeOff className="h-3.5 w-3.5" /> Editor</>
                ) : (
                  <><Eye className="h-3.5 w-3.5" /> Pré-visualizar</>
                )}
              </Button>
            </div>

            {showPreview ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm">
                  <span className="font-medium text-muted-foreground">Assunto: </span>
                  {subject || <span className="italic text-muted-foreground">(sem assunto)</span>}
                </div>
                <div
                  className="min-h-48 rounded-xl border border-border bg-white p-4 text-sm text-gray-800"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: body || "<p><em>(corpo vazio)</em></p>" }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Assunto
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/60"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Corpo (HTML)
                  </label>
                  <textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-sm outline-none focus:border-primary/60"
                  />
                </div>

                <div className="rounded-xl border border-border">
                  <p className="px-4 py-2.5 text-sm font-medium">Variáveis disponíveis</p>
                  <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        title={v.label}
                        onClick={() => insertVariable(v.key)}
                        className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch checked={active} onCheckedChange={setActive} id="template-active" />
                  <label htmlFor="template-active" className="text-sm">Template ativo</label>
                </div>
              </div>
            )}

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                  size="sm"
                >
                  Salvar
                </Button>
                {existingTemplate ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    Restaurar padrão
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
                  Fechar
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="E-mail para teste"
                  className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm outline-none focus:border-primary/60"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 whitespace-nowrap"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending || !existingTemplate}
                  title={!existingTemplate ? "Salve o template primeiro" : ""}
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar teste
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
