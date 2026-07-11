import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Field, FormSection } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getUserClientId, getUserDisplayName } from "@/lib/auth";
import { TICKET_IMPACT_OPTIONS, TICKET_URGENCY_OPTIONS } from "@/lib/tickets";
import type { TicketCategory, User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { listTicketCategories } from "@/services/ticketCategoryService";
import { createClientTicketRequest, uploadTicketAttachment } from "@/services/ticketService";
import { parseApiError } from "@/services/utils";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

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
  const [urgency, setUrgency] = useState<string>("Media");
  const [impact, setImpact] = useState<string>("Medio");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // Categorias visíveis para triagem. Se o cliente não puder listar, cai em [].
  const { data: categories = [] } = useQuery({
    queryKey: ["client-ticket-categories"],
    queryFn: () => listTicketCategories().catch(() => [] as TicketCategory[]),
  });

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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!clientId) {
      toast.error("Seu usuário ainda não está vinculado a uma organização.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error("Preencha título e descrição.");
      return;
    }

    setSaving(true);
    try {
      const selectedCategory = categories.find((c) => String(c.id) === categoryId) || null;
      const created = await createClientTicketRequest({
        title,
        description,
        client: clientId,
        requester: requesterName,
        requesterUser: user?.id,
        requesterContactName: contactName || requesterName,
        requesterContactPhone: contactPhone || requesterPhone,
        category: selectedCategory,
        categoryId: categoryId || undefined,
        categoryName: selectedCategory?.name,
        type: selectedCategory?.default_type || "Incidente",
        urgency,
        impact,
      });

      // Sobe os anexos reais no chamado recém-criado.
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

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <FormSection
          title="Abrir chamado"
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

            <Field label="Solicitante">
              <Input value={requesterName} disabled />
            </Field>
            <Field label="Organização atendida">
              <Input value={user?.organization_name || user?.client_name || "Minha organização"} disabled />
            </Field>

            <Field label="Contato responsável">
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nome do contato responsável"
              />
            </Field>
            <Field label="Telefone do contato">
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </Field>

            {categories.length > 0 && (
              <Field label="Categoria">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecione (opcional)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Urgência">
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {TICKET_URGENCY_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u === "Media" ? "Média" : u}</option>
                ))}
              </select>
            </Field>
            <Field label="Impacto no seu trabalho">
              <select
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                {TICKET_IMPACT_OPTIONS.map((i) => (
                  <option key={i} value={i}>{i === "Medio" ? "Médio" : i}</option>
                ))}
              </select>
            </Field>

            <Field label="Descrição" required className="sm:col-span-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Conte o problema, o impacto e o que você espera como solução."
                className="min-h-36"
                required
              />
            </Field>

            <Field label="Anexos" className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/10 px-4 py-4 transition-colors hover:border-primary/40">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Adicionar anexos</div>
                  <div className="text-xs text-muted-foreground">
                    Clique para selecionar prints, documentos ou logs (enviados junto ao chamado).
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
          </div>
        </FormSection>
      </div>

      <div className="space-y-5">
        <FormSection title="Fluxo do portal do cliente">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>O sistema usa seu usuário logado como solicitante do chamado.</p>
            <p>Organização atendida, origem e status inicial são definidos automaticamente.</p>
            <p>Categoria, urgência e impacto ajudam a equipe a priorizar; a prioridade final e os demais campos técnicos são definidos internamente.</p>
          </div>
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
