import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";

import { Field } from "@/components/app/Field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatPriorityLabel } from "@/lib/labels";
import { getTicketWorkflowActionLabel, type TicketWorkflowActionId } from "@/lib/ticketWorkflow";
import { findTicketCategory, getCategoryDefaults, TICKET_PRIORITY_OPTIONS } from "@/lib/tickets";
import type { Ticket, TicketCategory, User } from "@/lib/types";

export type TicketWorkflowDialogSubmitData = {
  categoryId: string;
  categoryName: string;
  subcategory: string;
  priority: string;
  responsibleTechnician: string;
  triageNotes: string;
  pauseReason: string;
  waitingReason: string;
  resolutionDescription: string;
  finalObservation: string;
  cancelReason: string;
};

const EMPTY_FORM: TicketWorkflowDialogSubmitData = {
  categoryId: "",
  categoryName: "",
  subcategory: "",
  priority: "Pendente",
  responsibleTechnician: "",
  triageNotes: "",
  pauseReason: "",
  waitingReason: "",
  resolutionDescription: "",
  finalObservation: "",
  cancelReason: "",
};

function getUserDisplayName(user: User) {
  return (
    user.name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username ||
    user.email ||
    "Usuário"
  );
}

export function TicketWorkflowDialog({
  open,
  actionId,
  ticket,
  categories,
  users,
  saving = false,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  actionId: TicketWorkflowActionId | null;
  ticket: Ticket | null;
  categories: TicketCategory[];
  users: User[];
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TicketWorkflowDialogSubmitData) => Promise<void> | void;
}) {
  const [data, setData] = useState<TicketWorkflowDialogSubmitData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedCategory = useMemo(
    () => findTicketCategory(categories, data.categoryId || data.categoryName),
    [categories, data.categoryId, data.categoryName],
  );

  useEffect(() => {
    if (!open || !ticket || !actionId) {
      return;
    }

    setData({
      ...EMPTY_FORM,
      categoryId: ticket.category_id || "",
      categoryName: ticket.category_name || ticket.category || "",
      subcategory: ticket.subcategory || "",
      priority: ticket.priority || "Pendente",
      responsibleTechnician: ticket.responsible_technician || "",
      triageNotes: ticket.triage_notes || "",
      pauseReason: ticket.pause_reason || "",
      waitingReason: ticket.waiting_reason || "",
      resolutionDescription: ticket.resolution_description || "",
      finalObservation: ticket.final_observation || "",
      cancelReason: ticket.cancel_reason || "",
    });
    setErrors({});
  }, [actionId, open, ticket]);

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    const defaults = getCategoryDefaults(selectedCategory);
    setData((current) => ({
      ...current,
      categoryName: selectedCategory.name,
      priority:
        current.priority && current.priority !== "Pendente"
          ? current.priority
          : defaults.priority,
    }));
  }, [selectedCategory]);

  if (!ticket || !actionId) {
    return null;
  }

  const setField = <K extends keyof TicketWorkflowDialogSubmitData>(
    key: K,
    value: TicketWorkflowDialogSubmitData[K],
  ) => {
    setData((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (actionId === "categorize" && !data.categoryId && !data.categoryName.trim()) {
      nextErrors.categoryId = "Selecione uma categoria para concluir a triagem.";
    }

    if (actionId === "pause" && !data.pauseReason.trim()) {
      nextErrors.pauseReason = "Informe a justificativa da pausa.";
    }

    if (actionId === "wait_customer" && !data.waitingReason.trim()) {
      nextErrors.waitingReason = "Informe a mensagem ou o motivo para aguardar o cliente.";
    }

    if (actionId === "finish" && !data.resolutionDescription.trim()) {
      nextErrors.resolutionDescription = "Descreva a solução aplicada para finalizar.";
    }

    if (actionId === "cancel" && !data.cancelReason.trim()) {
      nextErrors.cancelReason = "Informe o motivo do cancelamento.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    await onSubmit(data);
  };

  const title = getTicketWorkflowActionLabel(actionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl border-border bg-background/95 shadow-card backdrop-blur">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {actionId === "categorize"
              ? "Defina a triagem técnica do chamado sem sair da listagem."
              : actionId === "pause"
                ? "A pausa exige justificativa para manter o histórico do atendimento."
                : actionId === "wait_customer"
                  ? "Registre a mensagem que explica por que o chamado depende do cliente."
                  : actionId === "finish"
                    ? "Descreva a solução entregue antes de encerrar o chamado."
                    : "Confirme e registre o motivo do cancelamento."}
          </DialogDescription>
        </DialogHeader>

        {actionId === "categorize" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria" required error={errors.categoryId}>
              <Select
                value={data.categoryId || data.categoryName || undefined}
                onValueChange={(value) => setField("categoryId", value)}
              >
                <SelectTrigger className="border-border bg-muted/20">
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((category) => category.active ?? true)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Subcategoria">
              <Input
                value={data.subcategory}
                onChange={(event) => setField("subcategory", event.target.value)}
                placeholder="Opcional"
                className="border-border bg-muted/20"
              />
            </Field>

            <Field label="Prioridade" required>
              <Select
                value={data.priority}
                onValueChange={(value) => setField("priority", value)}
              >
                <SelectTrigger className="border-border bg-muted/20">
                  <SelectValue placeholder="Selecionar prioridade" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITY_OPTIONS.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {formatPriorityLabel(priority)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Técnico responsável">
              <Select
                value={data.responsibleTechnician || "__none__"}
                onValueChange={(value) =>
                  setField("responsibleTechnician", value === "__none__" ? "" : value)
                }
              >
                <SelectTrigger className="border-border bg-muted/20">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {getUserDisplayName(user)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Observação de triagem"
              className="sm:col-span-2"
              hint={
                selectedCategory
                  ? `SLA padrão da categoria: ${getCategoryDefaults(selectedCategory).sla}.`
                  : "Opcional, mas recomendado para registrar contexto técnico."
              }
            >
              <Textarea
                value={data.triageNotes}
                onChange={(event) => setField("triageNotes", event.target.value)}
                rows={4}
                placeholder="Contexto técnico, hipoteses e direcionamento da triagem."
                className="border-border bg-muted/20"
              />
            </Field>
          </div>
        ) : null}

        {actionId === "pause" ? (
          <Field label="Justificativa" required error={errors.pauseReason}>
            <Textarea
              value={data.pauseReason}
              onChange={(event) => setField("pauseReason", event.target.value)}
              rows={4}
              placeholder="Explique por que o atendimento precisa ser pausado."
              className="border-border bg-muted/20"
            />
          </Field>
        ) : null}

        {actionId === "wait_customer" ? (
          <Field label="Motivo / mensagem" required error={errors.waitingReason}>
            <Textarea
              value={data.waitingReason}
              onChange={(event) => setField("waitingReason", event.target.value)}
              rows={4}
              placeholder="Ex.: aguardando evidencias adicionais do cliente."
              className="border-border bg-muted/20"
            />
          </Field>
        ) : null}

        {actionId === "finish" ? (
          <div className="grid gap-4">
            <Field
              label="Solução aplicada"
              required
              error={errors.resolutionDescription}
            >
              <Textarea
                value={data.resolutionDescription}
                onChange={(event) => setField("resolutionDescription", event.target.value)}
                rows={4}
                placeholder="Descreva a solução entregue ao cliente."
                className="border-border bg-muted/20"
              />
            </Field>
            <Field label="Observação final">
              <Textarea
                value={data.finalObservation}
                onChange={(event) => setField("finalObservation", event.target.value)}
                rows={3}
                placeholder="Opcional"
                className="border-border bg-muted/20"
              />
            </Field>
          </div>
        ) : null}

        {actionId === "cancel" ? (
          <Field label="Motivo do cancelamento" required error={errors.cancelReason}>
            <Textarea
              value={data.cancelReason}
              onChange={(event) => setField("cancelReason", event.target.value)}
              rows={4}
              placeholder="Explique por que o chamado esta sendo cancelado."
              className="border-border bg-muted/20"
            />
          </Field>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={saving}
            className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
