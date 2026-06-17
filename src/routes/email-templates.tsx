import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Mail } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  getAvailableEvents,
  listEmailTemplates,
  updateEmailTemplate,
  type AvailableEvent,
  type EmailTemplate,
} from "@/services/emailTemplateService";

export const Route = createFileRoute("/email-templates")({
  head: () => ({ meta: [{ title: "Templates de E-mail · Stratos Suite" }] }),
  component: EmailTemplatesPage,
});

const TEMPLATE_VARIABLES = [
  "{{ticket_title}}",
  "{{user_name}}",
  "{{ticket_code}}",
  "{{ticket_priority}}",
  "{{ticket_url}}",
  "{{new_status}}",
  "{{activity_title}}",
];

function EmailTemplatesPage() {
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<AvailableEvent | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [varsOpen, setVarsOpen] = useState(false);

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
  }, [selectedEvent, existingTemplate]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["email-templates"] });
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

  return (
    <AppShell>
      <div className="max-w-6xl space-y-5">
        <PageHeader
          title="Templates de E-mail"
          subtitle="Personalize os e-mails enviados pela plataforma para cada empresa."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Mail className="h-4 w-4" />
            </span>
          }
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left: event list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Eventos
            </p>
            {availableEvents.map((ev) => {
              const custom = templates.find((t) => t.event === ev.event);
              const isSelected = selectedEvent?.event === ev.event;
              return (
                <button
                  key={ev.event}
                  type="button"
                  onClick={() => setSelectedEvent(ev)}
                  className={cn(
                    "glass w-full rounded-xl px-4 py-3 text-left transition-colors",
                    isSelected
                      ? "border border-primary/50 bg-primary/10"
                      : "hover:bg-muted/30",
                  )}
                >
                  <p className="text-sm font-medium">{ev.label}</p>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                      custom
                        ? "bg-green-500/15 text-green-400"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {custom ? "Personalizado" : "Padrão"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: editor */}
          {selectedEvent ? (
            <div className="glass rounded-2xl p-5 shadow-card lg:col-span-2">
              <h2 className="mb-4 text-base font-semibold">{selectedEvent.label}</h2>

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
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-sm outline-none focus:border-primary/60"
                    style={{ minHeight: 200 }}
                  />
                </div>

                {/* Variables collapsible */}
                <div className="rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setVarsOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium"
                  >
                    Variáveis disponíveis
                    {varsOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {varsOpen ? (
                    <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                      {TEMPLATE_VARIABLES.map((v) => (
                        <code
                          key={v}
                          className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {v}
                        </code>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-3">
                  <Switch
                    checked={active}
                    onCheckedChange={setActive}
                    id="template-active"
                  />
                  <label htmlFor="template-active" className="text-sm">
                    Template ativo
                  </label>
                </div>

                {/* Actions */}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedEvent(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass flex items-center justify-center rounded-2xl p-10 text-center text-sm text-muted-foreground lg:col-span-2">
              Selecione um evento para editar o template.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
