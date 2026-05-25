import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Save } from "lucide-react";
import { toast } from "sonner";

import { Field, FormSection } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CLIENT_TICKET_TYPE_OPTIONS,
  findTicketCategory,
  getCategoryDefaults,
  TICKET_URGENCY_OPTIONS,
} from "@/lib/tickets";
import { getUserClientId, getUserDisplayName } from "@/lib/auth";
import type { TicketAttachment, User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { listTicketCategories } from "@/services/ticketCategoryService";
import { createClientTicketRequest } from "@/services/ticketService";

type ClientTicketFormData = {
  title: string;
  description: string;
  categoryId: string;
  type: string;
  urgency: string;
  attachments: TicketAttachment[];
};

const initialState: ClientTicketFormData = {
  title: "",
  description: "",
  categoryId: "",
  type: "Solicitacao",
  urgency: "Media",
  attachments: [],
};

export function ClientTicketRequestForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser<User>();
  const clientId = getUserClientId(user);
  const requester = useMemo(() => user?.email || getUserDisplayName(user), [user]);
  const [data, setData] = useState(initialState);
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: () => listTicketCategories(),
  });

  const selectedCategory = useMemo(
    () => findTicketCategory(categories, data.categoryId),
    [categories, data.categoryId],
  );
  const categoryDefaults = getCategoryDefaults(selectedCategory);

  const setField = <K extends keyof ClientTicketFormData>(
    key: K,
    value: ClientTicketFormData[K],
  ) => setData((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!clientId) {
      toast.error("Seu usuário ainda não está vinculado a um cliente.");
      return;
    }

    if (!data.title.trim() || !data.description.trim() || !data.categoryId) {
      toast.error("Preencha título, descrição e categoria.");
      return;
    }

    setSaving(true);
    try {
      await createClientTicketRequest({
        title: data.title,
        description: data.description,
        client: clientId,
        requester,
        categoryId: data.categoryId,
        categoryName: selectedCategory?.name,
        category: selectedCategory,
        type: data.type,
        urgency: data.urgency,
        attachments: data.attachments,
      });
      await queryClient.invalidateQueries({ queryKey: ["client-tickets-list", clientId] });
      await queryClient.invalidateQueries({ queryKey: ["client-portal-tickets", clientId] });
      toast.success("Chamado aberto com sucesso.");
      navigate({ to: "/client/tickets" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível abrir o chamado.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <FormSection
          title="Abrir chamado"
          description="Informe apenas os dados da solicitação. A equipe faz a categorização técnica depois."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" required className="sm:col-span-2">
              <Input
                value={data.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Ex.: Erro ao acessar o painel financeiro"
                required
              />
            </Field>
            <Field label="Solicitante">
              <Input value={requester} disabled />
            </Field>
            <Field label="Categoria" required>
              <Select
                value={data.categoryId || undefined}
                onValueChange={(value) => {
                  const category = findTicketCategory(categories, value);
                  const defaults = getCategoryDefaults(category);
                  setData((current) => ({
                    ...current,
                    categoryId: value,
                    type:
                      current.type && current.type !== "Solicitacao"
                        ? current.type
                        : defaults.type,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo" required>
              <Select value={data.type} onValueChange={(value) => setField("type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TICKET_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Urgência" required>
              <Select
                value={data.urgency}
                onValueChange={(value) => setField("urgency", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar urgência" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_URGENCY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Descrição" required className="sm:col-span-2">
              <Textarea
                value={data.description}
                onChange={(event) => setField("description", event.target.value)}
                placeholder="Conte o problema, o impacto e o que voce espera como solucao."
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
                    A interface já aceita anexos. Se a API ainda não persistir, o chamado continua sem quebrar.
                  </div>
                </div>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []).map((file) => ({
                      name: file.name,
                      size: file.size,
                      content_type: file.type,
                    }));
                    setField("attachments", files);
                    if (files.length) {
                      toast.success(`${files.length} arquivo(s) selecionado(s).`);
                    }
                  }}
                />
              </label>
            </Field>
          </div>
        </FormSection>
      </div>

      <div className="space-y-5">
        <FormSection title="Regras da categoria">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted-foreground">SLA padrao</dt>
              <dd>{selectedCategory?.sla || "8h"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted-foreground">Tipo sugerido</dt>
              <dd>{categoryDefaults.type}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted-foreground">Aprovação</dt>
              <dd>{categoryDefaults.approvalRequired ? "Necessária" : "Não obrigatória"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted-foreground">Pode virar atividade</dt>
              <dd>{categoryDefaults.allowProjectActivity ? "Sim" : "Não"}</dd>
            </div>
          </dl>
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
