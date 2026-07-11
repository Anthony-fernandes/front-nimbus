import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ClipboardList, FileText, Paperclip, Save, Send, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { Field, FormSection } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getUserClientId, getUserDisplayName } from "@/lib/auth";
import type { User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { api } from "@/services/api";
import { createClientTicketRequest, uploadTicketAttachment, type PortalFormConfig } from "@/services/ticketService";
import { parseApiError } from "@/services/utils";

type PortalCategory = {
  id: string;
  name: string;
  description?: string;
  subcategories?: string[];
  default_type?: string;
  approval_required?: boolean;
  sla?: string;
};

type PortalDepartment = { id: string; name: string; manager_name?: string };

type PortalFormPayload = {
  fields: PortalFormConfig;
  categories: PortalCategory[];
  departments: PortalDepartment[];
};

const URGENCY_OPTIONS = [
  { value: "Baixa", label: "Baixa — pode aguardar" },
  { value: "Media", label: "Média — preciso de ajuda em breve" },
  { value: "Alta", label: "Alta — está impedindo meu trabalho" },
] as const;

const IMPACT_OPTIONS = [
  { value: "Baixo", label: "Apenas eu" },
  { value: "Medio", label: "Minha equipe / meu setor" },
  { value: "Alto", label: "Toda a empresa ou cliente externo" },
] as const;

const REQUEST_TYPE_OPTIONS = ["Incidente", "Requisição", "Problema", "Mudança", "Outro"] as const;

const CONTACT_CHANNEL_OPTIONS = ["E-mail", "Telefone", "WhatsApp", "Chat do portal"] as const;

const DESCRIPTION_PLACEHOLDERS: Record<string, string> = {
  Incidente:
    "Descreva o erro: em qual tela aconteceu, qual mensagem apareceu e o que você estava tentando fazer.",
  "Requisição":
    "Informe o que você precisa (ex.: qual módulo/acesso) e por que essa solicitação é necessária.",
  Problema:
    "Descreva o problema recorrente, desde quando acontece e o que já foi tentado.",
  "Mudança":
    "Explique a mudança ou melhoria desejada, o motivo e o impacto esperado.",
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const selectCls =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary";

export function ClientTicketRequestForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser<User>();
  const clientId = getUserClientId(user);
  const requesterName = useMemo(() => getUserDisplayName(user), [user]);
  const requesterPhone = user?.phone || "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState(requesterName);
  const [contactPhone, setContactPhone] = useState(requesterPhone);
  const [categoryId, setCategoryId] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [requestType, setRequestType] = useState("Incidente");
  const [affectedService, setAffectedService] = useState("");
  const [urgency, setUrgency] = useState<string>("Media");
  const [impact, setImpact] = useState<string>("Medio");
  const [contactTime, setContactTime] = useState("");
  const [contactChannel, setContactChannel] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // Config admin + catálogos (categorias com subcategorias e departamentos com responsável)
  const { data: portalForm, isLoading: loadingForm } = useQuery({
    queryKey: ["portal-form-config"],
    queryFn: async () => {
      const { data } = await api.get<PortalFormPayload>("/tickets/portal-form-config/");
      return data;
    },
  });

  const fields = portalForm?.fields || {};
  const categories = portalForm?.categories || [];
  const departments = portalForm?.departments || [];

  const rule = (key: string) => fields[key] || { visible: false, required: false };
  const show = (key: string) => rule(key).visible;
  const required = (key: string) => rule(key).required;

  const selectedCategory = categories.find((c) => String(c.id) === categoryId) || null;
  const subcategories = selectedCategory?.subcategories || [];
  const selectedDepartment = departments.find((d) => String(d.id) === departmentId) || null;

  const descriptionPlaceholder =
    DESCRIPTION_PLACEHOLDERS[requestType] ||
    "Conte o problema, o impacto e o que você espera como solução.";

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`));
      return [...current, ...picked.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const removeFile = (index: number) =>
    setFiles((current) => current.filter((_, i) => i !== index));

  const missingRequired = (): string | null => {
    if (!title.trim()) return "Informe o título.";
    if (!description.trim()) return "Descreva a solicitação.";
    if (required("category") && !categoryId) return "Selecione a categoria.";
    if (required("subcategory") && subcategories.length > 0 && !subcategory)
      return "Selecione a subcategoria.";
    if (required("department") && !departmentId) return "Selecione o setor/departamento.";
    if (required("request_type") && !requestType) return "Selecione o tipo de solicitação.";
    if (required("affected_service") && !affectedService.trim())
      return "Informe o serviço/módulo afetado.";
    if (required("contact_phone") && !contactPhone.trim()) return "Informe o telefone de contato.";
    if (required("preferred_contact_time") && !contactTime.trim())
      return "Informe o melhor horário para contato.";
    if (required("preferred_contact_channel") && !contactChannel)
      return "Selecione o canal preferencial de contato.";
    if (required("attachments") && files.length === 0) return "Anexe pelo menos um arquivo.";
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!clientId) {
      toast.error("Seu usuário ainda não está vinculado a uma organização.");
      return;
    }
    const missing = missingRequired();
    if (missing) {
      toast.error(missing);
      return;
    }

    setSaving(true);
    try {
      const created = await createClientTicketRequest({
        title,
        description,
        client: clientId,
        requester: requesterName,
        requesterUser: user?.id,
        requesterContactName: contactName || requesterName,
        requesterContactPhone: contactPhone || requesterPhone,
        category: selectedCategory
          ? ({ id: selectedCategory.id, name: selectedCategory.name, default_type: selectedCategory.default_type, approval_required: selectedCategory.approval_required, sla: selectedCategory.sla } as never)
          : null,
        categoryId: categoryId || undefined,
        categoryName: selectedCategory?.name,
        subcategory: show("subcategory") ? subcategory : "",
        department: show("department") ? departmentId : "",
        affectedService: show("affected_service") ? affectedService : "",
        preferredContactTime: show("preferred_contact_time") ? contactTime : "",
        preferredContactChannel: show("preferred_contact_channel") ? contactChannel : "",
        type: (show("request_type") && requestType) || selectedCategory?.default_type || "Incidente",
        urgency,
        impact,
        hasAttachments: files.length > 0,
      });

      const createdId = (created as { id?: string })?.id;
      if (createdId && files.length) {
        let ok = 0;
        for (const file of files) {
          try {
            await uploadTicketAttachment(createdId, file);
            ok += 1;
          } catch {
            toast.error(`Falha ao anexar "${file.name}".`);
          }
        }
        if (ok) toast.success(`${ok} anexo(s) enviado(s).`);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client-tickets-list", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client-portal-tickets", clientId] }),
      ]);
      toast.success("Chamado aberto com sucesso.");
      navigate({ to: "/client/tickets" });
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível abrir o chamado."));
    } finally {
      setSaving(false);
    }
  };

  if (loadingForm) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground shadow-card">
        Carregando formulário...
      </div>
    );
  }

  const reqMark = (key: string) => (required(key) ? true : undefined);

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {/* Bloco 1 — Sobre sua solicitação */}
        <FormSection
          title="Sobre sua solicitação"
          description="Quanto mais detalhes você informar, mais rápida é a triagem pela equipe."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" required className="sm:col-span-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Erro ao acessar o painel financeiro"
                required
              />
            </Field>

            {show("request_type") && (
              <Field label="Tipo de solicitação" required={reqMark("request_type")}>
                <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className={selectCls}>
                  {REQUEST_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            )}

            {show("category") && (
              <Field label="Categoria" required={reqMark("category")}>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategory("");
                  }}
                  className={selectCls}
                >
                  <option value="">{required("category") ? "Selecione" : "Selecione (opcional)"}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </Field>
            )}

            {show("subcategory") && categoryId && subcategories.length > 0 && (
              <Field label="Subcategoria" required={reqMark("subcategory")}>
                <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={selectCls}>
                  <option value="">{required("subcategory") ? "Selecione" : "Selecione (opcional)"}</option>
                  {subcategories.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            )}

            {show("affected_service") && (
              <Field label="Serviço/módulo afetado" required={reqMark("affected_service")} className="sm:col-span-2">
                <Input
                  value={affectedService}
                  onChange={(e) => setAffectedService(e.target.value)}
                  placeholder="Ex.: Portal Financeiro, Login/Acesso, Aplicativo Mobile..."
                />
              </Field>
            )}
          </div>
        </FormSection>

        {/* Bloco 2 — Onde isso impacta */}
        <FormSection title="Onde isso impacta" description="Ajuda a definir a prioridade do atendimento.">
          <div className="grid gap-4 sm:grid-cols-2">
            {show("department") && (
              <Field label="Setor/Departamento" required={reqMark("department")}>
                <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={selectCls}>
                  <option value="">{required("department") ? "Selecione" : "Selecione (opcional)"}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>{d.name}</option>
                  ))}
                </select>
                {selectedDepartment && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <UserRound className="h-3 w-3" />
                    {selectedDepartment.manager_name
                      ? `Responsável do setor: ${selectedDepartment.manager_name}`
                      : "Sem responsável definido — a triagem direciona o chamado."}
                  </p>
                )}
              </Field>
            )}

            <Field label="Urgência" required>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={selectCls}>
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Quem é impactado" required>
              <select value={impact} onChange={(e) => setImpact(e.target.value)} className={selectCls}>
                {IMPACT_OPTIONS.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </FormSection>

        {/* Bloco 3 — Detalhes */}
        <FormSection title="Detalhes" description="Descreva o cenário e anexe evidências, se possível.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Descrição" required className="sm:col-span-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={descriptionPlaceholder}
                className="min-h-36"
                required
              />
            </Field>

            <Field label="Contato responsável">
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nome do contato responsável"
              />
            </Field>
            {show("contact_phone") && (
              <Field label="Telefone do contato" required={reqMark("contact_phone")}>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </Field>
            )}

            {show("preferred_contact_time") && (
              <Field label="Melhor horário para contato" required={reqMark("preferred_contact_time")}>
                <Input
                  value={contactTime}
                  onChange={(e) => setContactTime(e.target.value)}
                  placeholder="Ex.: das 9h às 12h"
                />
              </Field>
            )}
            {show("preferred_contact_channel") && (
              <Field label="Canal preferencial" required={reqMark("preferred_contact_channel")}>
                <select value={contactChannel} onChange={(e) => setContactChannel(e.target.value)} className={selectCls}>
                  <option value="">Selecione</option>
                  {CONTACT_CHANNEL_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            )}

            {show("attachments") && (
              <Field label={required("attachments") ? "Anexos (obrigatório)" : "Anexos"} className="sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/10 px-4 py-4 transition-colors hover:border-primary/40">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">Adicionar anexos</div>
                    <div className="text-xs text-muted-foreground">
                      Prints, PDFs, documentos, planilhas ou logs — enviados junto ao chamado.
                    </div>
                  </div>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>

                {files.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {files.map((file, index) => (
                      <li
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{file.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                          title="Remover anexo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Field>
            )}
          </div>
        </FormSection>
      </div>

      {/* Bloco 4 — Revisão / envio */}
      <div className="space-y-5">
        <FormSection title="Resumo do envio">
          <div className="space-y-2 text-sm">
            <SummaryRow icon={<UserRound className="h-3.5 w-3.5" />} label="Solicitante" value={requesterName} />
            <SummaryRow
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Organização"
              value={user?.organization_name || user?.client_name || "Minha organização"}
            />
            {show("request_type") && (
              <SummaryRow icon={<ClipboardList className="h-3.5 w-3.5" />} label="Tipo" value={requestType} />
            )}
            {show("category") && (
              <SummaryRow
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Categoria"
                value={
                  selectedCategory
                    ? `${selectedCategory.name}${subcategory ? ` · ${subcategory}` : ""}`
                    : "A definir na triagem"
                }
              />
            )}
            {show("department") && (
              <SummaryRow
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Setor"
                value={selectedDepartment ? selectedDepartment.name : "A definir na triagem"}
              />
            )}
            <SummaryRow
              icon={<Send className="h-3.5 w-3.5" />}
              label="Urgência / Impacto"
              value={`${URGENCY_OPTIONS.find((u) => u.value === urgency)?.value || urgency} · ${IMPACT_OPTIONS.find((i) => i.value === impact)?.label || impact}`}
            />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Origem, status inicial e prioridade final são definidos automaticamente pelo sistema.
          </p>
        </FormSection>

        <div className="sticky top-20 rounded-2xl p-3 shadow-card glass">
          <div className="space-y-2">
            <Button
              type="submit"
              className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              disabled={saving || !clientId}
            >
              <Save className="h-4 w-4" />
              {saving ? "Enviando..." : "Enviar chamado"}
            </Button>
            <Button type="button" variant="outline" className="w-full" asChild>
              <a href="/client/tickets">Cancelar</a>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate">{value}</div>
      </div>
    </div>
  );
}
