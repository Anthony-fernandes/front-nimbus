import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Flag,
  Pencil,
  Plus,
  Tags,
  TimerReset,
  Trash2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import {
  ActivityTagConfigForm,
  toActivityTagConfigFormData,
  type ActivityTagConfigFormData,
} from "@/components/forms/ActivityTagConfigForm";
import {
  TicketStatusConfigForm,
  toTicketStatusConfigFormData,
  type TicketStatusConfigFormData,
} from "@/components/forms/TicketStatusConfigForm";
import { Button } from "@/components/ui/button";
import { canManageTicketCategories, hasAnyPermission } from "@/lib/permissions";
import type { ActivityTag, TicketWorkflowStatusConfig, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  deleteActivityTag,
  listActivityTags,
  saveActivityTag,
} from "@/services/activityTagService";
import { getStoredUser } from "@/services/authService";
import {
  deleteTicketWorkflowStatus,
  listTicketWorkflowStatuses,
  saveTicketWorkflowStatus,
} from "@/services/ticketWorkflowService";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configuracoes - Nimbus" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const currentUser = getStoredUser<User>();
  const canViewSettings = hasAnyPermission(currentUser, [
    "settings.view",
    "settings.edit",
    "categories.view",
    "categories.manage",
  ]);
  const canManageWorkflow =
    hasAnyPermission(currentUser, ["settings.edit", "categories.manage", "categories.edit"])
    || canManageTicketCategories(currentUser);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingTag, setSavingTag] = useState(false);

  const { data: statusConfigs = [] } = useQuery({
    queryKey: ["ticket-workflow-status-configs"],
    queryFn: () => listTicketWorkflowStatuses(),
    enabled: canViewSettings,
  });
  const { data: activityTags = [] } = useQuery({
    queryKey: ["activity-tag-configs"],
    queryFn: () => listActivityTags(),
    enabled: canViewSettings,
  });

  const selectedStatus = useMemo(
    () => statusConfigs.find((status) => status.id === selectedId) || null,
    [selectedId, statusConfigs],
  );
  const selectedTag = useMemo(
    () => activityTags.find((tag) => tag.id === selectedTagId) || null,
    [activityTags, selectedTagId],
  );

  const customStatuses = statusConfigs.filter((status) => !status.system);
  const slaPauseStatuses = statusConfigs.filter((status) => status.pauses_sla);
  const finalStatuses = statusConfigs.filter((status) => status.is_final);
  const activeTags = activityTags.filter((tag) => tag.active);

  const handleSubmit = async (data: TicketStatusConfigFormData) => {
    if (!canManageWorkflow) {
      toast.error("Seu perfil nao pode alterar configuracoes de chamados.");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveTicketWorkflowStatus(
        {
          id: data.id,
          name: data.name,
          slug: data.slug,
          description: data.description,
          color: data.color,
          active: data.active,
          pauses_sla: data.pausesSla,
          is_final: data.isFinal,
          allows_resume: data.allowsResume,
          order: data.order,
          origin_statuses: data.originStatuses,
          next_statuses: data.nextStatuses,
          system: data.system,
        },
        selectedStatus ? "edit" : "create",
        selectedStatus?.id,
      );

      await queryClient.invalidateQueries({ queryKey: ["ticket-workflow-status-configs"] });
      setSelectedId(saved.id);
      toast.success(selectedStatus ? "Status atualizado." : "Status criado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o status.");
    } finally {
      setSaving(false);
    }
  };

  const handleTagSubmit = async (data: ActivityTagConfigFormData) => {
    if (!canManageWorkflow) {
      toast.error("Seu perfil nao pode alterar configuracoes.");
      return;
    }

    setSavingTag(true);
    try {
      const saved = await saveActivityTag(
        {
          id: data.id,
          name: data.name,
          color: data.color,
          description: data.description,
          active: data.active,
        },
        selectedTag ? "edit" : "create",
        selectedTag?.id,
      );

      await queryClient.invalidateQueries({ queryKey: ["activity-tag-configs"] });
      setSelectedTagId(saved.id);
      toast.success(selectedTag ? "Tag atualizada." : "Tag criada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a tag.");
    } finally {
      setSavingTag(false);
    }
  };

  const handleDelete = async (status: TicketWorkflowStatusConfig) => {
    if (!canManageWorkflow) {
      toast.error("Seu perfil nao pode remover status.");
      return;
    }

    if (status.system) {
      toast.error("Os status padrao do sistema nao podem ser removidos.");
      return;
    }

    try {
      await deleteTicketWorkflowStatus(status.id);
      await queryClient.invalidateQueries({ queryKey: ["ticket-workflow-status-configs"] });
      if (selectedId === status.id) {
        setSelectedId(null);
      }
      toast.success("Status removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel remover o status.");
    }
  };

  const handleTagDelete = async (tag: ActivityTag) => {
    if (!canManageWorkflow) {
      toast.error("Seu perfil nao pode remover tags.");
      return;
    }

    try {
      await deleteActivityTag(tag.id);
      await queryClient.invalidateQueries({ queryKey: ["activity-tag-configs"] });
      if (selectedTagId === tag.id) {
        setSelectedTagId(null);
      }
      toast.success("Tag removida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel remover a tag.");
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: "Configuracoes" }]}
          title="Configuracoes do sistema"
          subtitle="Controle o workflow dos chamados e mantenha as tags de atividades centralizadas."
          actions={
            canManageWorkflow ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                  onClick={() => setSelectedId(null)}
                >
                  <Plus className="h-4 w-4" />
                  Novo status
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setSelectedTagId(null)}
                >
                  <Plus className="h-4 w-4" />
                  Nova tag
                </Button>
              </div>
            ) : null
          }
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Workflow}
            label="Status totais"
            value={String(statusConfigs.length)}
            description="Padroes do sistema e customizados."
          />
          <SummaryCard
            icon={Flag}
            label="Customizados"
            value={String(customStatuses.length)}
            description="Criados para o fluxo da sua operacao."
          />
          <SummaryCard
            icon={TimerReset}
            label="Pausam SLA"
            value={String(slaPauseStatuses.length)}
            description="Status preparados para interromper a contagem."
          />
          <SummaryCard
            icon={Flag}
            label="Status finais"
            value={String(finalStatuses.length)}
            description="Encerram o chamado e travam novas acoes."
          />
          <SummaryCard
            icon={Tags}
            label="Tags ativas"
            value={String(activeTags.length)}
            description="Disponiveis para novas atividades."
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="glass overflow-hidden rounded-2xl shadow-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">Status de chamados</h2>
              <p className="text-xs text-muted-foreground">
                Os status padrao ficam protegidos contra exclusao e os customizados podem ampliar o workflow.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-2 py-2.5 text-left font-medium">Codigo</th>
                    <th className="px-2 py-2.5 text-left font-medium">SLA</th>
                    <th className="px-2 py-2.5 text-left font-medium">Retomar</th>
                    <th className="px-2 py-2.5 text-left font-medium">Final</th>
                    <th className="px-2 py-2.5 text-left font-medium">Ativo</th>
                    <th className="px-4 py-2.5 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {statusConfigs.map((status) => (
                    <tr
                      key={status.id}
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-muted/20",
                        selectedId === status.id && "bg-muted/30",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full border border-white/10"
                            style={{ backgroundColor: status.color || "#5ea8ff" }}
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{status.name}</span>
                              {status.system ? (
                                <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                  Padrao
                                </span>
                              ) : (
                                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                                  Custom
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {status.description || "Sem descricao cadastrada."}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(status.next_statuses || []).slice(0, 3).map((nextStatus) => (
                                <span
                                  key={`${status.id}-${nextStatus}`}
                                  className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  {nextStatus}
                                </span>
                              ))}
                              {(status.next_statuses || []).length > 3 ? (
                                <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                                  +{(status.next_statuses || []).length - 3}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 font-mono text-xs text-muted-foreground">{status.slug}</td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {status.pauses_sla ? "Pausa SLA" : "Segue contando"}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {status.allows_resume ? "Sim" : "Nao"}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {status.is_final ? "Sim" : "Nao"}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {status.active ? "Ativo" : "Inativo"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => setSelectedId(status.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {!status.system ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDelete(status)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remover
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass rounded-2xl p-5 shadow-card">
              <div className="mb-4">
                <h2 className="font-semibold">
                  {selectedStatus ? `Editar ${selectedStatus.name}` : "Novo status"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {canManageWorkflow
                    ? "Use este formulario para manter o fluxo centralizado e previsivel."
                    : "Seu perfil tem acesso apenas de leitura a essa configuracao."}
                </p>
              </div>

              <TicketStatusConfigForm
                key={selectedStatus?.id || "new-ticket-workflow-status"}
                initial={toTicketStatusConfigFormData(selectedStatus)}
                statusOptions={statusConfigs}
                saving={saving}
                submitLabel={selectedStatus ? "Salvar status" : "Criar status"}
                onSubmit={handleSubmit}
              />
            </div>

            <div className="glass rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-semibold">Boas praticas do fluxo</h3>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>Use status customizados para pausas reais como "Aguardando fornecedor".</p>
                <p>Marque "Permite retomar atendimento" quando o status interromper o trabalho tecnico.</p>
                <p>Status finais bloqueiam novas acoes de fluxo e mantem apenas consulta do chamado.</p>
                <p>Os status padrao seguem protegidos para evitar quebra do processo base do Nimbus.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="glass overflow-hidden rounded-2xl shadow-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">Tags de atividades</h2>
              <p className="text-xs text-muted-foreground">
                As tags sao pre-cadastradas aqui e apenas selecionadas na criacao ou edicao das atividades.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Tag</th>
                    <th className="px-2 py-2.5 text-left font-medium">Status</th>
                    <th className="px-2 py-2.5 text-left font-medium">Uso</th>
                    <th className="px-4 py-2.5 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {activityTags.map((tag) => (
                    <tr
                      key={tag.id}
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-muted/20",
                        selectedTagId === tag.id && "bg-muted/30",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full border border-white/10"
                            style={{ backgroundColor: tag.color || "#5ea8ff" }}
                          />
                          <div>
                            <div className="font-medium">{tag.name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {tag.description || "Sem descricao cadastrada."}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {tag.active ? "Ativa" : "Inativa"}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {tag.usage_count ?? 0} atividade(s)
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => setSelectedTagId(tag.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleTagDelete(tag)}
                            disabled={(tag.usage_count ?? 0) > 0}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remover
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass rounded-2xl p-5 shadow-card">
              <div className="mb-4">
                <h2 className="font-semibold">
                  {selectedTag ? `Editar ${selectedTag.name}` : "Nova tag"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Mantenha um catalogo limpo de tags para facilitar filtros, backlog e organizacao das atividades.
                </p>
              </div>

              <ActivityTagConfigForm
                key={selectedTag?.id || "new-activity-tag"}
                initial={toActivityTagConfigFormData(selectedTag)}
                saving={savingTag}
                submitLabel={selectedTag ? "Salvar tag" : "Criar tag"}
                onSubmit={handleTagSubmit}
              />
            </div>

            <div className="glass rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-semibold">Regras das tags</h3>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>Atividades novas selecionam apenas tags ativas cadastradas nesta tela.</p>
                <p>Tags inativas continuam aparecendo em atividades antigas para preservar o historico.</p>
                <p>Tags em uso nao podem ser removidas, evitando quebra nos vinculos ja existentes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof Workflow;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
