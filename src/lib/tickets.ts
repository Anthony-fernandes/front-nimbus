import type {
  Activity,
  Sprint,
  SprintBacklogItem,
  Ticket,
  TicketCategory,
  TicketTimelineEvent,
} from "@/lib/types";

export const CLIENT_TICKET_TYPE_OPTIONS = [
  "Solicitacao",
  "Erro",
  "Incidente",
  "Duvida",
  "Melhoria",
  "Outros",
] as const;

export const INTERNAL_TICKET_TYPE_OPTIONS = [
  ...CLIENT_TICKET_TYPE_OPTIONS,
  "Problema",
  "Mudanca",
] as const;

export const TICKET_PRIORITY_OPTIONS = [
  "Pendente",
  "Critica",
  "Alta",
  "Media",
  "Baixa",
] as const;

export const TICKET_IMPACT_OPTIONS = [
  "Pendente",
  "Alto",
  "Medio",
  "Baixo",
] as const;

export const TICKET_URGENCY_OPTIONS = ["Alta", "Media", "Baixa"] as const;

export const TICKET_STATUS_OPTIONS = [
  "Aberto",
  "Aguardando aprovacao",
  "Aprovado",
  "Reprovado",
  "Triagem",
  "Aguardando atendimento",
  "Em atendimento",
  "Aguardando cliente",
  "Validacao",
  "Pausado",
  "Cancelado",
  "Finalizado",
] as const;

function normalizeValue(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s/_-]+/g, " ");
}

export function isApprovalRequired(category?: Partial<TicketCategory> | null) {
  return Boolean(category?.approval_required);
}

export function resolveTicketOpeningStatus(category?: Partial<TicketCategory> | null) {
  return isApprovalRequired(category) ? "Aguardando aprovacao" : "Aberto";
}

export function getTicketStatusClass(status?: string | null) {
  switch (normalizeValue(status)) {
    case "ABERTO":
      return "bg-info/15 text-info";
    case "AGUARDANDO APROVACAO":
      return "bg-warning/15 text-warning";
    case "APROVADO":
      return "bg-success/15 text-success";
    case "REPROVADO":
      return "bg-destructive/15 text-destructive";
    case "TRIAGEM CATEGORIZACAO":
    case "TRIAGEM":
      return "bg-primary/15 text-primary";
    case "AGUARDANDO ATENDIMENTO":
      return "bg-info/15 text-info";
    case "EM ATENDIMENTO":
      return "bg-primary/15 text-primary";
    case "AGUARDANDO CLIENTE":
      return "bg-warning/15 text-warning";
    case "VALIDACAO AVALIACAO":
    case "VALIDACAO":
    case "EM VALIDACAO":
      return "bg-accent/15 text-accent";
    case "PAUSADO":
      return "bg-muted text-muted-foreground";
    case "CANCELADO":
      return "bg-destructive/15 text-destructive";
    case "FINALIZADO":
      return "bg-success/15 text-success";
    default:
      return "bg-muted/60 text-muted-foreground";
  }
}

