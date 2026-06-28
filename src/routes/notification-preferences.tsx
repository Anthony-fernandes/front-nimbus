import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { NotificationPreference } from "@/lib/types";
import {
  getNotificationPreference,
  updateNotificationPreference,
} from "@/services/notificationService";
import { parseApiError } from "@/services/utils";

export const Route = createFileRoute("/notification-preferences")({
  head: () => ({ meta: [{ title: "Preferências de notificação · NimbusDesk" }] }),
  component: NotificationPreferencesPage,
});

function NotificationPreferencesPage() {
  const [form, setForm] = useState<Partial<NotificationPreference>>({
    email_enabled: true,
    inbox_enabled: true,
    digest_frequency: "NONE",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => getNotificationPreference(),
  });

  useEffect(() => {
    if (data) {
      setForm({
        email_enabled: data.email_enabled,
        inbox_enabled: data.inbox_enabled,
        digest_frequency: data.digest_frequency ?? "NONE",
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => updateNotificationPreference(form),
    onSuccess: () => toast.success("Preferências salvas."),
    onError: (error: unknown) =>
      toast.error(parseApiError(error, "Não foi possível salvar as preferências.")),
  });

  return (
    <AppShell>
      <div className="max-w-xl space-y-5">
        <PageHeader
          title="Preferências de notificação"
          subtitle="Controle como e quando você recebe notificações."
          badges={
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Bell className="h-4 w-4" />
            </span>
          }
        />

        {isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Carregando preferências...
          </div>
        ) : (
          <div className="glass space-y-6 rounded-2xl p-6 shadow-card">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Canais de notificação</h3>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/10 px-4 py-3">
                <div>
                  <Label className="text-sm font-medium">Notificações por email</Label>
                  <p className="text-xs text-muted-foreground">
                    Receba atualizações importantes no seu email.
                  </p>
                </div>
                <Switch
                  checked={form.email_enabled ?? true}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, email_enabled: v }))}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/10 px-4 py-3">
                <div>
                  <Label className="text-sm font-medium">Caixa de entrada</Label>
                  <p className="text-xs text-muted-foreground">
                    Receba notificações na caixa de entrada da plataforma.
                  </p>
                </div>
                <Switch
                  checked={form.inbox_enabled ?? true}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, inbox_enabled: v }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Resumo por email</h3>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Frequência do resumo</Label>
                <Select
                  value={form.digest_frequency ?? "NONE"}
                  onValueChange={(v) => setForm((f) => ({ ...f, digest_frequency: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Desativado</SelectItem>
                    <SelectItem value="DAILY">Diário</SelectItem>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar preferências"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
