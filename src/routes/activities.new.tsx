import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/PageHeader";
import { ActivityForm, type ActivityFormData } from "@/components/forms/ActivityForm";
import type { Ticket } from "@/lib/types";
import { getTicket } from "@/services/ticketService";

export const Route = createFileRoute("/activities/new")({
  head: () => ({ meta: [{ title: "Nova atividade - NimbusDesk" }] }),
  component: NewActivityPage,
});

function normalizeTicketValue(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function resolveActivityTypeFromTicket(ticket: Ticket) {
  const normalizedType = normalizeTicketValue(ticket.type);

  if (
    normalizedType.includes("INCIDENTE")
    || normalizedType.includes("ERRO")
    || normalizedType.includes("BUG")
    || normalizedType.includes("PROBLEMA")
  ) {
    return "Bug";
  }

  if (
    normalizedType.includes("MELHORIA")
    || normalizedType.includes("HISTORIA")
    || normalizedType.includes("REQUISITO")
  ) {
    return "Historia";
  }

  return "Tarefa";
}

function buildTicketActivityDescription(ticket: Ticket) {
  const reference = ticket.code || ticket.id.slice(0, 8);
  const details = [
    `Atividade gerada a partir do chamado ${reference}.`,
    "",
    `Cliente: ${ticket.client_name || "Não informado"}`,
    `Categoria: ${ticket.category_name || ticket.category || "Não informada"}`,
    `Origem: chamado`,
    "",
    "Descrição do chamado:",
    ticket.description || "Sem descrição informada.",
  ];

  return details.join("\n");
}

function buildInitialActivityData(
  sourceTicket: Ticket,
  projectId: string,
): Partial<ActivityFormData> {
  return {
    title: sourceTicket.title,
    description: buildTicketActivityDescription(sourceTicket),
    type: resolveActivityTypeFromTicket(sourceTicket),
    ticket: sourceTicket.id,
    project: sourceTicket.project || projectId || "",
    priority: sourceTicket.priority || "Media",
    assignee: sourceTicket.responsible_technician || sourceTicket.technicians?.[0] || "",
    estHours: String(sourceTicket.est_hours ?? ""),
    linkTicketOnSave: true,
  };
}

function NewActivityPage() {
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const params = new URLSearchParams(search);
  const ticketId = params.get("ticket") || "";
  const projectId = params.get("project") || "";
  const forceDuplicate = params.get("forceDuplicate") === "1";

  const sourceTicketQuery = useQuery({
    queryKey: ["activity-source-ticket", ticketId],
    queryFn: () => getTicket(ticketId),
    enabled: Boolean(ticketId),
  });

  const sourceTicket = sourceTicketQuery.data;
  const sourceTicketAlreadyLinked = Boolean(
    sourceTicket?.linked_activity || sourceTicket?.linked_activities?.length,
  );

  const initial = sourceTicket
    ? buildInitialActivityData(sourceTicket, projectId)
    : projectId
      ? { project: projectId }
      : undefined;

  if (ticketId && sourceTicketQuery.isLoading) {
    return (
      <AppShell>
        <div className="max-w-7xl space-y-5">
          <PageHeader
            crumbs={[
              { label: "Workspace", to: "/" },
              { label: "Atividades", to: "/activities" },
              { label: "Nova" },
            ]}
            title="Nova atividade"
            subtitle="Carregando os dados do chamado para preparar a atividade..."
          />
          <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">
            Carregando dados do chamado...
          </div>
        </div>
      </AppShell>
    );
  }

  if (ticketId && !sourceTicket) {
    return (
      <AppShell>
        <div className="max-w-7xl space-y-5">
          <PageHeader
            crumbs={[
              { label: "Workspace", to: "/" },
              { label: "Atividades", to: "/activities" },
              { label: "Nova" },
            ]}
            title="Nova atividade"
            subtitle="Não foi possível carregar o chamado de origem."
          />
          <div className="glass rounded-2xl border border-destructive/30 p-6 text-sm text-destructive">
            O formulario não foi aberto em branco porque o chamado de origem não foi carregado.
            Tente novamente a partir da tela do chamado.
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl space-y-5">
        <PageHeader
          crumbs={[
            { label: "Workspace", to: "/" },
            { label: "Atividades", to: "/activities" },
            { label: "Nova" },
          ]}
          title="Nova atividade"
          subtitle={
            sourceTicket
              ? `Revise os campos preenchidos automaticamente a partir do chamado ${sourceTicket.code || sourceTicket.id.slice(0, 8)} antes de salvar.`
              : "Cadastre a atividade, vincule ao projeto e deixe o planejamento detalhado para a sprint."
          }
        />
        <ActivityForm
          key={`${projectId || "no-project"}-${sourceTicket?.id || ticketId || "no-ticket"}`}
          mode="create"
          initial={initial}
          sourceTicketSnapshot={sourceTicket || null}
          duplicateWarningMessage={
            forceDuplicate && sourceTicketAlreadyLinked
              ? "Este chamado ja possui atividade vinculada. Revise a nova atividade antes de salvar outra."
              : null
          }
        />
      </div>
    </AppShell>
  );
}
