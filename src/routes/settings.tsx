import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Blocks,
  Briefcase,
  Building2,
  ExternalLink,
  Flag,
  Pencil,
  Plus,
  Tags,
  TimerReset,
  Trash2,
  SlidersHorizontal,
  Users,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listDepartments } from "@/services/orgService";
import { listPositions } from "@/services/orgService";
import { listPermissionBlocks } from "@/services/permissionBlockService";
import { canManageTicketCategories, hasAnyPermission } from "@/lib/permissions";
import type { ActivityTag, TicketWorkflowStatusConfig, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  deleteActivityTag,
  listActivityTags,
  saveActivityTag,
} from "@/services/activityTagService";
import { getStoredUser } from "@/services/authService";
import { getMyCompany, updateCompany, type Company } from "@/services/companyService";

import {
  deleteTicketWorkflowStatus,
  listTicketWorkflowStatuses,
  saveTicketWorkflowStatus,
} from "@/services/ticketWorkflowService";
import {
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  type TicketCustomField,
} from "@/services/customFieldService";
import { parseApiError } from "@/services/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configurações - NimbusDesk" }] }),
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
  const [activeTab, setActiveTab] = useState<"workflow" | "empresa" | "campos" | "departamentos" | "cargos" | "permissoes">("workflow");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingTag, setSavingTag] = useState(false);

  const companyQuery = useQuery({
    queryKey: ["my-company"],
    queryFn: getMyCompany,
    enabled: activeTab === "empresa",
  });
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({});
  const companyData = companyQuery.data;
  const companyMutation = useMutation({
    mutationFn: (data: Partial<Omit<Company, "id" | "is_active">>) =>
      updateCompany(companyData!.id, data),
    onSuccess: () => {
      toast.success("Configurações da empresa atualizadas.");
      void queryClient.invalidateQueries({ queryKey: ["my-company"] });
      setCompanyForm({});
    },
    onError: () => toast.error("Não foi possível salvar."),
  });

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

  const { data: customFields = [], refetch: refetchCustomFields } = useQuery({
    queryKey: ["ticket-custom-fields"],
    queryFn: () => listCustomFields(),
    enabled: canViewSettings,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
    enabled: activeTab === "departamentos",
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: listPositions,
    enabled: activeTab === "cargos",
  });

  const { data: permissionBlocks = [] } = useQuery({
    queryKey: ["permission-blocks"],
    queryFn: () => listPermissionBlocks(),
    enabled: activeTab === "permissoes",
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
      toast.error("Seu perfil nao pode alterar configurações de chamados.");
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
      toast.error(parseApiError(error, "Não foi possível salvar o status."));
    } finally {
      setSaving(false);
    }
  };

  const handleTagSubmit = async (data: ActivityTagConfigFormData) => {
    if (!canManageWorkflow) {
      toast.error("Seu perfil nao pode alterar configurações.");
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
      toast.error(parseApiError(error, "Não foi possível salvar a tag."));
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
      toast.error("Os status padrão do sistema nao podem ser removidos.");
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
      toast.error(parseApiError(error, "Não foi possível remover o status."));
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
      toast.error(parseApiError(error, "Não foi possível remover a tag."));
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[{ label: "Workspace", to: "/" }, { label: "Configurações" }]}
          title="Configurações do sistema"
          subtitle="Controle o workflow dos chamados, tags de atividades e dados da empresa."
          actions={
            activeTab === "workflow" && canManageWorkflow ? (
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

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
          {(["workflow", "empresa", "campos"] as const).map((tab) => {
            const labels = {
              workflow: "Workflow",
              empresa: "Empresa",
              campos: "Campos",
            };
            const icons = {
              workflow: <Workflow className="h-3.5 w-3.5" />,
              empresa: <Building2 className="h-3.5 w-3.5" />,
              campos: <SlidersHorizontal className="h-3.5 w-3.5" />,
            };
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {icons[tab]}
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {activeTab === "empresa" ? (
          <div className="glass rounded-2xl shadow-card p-6 max-w-xl space-y-5">
            <div>
              <h2 className="font-semibold">Perfil da empresa</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Informações básicas visíveis em contratos e relatórios.</p>
            </div>
            {companyQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : companyData ? (
              <div className="space-y-4">
                {(
                  [
                    { key: "name", label: "Nome da empresa", type: "text" },
                    { key: "document", label: "CNPJ / Documento", type: "text" },
                    { key: "email", label: "E-mail de contato", type: "email" },
                    { key: "phone", label: "Telefone", type: "tel" },
                    { key: "email_domain", label: "Domínio de e-mail (ex: empresa.com)", type: "text" },
                  ] as const
                ).map(({ key, label, type }) => (
                  <div key={key} className="space-y-1">
                    <Label>{label}</Label>
                    <Input
                      type={type}
                      value={companyForm[key] ?? companyData[key] ?? ""}
                      onChange={(e) => setCompanyForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                {/* Localização e identidade visual */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Fuso horário</Label>
                    <select
                      value={(companyForm.timezone ?? companyData.timezone ?? "America/Sao_Paulo") as string}
                      onChange={(e) => setCompanyForm((prev) => ({ ...prev, timezone: e.target.value }))}
                      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                    >
                      {["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Recife", "America/Cuiaba", "UTC"].map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground">Usado no cálculo de SLA e horário de funcionamento.</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Moeda</Label>
                    <select
                      value={(companyForm.currency ?? companyData.currency ?? "BRL") as string}
                      onChange={(e) => setCompanyForm((prev) => ({ ...prev, currency: e.target.value }))}
                      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                    >
                      {["BRL", "USD", "EUR"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Cor primária</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(companyForm.primary_color ?? companyData.primary_color ?? "#6366f1") as string}
                      onChange={(e) => setCompanyForm((prev) => ({ ...prev, primary_color: e.target.value }))}
                      className="h-9 w-14 cursor-pointer rounded-md border border-border bg-background"
                    />
                    <span className="text-xs text-muted-foreground">
                      {(companyForm.primary_color ?? companyData.primary_color ?? "#6366f1") as string}
                    </span>
                  </div>
                </div>

                {/* Modo de uso */}
                <div className="space-y-1">
                  <Label>Modo de uso</Label>
                  <p className="text-xs text-muted-foreground">Define como o sistema opera para sua empresa.</p>
                  <div className="grid gap-2 pt-1">
                    {([
                      { value: "prestador", label: "Prestação de serviço (B2B)", desc: "Sua empresa atende outras empresas clientes. Chamados e projetos sempre vinculados a um cliente." },
                      { value: "interno", label: "Uso interno", desc: "Sua empresa usa o sistema internamente por departamentos. Sem clientes externos." },
                      { value: "hibrido", label: "Híbrido", desc: "Usa internamente por departamentos E também atende clientes externos ao mesmo tempo." },
                    ] as const).map(({ value, label, desc }) => {
                      const current = (companyForm.usage_type ?? companyData.usage_type ?? "prestador") as string;
                      const selected = current === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setCompanyForm((prev) => ({ ...prev, usage_type: value }))}
                          className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                            selected
                              ? "border-primary bg-primary/8 shadow-sm"
                              : "border-border bg-muted/10 hover:border-primary/40"
                          }`}
                        >
                          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-primary" : "border-muted-foreground/40"}`}>
                            {selected && <span className="h-2 w-2 rounded-full bg-primary block" />}
                          </span>
                          <span>
                            <span className="block text-sm font-medium">{label}</span>
                            <span className="block text-xs text-muted-foreground">{desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <input
                    id="auto_assign"
                    type="checkbox"
                    checked={companyForm.auto_assign ?? companyData.auto_assign}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, auto_assign: e.target.checked }))}
                    className="h-4 w-4 rounded border border-border"
                  />
                  <label htmlFor="auto_assign" className="text-sm cursor-pointer">
                    <span className="font-medium">Atribuição automática</span>
                    <span className="block text-xs text-muted-foreground">Novos chamados são distribuídos automaticamente entre técnicos.</span>
                  </label>
                </div>
                <Button
                  onClick={() => {
                    if (Object.keys(companyForm).length === 0) return;
                    companyMutation.mutate(companyForm);
                  }}
                  disabled={companyMutation.isPending || Object.keys(companyForm).length === 0}
                  className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                >
                  {companyMutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
            )}
          </div>
        ) : null}

        {activeTab === "workflow" ? <>
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
            description="Encerram o chamado e travam novas ações."
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
                Os status padrão ficam protegidos contra exclusao e os customizados podem ampliar o workflow.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-2 py-2.5 text-left font-medium">Código</th>
                    <th className="px-2 py-2.5 text-left font-medium">SLA</th>
                    <th className="px-2 py-2.5 text-left font-medium">Retomar</th>
                    <th className="px-2 py-2.5 text-left font-medium">Final</th>
                    <th className="px-2 py-2.5 text-left font-medium">Ativo</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
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
                                  Padrão
                                </span>
                              ) : (
                                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                                  Custom
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {status.description || "Sem descrição cadastrada."}
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
                    : "Seu perfil tem acesso apenas de leitura a essa configuração."}
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
                <p>Status finais bloqueiam novas ações de fluxo e mantem apenas consulta do chamado.</p>
                <p>Os status padrão seguem protegidos para evitar quebra do processo base do NimbusDesk.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="glass overflow-hidden rounded-2xl shadow-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">Tags de atividades</h2>
              <p className="text-xs text-muted-foreground">
                As tags sao pre-cadastradas aqui e apenas selecionadas na criação ou edição das atividades.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Tag</th>
                    <th className="px-2 py-2.5 text-left font-medium">Status</th>
                    <th className="px-2 py-2.5 text-left font-medium">Uso</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
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
                              {tag.description || "Sem descrição cadastrada."}
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
                  Mantenha um catalogo limpo de tags para facilitar filtros, backlog e organização das atividades.
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
                <p>Tags inativas continuam aparecendo em atividades antigas para preservar o histórico.</p>
                <p>Tags em uso nao podem ser removidas, evitando quebra nos vinculos ja existentes.</p>
              </div>
            </div>
          </div>
        </div>

        </> : null}

        {activeTab === "campos" ? (
          <CustomFieldsTab
            customFields={customFields}
            canManage={canManageWorkflow}
            onRefresh={() => void refetchCustomFields()}
          />
        ) : null}

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

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  select: "Seleção",
  boolean: "Sim/Não",
};

function CustomFieldsTab({
  customFields,
  canManage,
  onRefresh,
}: {
  customFields: TicketCustomField[];
  canManage: boolean;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const emptyForm = { name: "", label: "", field_type: "text" as TicketCustomField["field_type"], required: false, is_active: true };
  const [form, setForm] = useState(emptyForm);

  const handleCreate = async () => {
    if (!form.label.trim() || !form.name.trim()) {
      toast.error("Preencha o nome e o rótulo do campo.");
      return;
    }
    setSaving(true);
    try {
      await createCustomField(form);
      toast.success("Campo criado.");
      setForm(emptyForm);
      setShowForm(false);
      onRefresh();
    } catch {
      toast.error("Não foi possível criar o campo.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      await updateCustomField(id, form);
      toast.success("Campo atualizado.");
      setEditingId(null);
      onRefresh();
    } catch {
      toast.error("Não foi possível atualizar o campo.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (field: TicketCustomField) => {
    try {
      await updateCustomField(field.id, { is_active: !field.is_active });
      onRefresh();
    } catch {
      toast.error("Não foi possível atualizar o campo.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCustomField(id);
      toast.success("Campo removido.");
      setConfirmDeleteId(null);
      onRefresh();
    } catch {
      toast.error("Não foi possível remover o campo.");
    }
  };

  const startEdit = (field: TicketCustomField) => {
    setEditingId(field.id);
    setShowForm(false);
    setForm({ name: field.name, label: field.label, field_type: field.field_type, required: field.required, is_active: field.is_active });
  };

  return (
    <div className="space-y-5">
      <div className="glass overflow-hidden rounded-2xl shadow-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="font-semibold">Campos personalizados</h2>
            <p className="text-xs text-muted-foreground">
              Campos extras que aparecem nos chamados desta empresa.
            </p>
          </div>
          {canManage && (
            <Button
              type="button"
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              onClick={() => { setShowForm((v) => !v); setEditingId(null); setForm(emptyForm); }}
            >
              <Plus className="h-4 w-4" />
              Novo campo
            </Button>
          )}
        </div>

        {showForm && (
          <div className="border-b border-border bg-muted/10 px-4 py-4">
            <h3 className="mb-3 text-sm font-semibold">Novo campo</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Rótulo (exibido)</Label>
                <Input
                  placeholder="Ex: Número do contrato"
                  value={form.label}
                  onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Nome interno (slug)</Label>
                <Input
                  placeholder="Ex: numero_contrato"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <select
                  value={form.field_type}
                  onChange={(e) => setForm((p) => ({ ...p, field_type: e.target.value as TicketCustomField["field_type"] }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                >
                  {Object.entries(FIELD_TYPE_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 h-9">
                  <input
                    id="new-required"
                    type="checkbox"
                    checked={form.required}
                    onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))}
                    className="h-4 w-4 rounded border border-border"
                  />
                  <label htmlFor="new-required" className="text-sm cursor-pointer">Obrigatório</label>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? "Criando..." : "Criar campo"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowForm(false); setForm(emptyForm); }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Rótulo</th>
                <th className="px-2 py-2.5 text-left font-medium">Nome</th>
                <th className="px-2 py-2.5 text-left font-medium">Tipo</th>
                <th className="px-2 py-2.5 text-left font-medium">Obrigatório</th>
                <th className="px-2 py-2.5 text-left font-medium">Ativo</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {customFields.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum campo personalizado cadastrado.
                  </td>
                </tr>
              ) : customFields.map((field) => (
                <tr key={field.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  {editingId === field.id ? (
                    <td colSpan={6} className="px-4 py-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
                        <div className="space-y-1">
                          <Label>Rótulo (exibido)</Label>
                          <Input
                            value={form.label}
                            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Nome interno (slug)</Label>
                          <Input
                            value={form.name}
                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Tipo</Label>
                          <select
                            value={form.field_type}
                            onChange={(e) => setForm((p) => ({ ...p, field_type: e.target.value as TicketCustomField["field_type"] }))}
                            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                          >
                            {Object.entries(FIELD_TYPE_LABELS).map(([val, lbl]) => (
                              <option key={val} value={val}>{lbl}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end gap-3">
                          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 h-9">
                            <input
                              id={`edit-required-${field.id}`}
                              type="checkbox"
                              checked={form.required}
                              onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))}
                              className="h-4 w-4 rounded border border-border"
                            />
                            <label htmlFor={`edit-required-${field.id}`} className="text-sm cursor-pointer">Obrigatório</label>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                          onClick={() => handleUpdate(field.id)}
                          disabled={saving}
                        >
                          {saving ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium">{field.label}</td>
                      <td className="px-2 py-3 font-mono text-xs text-muted-foreground">{field.name}</td>
                      <td className="px-2 py-3">
                        <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        {field.required ? (
                          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                            Sim
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(field)}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors",
                            field.is_active
                              ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
                          )}
                        >
                          {field.is_active ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canManage && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => startEdit(field)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                              {confirmDeleteId === field.id ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => handleDelete(field.id)}
                                  >
                                    Confirmar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setConfirmDeleteId(field.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remover
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
