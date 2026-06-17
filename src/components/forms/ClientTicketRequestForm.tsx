import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Paperclip, Save } from "lucide-react";
import { toast } from "sonner";

import { Field, FormSection } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getUserClientId, getUserDisplayName } from "@/lib/auth";
import type { TicketAttachment, User } from "@/lib/types";
import { getStoredUser } from "@/services/authService";
import { createClientTicketRequest } from "@/services/ticketService";

type ClientTicketFormData = {
  title: string;
  description: string;
  contactName: string;
  contactPhone: string;
  attachments: TicketAttachment[];
};

const initialState: ClientTicketFormData = {
  title: "",
  description: "",
  contactName: "",
  contactPhone: "",
  attachments: [],
};

export function ClientTicketRequestForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser<User>();
  const clientId = getUserClientId(user);
  const requesterName = useMemo(() => getUserDisplayName(user), [user]);
  const requesterPhone = user?.phone || "";
  const [data, setData] = useState<ClientTicketFormData>({
    ...initialState,
    contactName: requesterName,
    contactPhone: requesterPhone,
  });
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof ClientTicketFormData>(
    key: K,
    value: ClientTicketFormData[K],
  ) => setData((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!clientId) {
      toast.error("Seu usuario ainda nao esta vinculado a uma organizacao.");
      return;
    }

    if (!data.title.trim() || !data.description.trim()) {
      toast.error("Preencha titulo e descricao.");
      return;
    }

    setSaving(true);
    try {
      await createClientTicketRequest({
        title: data.title,
        description: data.description,
        client: clientId,
        requester: requesterName,
        requesterUser: user?.id,
        requesterContactName: data.contactName || requesterName,
        requesterContactPhone: data.contactPhone || requesterPhone,
        attachments: data.attachments,
      });
      await queryClient.invalidateQueries({ queryKey: ["client-tickets-list", clientId] });
      await queryClient.invalidateQueries({ queryKey: ["client-portal-tickets", clientId] });
      toast.success("Chamado aberto com sucesso.");
      navigate({ to: "/client/tickets" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel abrir o chamado.",
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
          description="Informe apenas os dados da solicitacao. Os campos internos serao definidos pela equipe tecnica."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titulo" required className="sm:col-span-2">
              <Input
                value={data.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Ex.: Erro ao acessar o painel financeiro"
                required
              />
            </Field>
            <Field label="Solicitante">
              <Input value={requesterName} disabled />
            </Field>
            <Field label="Organizacao atendida">
              <Input value={user?.organization_name || user?.client_name || "Minha organizacao"} disabled />
            </Field>
            <Field label="Contato responsavel">
              <Input
                value={data.contactName}
                onChange={(event) => setField("contactName", event.target.value)}
                placeholder="Nome do contato responsavel"
              />
            </Field>
            <Field label="Telefone do contato">
              <Input
                value={data.contactPhone}
                onChange={(event) => setField("contactPhone", event.target.value)}
                placeholder="(00) 00000-0000"
              />
            </Field>
            <Field label="Descricao" required className="sm:col-span-2">
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
                    Os anexos seguem disponiveis para complementar a abertura do chamado.
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
        <FormSection title="Fluxo do portal do cliente">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>O sistema usa seu usuario logado como solicitante do chamado.</p>
            <p>Organizacao atendida, origem e status inicial sao definidos automaticamente.</p>
            <p>A categorizacao interna e os demais campos tecnicos ficam restritos ao portal interno.</p>
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