export function getTicketPriorityClass(priority?: string | null) {
  switch (normalizeValue(priority)) {
    case "CRITICA":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "ALTA":
      return "bg-warning/15 text-warning border-warning/30";
    case "MEDIA":
      return "bg-info/15 text-info border-info/30";
    case "BAIXA":
      return "bg-muted text-muted-foreground border-border";
    case "PENDENTE":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function isFinalTicketStatus(status?: string | null) {
  return normalizeValue(status) === "FINALIZADO";
}

export function canTicketReturnToService(status?: string | null) {
  return ["VALIDACAO AVALIACAO", "VALIDACAO", "EM VALIDACAO"].includes(
    normalizeValue(status),
  );
}

export function getCategoryDefaults(category?: Partial<TicketCategory> | null) {
  return {
    type: category?.default_type || "Solicitacao",
    priority: category?.default_priority || "Pendente",
    impact: category?.default_impact || "Pendente",
    team: category?.default_team || "",
    sla: category?.sla || "8h",
    approvalRequired: Boolean(category?.approval_required),
    allowProjectActivity: Boolean(category?.allow_project_activity),
    requiresClientValidation: Boolean(category?.requires_client_validation),
  };
}

export function findTicketCategory(
  categories: TicketCategory[],
  categoryIdOrName?: string | null,
) {
  if (!categoryIdOrName) return null;

  return (
    categories.find((category) => category.id === categoryIdOrName) ||
    categories.find(
      (category) => normalizeValue(category.name) === normalizeValue(categoryIdOrName),
    ) ||
    null
  );
}

export function makeSprintItemRef(itemType: "ticket" | "activity", itemId: string) {
  return `${itemType}:${itemId}`;
}

export function parseSprintItemRef(
  value: string | SprintBacklogItem | undefined | null,
): SprintBacklogItem | null {
  if (!value) return null;

  if (typeof value === "object") {
    return value.item_id && value.item_type ? value : null;
  }

  const [rawType, ...rest] = value.split(":");
  const itemId = rest.join(":").trim();
  const itemType = normalizeValue(rawType) === "ACTIVITY" ? "activity" : "ticket";

  if (!itemId) {
    return { item_id: value, item_type: "ticket" };
  }

  return {
    item_id: itemId,
    item_type: itemType,
  };
}

export function buildSprintBacklogItems(
  values: Array<string | SprintBacklogItem> | undefined,
  tickets: Ticket[],
  activities: Activity[],
) {
  return (values || [])
    .map((value) => parseSprintItemRef(value))
    .filter((value): value is SprintBacklogItem => Boolean(value))
    .map((item) => {
      if (item.item_type === "activity") {
        const activity = activities.find((entry) => entry.id === item.item_id);
        return {
          ...item,
          title: item.title || activity?.title || item.item_id,
          status: item.status || activity?.status,
          code: item.code || activity?.id.slice(0, 8),
        };
      }

      const ticket = tickets.find(
        (entry) =>
          entry.id === item.item_id ||
          entry.code === item.item_id ||
          makeSprintItemRef("ticket", entry.id) === item.item_id,
      );

      return {
        ...item,
        title: item.title || ticket?.title || item.item_id,
        status: item.status || ticket?.status,
        code: item.code || ticket?.code || item.item_id.slice(0, 8),
      };
    });
}

export function buildTicketTimeline(
  ticket: Ticket,
  {
    categories = [],
    activities = [],
    sprints = [],
  }: {
    categories?: TicketCategory[];
    activities?: Activity[];
    sprints?: Sprint[];
  } = {},
) {
  const events: TicketTimelineEvent[] = [];
  const createdAt = ticket.opened_at || ticket.created_at;
  const category =
    findTicketCategory(categories, ticket.category_id || ticket.category || ticket.category_name) ||
    null;

  if (createdAt) {
    events.push({
      id: `${ticket.id}-opened`,
      ticket: ticket.id,
      created_at: createdAt,
      type: "created",
      visibility: "client",
      message:
        ticket.origin === "Interno"
          ? "Chamado criado internamente."
          : "Chamado aberto pelo portal do cliente.",
    });
  }

  if (ticket.category || category?.name) {
    events.push({
      id: `${ticket.id}-category`,
      ticket: ticket.id,
      created_at: ticket.updated_at || ticket.created_at || createdAt,
      type: "categorization",
      visibility: "internal",
      message: `Categoria definida como ${category?.name || ticket.category}.`,
    });
  }

  if (ticket.approval_required || category?.approval_required) {
    events.push({
      id: `${ticket.id}-approval-required`,
      ticket: ticket.id,
      created_at: createdAt,
      type: "approval",
      visibility: "internal",
      message: "Categoria exige aprovação gerencial antes do atendimento.",
    });
  }

  if (ticket.approved_at) {
    events.push({
      id: `${ticket.id}-approved`,
      ticket: ticket.id,
      created_at: ticket.approved_at,
      author_name: ticket.approved_by_name,
      type: "approval",
      visibility: "internal",
      message: `Chamado aprovado${ticket.approved_by_name ? ` por ${ticket.approved_by_name}` : ""}.`,
    });
  }

  if (ticket.rejected_at) {
    events.push({
      id: `${ticket.id}-rejected`,
      ticket: ticket.id,
      created_at: ticket.rejected_at,
      author_name: ticket.rejected_by_name,
      type: "approval",
      visibility: "internal",
      message: `Chamado reprovado${ticket.rejected_by_name ? ` por ${ticket.rejected_by_name}` : ""}.`,
    });
  }

  if (ticket.status) {
    events.push({
      id: `${ticket.id}-status-current`,
      ticket: ticket.id,
      created_at: ticket.updated_at || createdAt,
      type: "status",
      visibility: "client",
      message: `Status atual: ${ticket.status}.`,
    });
  }

  const relatedActivities = activities.filter(
    (activity) =>
      activity.ticket === ticket.id || ticket.linked_activity === activity.id,
  );

  relatedActivities.forEach((activity) => {
    events.push({
      id: `${ticket.id}-activity-${activity.id}`,
      ticket: ticket.id,
      created_at: activity.created_at || ticket.updated_at || createdAt,
      type: "activity",
      visibility: "internal",
      message: `Atividade vinculada: ${activity.title}.`,
      metadata: { activityId: activity.id, projectId: activity.project || null },
    });
  });

  sprints.forEach((sprint) => {
    const items = buildSprintBacklogItems(sprint.backlog, [ticket], activities);
    const linked = items.find(
      (item) =>
        item.item_type === "ticket" &&
        (item.item_id === ticket.id || item.item_id === ticket.code),
    );

    if (linked) {
      events.push({
        id: `${ticket.id}-sprint-${sprint.id}`,
        ticket: ticket.id,
        created_at: sprint.start_at || sprint.created_at || ticket.updated_at || createdAt,
        type: "sprint",
        visibility: "internal",
        message: `Chamado planejado na sprint ${sprint.name}.`,
        metadata: { sprintId: sprint.id },
      });
    }
  });

  if (ticket.finished_at) {
    events.push({
      id: `${ticket.id}-finished`,
      ticket: ticket.id,
      created_at: ticket.finished_at,
      type: "status",
      visibility: "client",
      message:
        ticket.converted_to_activity || ticket.linked_activity
          ? "Chamado concluído com conversão para atividade de projeto."
          : "Chamado finalizado.",
    });
  }

  const apiEvents = [...(ticket.timeline || []), ...(ticket.comments || [])];

  return [...apiEvents, ...events]
    .filter((event) => event.message)
    .sort((left, right) => {
      const leftTime = new Date(left.created_at || 0).getTime();
      const rightTime = new Date(right.created_at || 0).getTime();
      return rightTime - leftTime;
    });
}
