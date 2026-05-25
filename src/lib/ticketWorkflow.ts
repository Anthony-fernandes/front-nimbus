import { getUserDisplayName } from "@/lib/auth";
import { findTicketCategory, getCategoryDefaults } from "@/lib/tickets";
import type {
  Ticket,
  TicketStatusHistory,
  TicketTimelineEvent,
  TicketWorkflowMeta,
  TicketWorkflowStatusConfig,
} from "@/lib/types";

export const TICKET_WORKFLOW_STATUS_SLUGS = {
  OPEN: "aberto",
  AWAITING_APPROVAL: "aguardando_aprovacao",
  APPROVED: "aprovado",
  REJECTED: "reprovado",
  TRIAGE: "triagem",
  AWAITING_SERVICE: "aguardando_atendimento",
  IN_PROGRESS: "em_atendimento",
  WAITING_CUSTOMER: "aguardando_cliente",
  VALIDATION: "validacao",
  PAUSED: "pausado",
  FINISHED: "finalizado",
  CANCELED: "cancelado",
} as const;

export type TicketWorkflowActionId =
  | "open_details"
  | "edit"
  | "approve"
  | "reject"
  | "categorize"
  | "start_service"
  | "resume_service"
  | "wait_customer"
  | "send_validation"
  | "pause"
  | "cancel"
  | "finish";

export type TicketWorkflowPermissions = {
  canApprove?: boolean;
  canCategorize?: boolean;
  canFinalize?: boolean;
  canEdit?: boolean;
};

export type TicketWorkflowActionDefinition = {
  id: TicketWorkflowActionId;
  label: string;
  targetStatus?: string;
  destructive?: boolean;
};

export type TicketWorkflowActionInput = {
  categoryId?: string;
  categoryName?: string;
  subcategory?: string;
  priority?: string;
  responsibleTechnician?: string;
  triageNotes?: string;
  pauseReason?: string;
  waitingReason?: string;
  resolutionDescription?: string;
  finalObservation?: string;
  cancelReason?: string;
};

export type PreparedTicketWorkflowAction = {
  transitionPayload: {
    status: string;
    internalNotes?: string;
    approvalStatus?: string;
    approvalJustification?: string;
    approvalRequired?: boolean;
    requiresClientValidation?: boolean;
    linkedActivity?: string | null;
    convertedToActivity?: boolean;
    finishedAt?: string | null;
    category?: string;
    categoryId?: string | null;
    categoryName?: string;
    subcategory?: string;
    priority?: string;
    impact?: string;
    urgency?: string;
    sla?: string;
    team?: string;
    responsibleTechnician?: string | null;
    technicians?: string[];
  };
  metaPatch: Partial<TicketWorkflowMeta>;
  historyEntry: TicketStatusHistory;
  successMessage: string;
};

const SYSTEM_TICKET_WORKFLOW_STATUSES: TicketWorkflowStatusConfig[] = [
  {
    id: "status-open",
    name: "Aberto",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.OPEN,
    description: "Chamado registrado e aguardando analise inicial.",
    color: "#5ea8ff",
    active: true,
    order: 10,
    next_statuses: [
      TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_APPROVAL,
      TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE,
      TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE,
      TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
    ],
    system: true,
  },
  {
    id: "status-awaiting-approval",
    name: "Aguardando aprovacao",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_APPROVAL,
    description: "Depende de aprovacao antes da triagem tecnica.",
    color: "#f2c14e",
    active: true,
    order: 20,
    origin_statuses: [TICKET_WORKFLOW_STATUS_SLUGS.OPEN],
    next_statuses: [
      TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE,
      TICKET_WORKFLOW_STATUS_SLUGS.REJECTED,
      TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
    ],
    system: true,
  },
  {
    id: "status-approved",
    name: "Aprovado",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.APPROVED,
    description: "Aprovado para seguir com triagem e atendimento.",
    color: "#25c281",
    active: true,
    order: 30,
    next_statuses: [
      TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE,
      TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE,
      TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
      TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
    ],
    system: true,
  },
  {
    id: "status-rejected",
    name: "Reprovado",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.REJECTED,
    description: "Chamado reprovado na etapa de aprovacao.",
    color: "#ff6b6b",
    active: true,
    is_final: true,
    order: 40,
    system: true,
  },
  {
    id: "status-triage",
    name: "Triagem",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE,
    description: "Triagem tecnica em andamento.",
    color: "#8b7bff",
    active: true,
    order: 50,
    next_statuses: [
      TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE,
      TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
      TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
    ],
    system: true,
  },
  {
    id: "status-awaiting-service",
    name: "Aguardando atendimento",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE,
    description: "Triagem concluida e pronto para iniciar atendimento.",
    color: "#5ea8ff",
    active: true,
    order: 60,
    next_statuses: [
      TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
      TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
    ],
    system: true,
  },
  {
    id: "status-in-progress",
    name: "Em atendimento",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
    description: "Atendimento tecnico ativo.",
    color: "#5ea8ff",
    active: true,
    order: 70,
    next_statuses: [
      TICKET_WORKFLOW_STATUS_SLUGS.WAITING_CUSTOMER,
      TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION,
      TICKET_WORKFLOW_STATUS_SLUGS.PAUSED,
      TICKET_WORKFLOW_STATUS_SLUGS.FINISHED,
      TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
    ],
    system: true,
  },
  {
    id: "status-waiting-customer",
    name: "Aguardando cliente",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.WAITING_CUSTOMER,
    description: "Aguardando retorno ou informacao do cliente.",
    color: "#f2c14e",
    active: true,
    pauses_sla: true,
    allows_resume: true,
    order: 80,
    next_statuses: [
      TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
      TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
    ],
    system: true,
  },
  {
    id: "status-validation",
    name: "Validacao",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION,
    description: "Aguardando validacao da solucao ou retorno tecnico.",
    color: "#5dd0c8",
    active: true,
    allows_resume: true,
    order: 90,
    next_statuses: [
      TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
      TICKET_WORKFLOW_STATUS_SLUGS.FINISHED,
      TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
    ],
    system: true,
  },
  {
    id: "status-paused",
    name: "Pausado",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.PAUSED,
    description: "Atendimento pausado por justificativa interna.",
    color: "#9ca3af",
    active: true,
    pauses_sla: true,
    allows_resume: true,
    order: 100,
    next_statuses: [
      TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
      TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
    ],
    system: true,
  },
  {
    id: "status-finished",
    name: "Finalizado",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.FINISHED,
    description: "Chamado concluido com solucao registrada.",
    color: "#25c281",
    active: true,
    is_final: true,
    order: 110,
    system: true,
  },
  {
    id: "status-canceled",
    name: "Cancelado",
    slug: TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
    description: "Chamado encerrado por cancelamento.",
    color: "#ff6b6b",
    active: true,
    is_final: true,
    order: 120,
    system: true,
  },
];

const STATUS_ALIASES: Record<string, string> = {
  ABERTO: TICKET_WORKFLOW_STATUS_SLUGS.OPEN,
  OPEN: TICKET_WORKFLOW_STATUS_SLUGS.OPEN,
  TRIAGEM: TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE,
  "TRIAGEM CATEGORIZACAO": TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE,
  CATEGORIZADO: TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE,
  "AGUARDANDO ATENDIMENTO": TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE,
  "EM ATENDIMENTO": TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
  "IN PROGRESS": TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
  "AGUARDANDO CLIENTE": TICKET_WORKFLOW_STATUS_SLUGS.WAITING_CUSTOMER,
  WAITING: TICKET_WORKFLOW_STATUS_SLUGS.WAITING_CUSTOMER,
  "WAITING CUSTOMER": TICKET_WORKFLOW_STATUS_SLUGS.WAITING_CUSTOMER,
  "AGUARDANDO APROVACAO": TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_APPROVAL,
  APPROVAL: TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_APPROVAL,
  "PENDING APPROVAL": TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_APPROVAL,
  APROVADO: TICKET_WORKFLOW_STATUS_SLUGS.APPROVED,
  APPROVED: TICKET_WORKFLOW_STATUS_SLUGS.APPROVED,
  REPROVADO: TICKET_WORKFLOW_STATUS_SLUGS.REJECTED,
  REJECTED: TICKET_WORKFLOW_STATUS_SLUGS.REJECTED,
  PAUSADO: TICKET_WORKFLOW_STATUS_SLUGS.PAUSED,
  PAUSED: TICKET_WORKFLOW_STATUS_SLUGS.PAUSED,
  VALIDACAO: TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION,
  "VALIDACAO AVALIACAO": TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION,
  "EM VALIDACAO": TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION,
  VALIDATION: TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION,
  FINALIZADO: TICKET_WORKFLOW_STATUS_SLUGS.FINISHED,
  CONCLUIDO: TICKET_WORKFLOW_STATUS_SLUGS.FINISHED,
  CLOSED: TICKET_WORKFLOW_STATUS_SLUGS.FINISHED,
  DONE: TICKET_WORKFLOW_STATUS_SLUGS.FINISHED,
  CANCELADO: TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
  CANCELED: TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
};

const ACTION_LABELS: Record<TicketWorkflowActionId, string> = {
  open_details: "Abrir detalhes",
  edit: "Editar",
  approve: "Aprovar",
  reject: "Reprovar",
  categorize: "Categorizar / triagem",
  start_service: "Iniciar atendimento",
  resume_service: "Retomar atendimento",
  wait_customer: "Aguardar cliente",
  send_validation: "Enviar para validação",
  pause: "Pausar",
  cancel: "Cancelar chamado",
  finish: "Finalizar chamado",
};

export function normalizeTicketWorkflowValue(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s/_-]+/g, " ");
}

export function slugifyTicketWorkflowStatus(value: string) {
  return normalizeTicketWorkflowValue(value).toLowerCase().replace(/\s+/g, "_");
}

function buildStatusConfigMap(statusConfigs: TicketWorkflowStatusConfig[]) {
  const next = new Map<string, TicketWorkflowStatusConfig>();

  statusConfigs.forEach((config) => {
    next.set(config.slug, config);
    next.set(slugifyTicketWorkflowStatus(config.name), config);
    next.set(normalizeTicketWorkflowValue(config.name), config);
  });

  return next;
}

export function sortTicketWorkflowStatuses(statusConfigs: TicketWorkflowStatusConfig[]) {
  return [...statusConfigs].sort((left, right) => {
    if ((left.order || 0) !== (right.order || 0)) {
      return (left.order || 0) - (right.order || 0);
    }

    return left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" });
  });
}

export function getTicketWorkflowStatuses(
  customStatuses: TicketWorkflowStatusConfig[] = [],
) {
  const statusMap = new Map<string, TicketWorkflowStatusConfig>();

  SYSTEM_TICKET_WORKFLOW_STATUSES.forEach((status) => {
    statusMap.set(status.slug, { ...status });
  });

  customStatuses.forEach((status) => {
    const slug = status.slug || slugifyTicketWorkflowStatus(status.name);
    if (!slug) {
      return;
    }

    const systemStatus = statusMap.get(slug);
    if (systemStatus) {
      statusMap.set(slug, {
        ...systemStatus,
        color: status.color || systemStatus.color,
        description: status.description || systemStatus.description,
        pauses_sla:
          typeof status.pauses_sla === "boolean" ? status.pauses_sla : systemStatus.pauses_sla,
        allows_resume:
          typeof status.allows_resume === "boolean"
            ? status.allows_resume
            : systemStatus.allows_resume,
        order: typeof status.order === "number" ? status.order : systemStatus.order,
        active: status.active ?? systemStatus.active,
        origin_statuses: status.origin_statuses?.length
          ? status.origin_statuses
          : systemStatus.origin_statuses,
        next_statuses: status.next_statuses?.length
          ? status.next_statuses
          : systemStatus.next_statuses,
      });
      return;
    }

    statusMap.set(slug, {
      ...status,
      id: status.id || `custom-${slug}`,
      slug,
      active: status.active ?? true,
      order: typeof status.order === "number" ? status.order : 999,
      system: false,
    });
  });

  return sortTicketWorkflowStatuses([...statusMap.values()]);
}

export function getTicketStatusConfig(
  status: string | null | undefined,
  statusConfigs: TicketWorkflowStatusConfig[],
) {
  const normalizedStatus = normalizeTicketWorkflowValue(status);
  const statusSlug = STATUS_ALIASES[normalizedStatus] || slugifyTicketWorkflowStatus(String(status || ""));
  const statusMap = buildStatusConfigMap(statusConfigs);
  return statusMap.get(statusSlug) || statusMap.get(normalizedStatus) || null;
}

export function getTicketStatusSlug(
  status: string | null | undefined,
  statusConfigs: TicketWorkflowStatusConfig[],
) {
  return getTicketStatusConfig(status, statusConfigs)?.slug
    || STATUS_ALIASES[normalizeTicketWorkflowValue(status)]
    || slugifyTicketWorkflowStatus(String(status || ""));
}

export function getTicketStatusName(
  slug: string,
  statusConfigs: TicketWorkflowStatusConfig[],
) {
  return statusConfigs.find((status) => status.slug === slug)?.name || slug;
}

export function getTicketWorkflowCategorizedStatus(statusConfigs: TicketWorkflowStatusConfig[]) {
  const awaitingService = statusConfigs.find(
    (status) =>
      status.slug === TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE && status.active !== false,
  );

  if (awaitingService) {
    return awaitingService.name;
  }

  return getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE, statusConfigs);
}

export function getTicketWorkflowActionTargetStatus(
  actionId: TicketWorkflowActionId,
  statusConfigs: TicketWorkflowStatusConfig[],
) {
  switch (actionId) {
    case "approve":
      return getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE, statusConfigs);
    case "reject":
      return getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.REJECTED, statusConfigs);
    case "categorize":
      return getTicketWorkflowCategorizedStatus(statusConfigs);
    case "start_service":
    case "resume_service":
      return getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS, statusConfigs);
    case "wait_customer":
      return getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.WAITING_CUSTOMER, statusConfigs);
    case "send_validation":
      return getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION, statusConfigs);
    case "pause":
      return getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.PAUSED, statusConfigs);
    case "cancel":
      return getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.CANCELED, statusConfigs);
    case "finish":
      return getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.FINISHED, statusConfigs);
    default:
      return undefined;
  }
}

export function isTicketWorkflowFinalStatus(
  status: string | null | undefined,
  statusConfigs: TicketWorkflowStatusConfig[],
) {
  return Boolean(getTicketStatusConfig(status, statusConfigs)?.is_final);
}

export function isTicketAwaitingApproval(ticket: Ticket) {
  const normalizedStatus = normalizeTicketWorkflowValue(ticket.status);
  const normalizedApprovalStatus = normalizeTicketWorkflowValue(ticket.approval_status);

  return (
    normalizedStatus === "AGUARDANDO APROVACAO" ||
    normalizedApprovalStatus === "PENDING" ||
    (Boolean(ticket.approval_required) &&
      !["APPROVED", "REJECTED", "NOT REQUIRED"].includes(normalizedApprovalStatus) &&
      !ticket.approved_at &&
      !ticket.rejected_at)
  );
}

export function hasTicketWorkflowStarted(ticket: Ticket, statusConfigs: TicketWorkflowStatusConfig[]) {
  const statusSlug = getTicketStatusSlug(ticket.status, statusConfigs);

  if (ticket.started_at || ticket.started_by) {
    return true;
  }

  if (
    [
      TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
      TICKET_WORKFLOW_STATUS_SLUGS.WAITING_CUSTOMER,
      TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION,
      TICKET_WORKFLOW_STATUS_SLUGS.PAUSED,
      TICKET_WORKFLOW_STATUS_SLUGS.FINISHED,
    ].includes(statusSlug as (typeof TICKET_WORKFLOW_STATUS_SLUGS)[keyof typeof TICKET_WORKFLOW_STATUS_SLUGS])
  ) {
    return true;
  }

  return Boolean(
    (ticket.status_history || []).some((entry) =>
      ["start_service", "resume_service", "wait_customer", "pause", "finish"].includes(
        entry.action,
      ),
    ),
  );
}

export function isTicketTriageCompleted(ticket: Ticket, statusConfigs: TicketWorkflowStatusConfig[]) {
  const statusSlug = getTicketStatusSlug(ticket.status, statusConfigs);

  if (ticket.triage_completed) {
    return true;
  }

  return [
    TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE,
    TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS,
    TICKET_WORKFLOW_STATUS_SLUGS.WAITING_CUSTOMER,
    TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION,
    TICKET_WORKFLOW_STATUS_SLUGS.PAUSED,
    TICKET_WORKFLOW_STATUS_SLUGS.FINISHED,
    TICKET_WORKFLOW_STATUS_SLUGS.CANCELED,
  ].includes(statusSlug as (typeof TICKET_WORKFLOW_STATUS_SLUGS)[keyof typeof TICKET_WORKFLOW_STATUS_SLUGS]);
}

export function isTicketSlaPaused(ticket: Ticket, statusConfigs: TicketWorkflowStatusConfig[]) {
  if (ticket.sla_paused) {
    return true;
  }

  return Boolean(getTicketStatusConfig(ticket.status, statusConfigs)?.pauses_sla);
}

export function getAvailableTicketActions(
  ticket: Ticket,
  statusConfigs: TicketWorkflowStatusConfig[],
  permissions: TicketWorkflowPermissions = {},
) {
  const currentStatus = getTicketStatusSlug(ticket.status, statusConfigs);
  const currentStatusConfig = getTicketStatusConfig(ticket.status, statusConfigs);
  const isFinal = Boolean(currentStatusConfig?.is_final);
  const approvalPending = isTicketAwaitingApproval(ticket);
  const triageCompleted = isTicketTriageCompleted(ticket, statusConfigs);
  const hasStarted = hasTicketWorkflowStarted(ticket, statusConfigs);
  const canEdit = (permissions.canEdit ?? true) && !isFinal;
  const canApprove = Boolean(permissions.canApprove);
  const canCategorize = Boolean(permissions.canCategorize);
  const canFinalize = Boolean(permissions.canFinalize);
  const actions: TicketWorkflowActionDefinition[] = [
    { id: "open_details", label: ACTION_LABELS.open_details },
  ];

  if (canEdit) {
    actions.push({ id: "edit", label: ACTION_LABELS.edit });
  }

  if (isFinal) {
    return actions;
  }

  if (canApprove && approvalPending) {
    actions.push({
      id: "approve",
      label: ACTION_LABELS.approve,
      targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE, statusConfigs),
    });
    actions.push({
      id: "reject",
      label: ACTION_LABELS.reject,
      targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.REJECTED, statusConfigs),
      destructive: true,
    });
    if (canFinalize) {
      actions.push({
        id: "cancel",
        label: ACTION_LABELS.cancel,
        targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.CANCELED, statusConfigs),
        destructive: true,
      });
    }
    return actions;
  }

  if (
    canCategorize &&
    !triageCompleted &&
    [
      TICKET_WORKFLOW_STATUS_SLUGS.OPEN,
      TICKET_WORKFLOW_STATUS_SLUGS.APPROVED,
      TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE,
    ].includes(currentStatus as (typeof TICKET_WORKFLOW_STATUS_SLUGS)[keyof typeof TICKET_WORKFLOW_STATUS_SLUGS])
  ) {
    actions.push({
      id: "categorize",
      label: ACTION_LABELS.categorize,
      targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE, statusConfigs),
    });
  }

  if (
    !hasStarted &&
    !approvalPending &&
    triageCompleted &&
    [
      TICKET_WORKFLOW_STATUS_SLUGS.OPEN,
      TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE,
      TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE,
      TICKET_WORKFLOW_STATUS_SLUGS.APPROVED,
    ].includes(currentStatus as (typeof TICKET_WORKFLOW_STATUS_SLUGS)[keyof typeof TICKET_WORKFLOW_STATUS_SLUGS])
  ) {
    actions.push({
      id: "start_service",
      label: ACTION_LABELS.start_service,
      targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS, statusConfigs),
    });
  }

  if (hasStarted && currentStatusConfig?.allows_resume) {
    actions.push({
      id: "resume_service",
      label: ACTION_LABELS.resume_service,
      targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS, statusConfigs),
    });
  }

  if (hasStarted && currentStatus === TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS) {
    actions.push({
      id: "wait_customer",
      label: ACTION_LABELS.wait_customer,
      targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.WAITING_CUSTOMER, statusConfigs),
    });
    actions.push({
      id: "send_validation",
      label: ACTION_LABELS.send_validation,
      targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION, statusConfigs),
    });
    actions.push({
      id: "pause",
      label: ACTION_LABELS.pause,
      targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.PAUSED, statusConfigs),
    });
  }

  if (
    canFinalize &&
    hasStarted &&
    (
      currentStatus === TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION
      || (
        currentStatus === TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS
        && !ticket.requires_client_validation
      )
    )
  ) {
    actions.push({
      id: "finish",
      label: ACTION_LABELS.finish,
      targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.FINISHED, statusConfigs),
    });
  }

  if (canFinalize) {
    actions.push({
      id: "cancel",
      label: ACTION_LABELS.cancel,
      targetStatus: getTicketStatusName(TICKET_WORKFLOW_STATUS_SLUGS.CANCELED, statusConfigs),
      destructive: true,
    });
  }

  return actions;
}

export function canTransitionTicket(
  ticket: Ticket,
  targetStatus: string,
  statusConfigs: TicketWorkflowStatusConfig[],
) {
  const currentStatusSlug = getTicketStatusSlug(ticket.status, statusConfigs);
  const targetStatusConfig = getTicketStatusConfig(targetStatus, statusConfigs);
  const currentStatusConfig = getTicketStatusConfig(ticket.status, statusConfigs);
  const targetStatusSlug = targetStatusConfig?.slug || slugifyTicketWorkflowStatus(targetStatus);
  const triageCompleted = isTicketTriageCompleted(ticket, statusConfigs);
  const hasStarted = hasTicketWorkflowStarted(ticket, statusConfigs);

  if (!targetStatusConfig?.active) {
    return false;
  }

  if (currentStatusConfig?.is_final) {
    return false;
  }

  if (currentStatusSlug === targetStatusSlug) {
    return false;
  }

  if (
    targetStatusConfig.origin_statuses?.length &&
    !targetStatusConfig.origin_statuses.includes(currentStatusSlug)
  ) {
    return false;
  }

  if (
    currentStatusConfig?.next_statuses?.length &&
    !currentStatusConfig.next_statuses.includes(targetStatusSlug)
  ) {
    return false;
  }

  switch (targetStatusSlug) {
    case TICKET_WORKFLOW_STATUS_SLUGS.TRIAGE:
      return !triageCompleted;
    case TICKET_WORKFLOW_STATUS_SLUGS.AWAITING_SERVICE:
      return !triageCompleted;
    case TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS:
      if (hasStarted) {
        return Boolean(currentStatusConfig?.allows_resume) || currentStatusSlug === targetStatusSlug;
      }
      return triageCompleted;
    case TICKET_WORKFLOW_STATUS_SLUGS.WAITING_CUSTOMER:
    case TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION:
    case TICKET_WORKFLOW_STATUS_SLUGS.PAUSED:
      return hasStarted && currentStatusSlug === TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS;
    case TICKET_WORKFLOW_STATUS_SLUGS.FINISHED:
      return (
        hasStarted &&
        (
          currentStatusSlug === TICKET_WORKFLOW_STATUS_SLUGS.VALIDATION
          || (
            currentStatusSlug === TICKET_WORKFLOW_STATUS_SLUGS.IN_PROGRESS
            && !ticket.requires_client_validation
          )
        )
      );
    case TICKET_WORKFLOW_STATUS_SLUGS.CANCELED:
      return !currentStatusConfig?.is_final;
    case TICKET_WORKFLOW_STATUS_SLUGS.REJECTED:
      return isTicketAwaitingApproval(ticket);
    default:
      return true;
  }
}

export function getTicketWorkflowActionLabel(actionId: TicketWorkflowActionId) {
  return ACTION_LABELS[actionId];
}

export function buildTicketStatusHistoryEntry({
  ticket,
  fromStatus,
  toStatus,
  action,
  reason,
  userId,
  userName,
  createdAt,
}: {
  ticket: Pick<Ticket, "id">;
  fromStatus?: string;
  toStatus: string;
  action: TicketWorkflowActionId;
  reason?: string;
  userId?: string;
  userName?: string;
  createdAt?: string;
}): TicketStatusHistory {
  return {
    id: `${ticket.id}-${action}-${Date.now()}`,
    ticketId: ticket.id,
    fromStatus,
    toStatus,
    action,
    reason,
    userId,
    userName,
    createdAt: createdAt || new Date().toISOString(),
  };
}

export function prepareTicketWorkflowAction(args: {
  ticket: Ticket;
  actionId: TicketWorkflowActionId;
  input?: TicketWorkflowActionInput;
  statusConfigs: TicketWorkflowStatusConfig[];
  categories?: Array<{
    id: string;
    name: string;
    approval_required?: boolean;
    default_priority?: string;
    default_impact?: string;
    default_type?: string;
    default_team?: string;
    requires_client_validation?: boolean;
    sla?: string;
  }>;
  users?: Array<{
    id: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    email?: string;
  }>;
  currentUser?: {
    id?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    email?: string;
  } | null;
  now?: string;
}) : PreparedTicketWorkflowAction {
  const {
    ticket,
    actionId,
    input,
    statusConfigs,
    categories = [],
    users = [],
    currentUser,
    now = new Date().toISOString(),
  } = args;
  const targetStatus = getTicketWorkflowActionTargetStatus(actionId, statusConfigs);

  if (!targetStatus) {
    throw new Error("Nao foi possivel resolver o destino da acao selecionada.");
  }

  const currentUserId = currentUser?.id;
  const currentUserName = getUserDisplayName(currentUser);
  const category =
    actionId === "categorize"
      ? findTicketCategory(categories, input?.categoryId || input?.categoryName)
      : null;
  const categoryDefaults = getCategoryDefaults(category);
  const responsibleTechnician =
    actionId === "categorize" && input?.responsibleTechnician
      ? users.find((user) => user.id === input.responsibleTechnician) || null
      : null;
  const mergedTechnicians =
    actionId === "categorize" && input?.responsibleTechnician
      ? Array.from(new Set([...(ticket.technicians || []), input.responsibleTechnician]))
      : ticket.technicians || [];
  const mergedTechnicianNames =
    actionId === "categorize" && responsibleTechnician
      ? Array.from(
          new Set([
            ...(ticket.technician_names || []),
            getUserDisplayName(responsibleTechnician),
          ]),
        )
      : ticket.technician_names || [];
  let transitionPayload: PreparedTicketWorkflowAction["transitionPayload"] = {
    status: targetStatus,
  };
  let metaPatch: Partial<TicketWorkflowMeta> = {};
  let reason = "";

  switch (actionId) {
    case "approve":
      transitionPayload = {
        status: targetStatus,
        approvalStatus: "approved",
        internalNotes: "Chamado aprovado e encaminhado para triagem.",
      };
      reason = transitionPayload.internalNotes || "";
      break;
    case "reject":
      transitionPayload = {
        status: targetStatus,
        approvalStatus: "rejected",
        internalNotes: "Chamado reprovado na etapa de aprovacao.",
      };
      reason = transitionPayload.internalNotes || "";
      break;
    case "categorize":
      transitionPayload = {
        status: getTicketWorkflowCategorizedStatus(statusConfigs),
        category: category?.name || input?.categoryName || ticket.category || "",
        categoryId: category?.id || input?.categoryId || ticket.category_id || null,
        categoryName: category?.name || input?.categoryName || ticket.category_name || "",
        subcategory: input?.subcategory || "",
        priority: input?.priority || categoryDefaults.priority || ticket.priority || "Pendente",
        team: ticket.team || categoryDefaults.team,
        responsibleTechnician: input?.responsibleTechnician || ticket.responsible_technician || null,
        technicians: mergedTechnicians,
        internalNotes: input?.triageNotes || ticket.internal_notes || "",
        approvalRequired: category ? categoryDefaults.approvalRequired : ticket.approval_required,
        requiresClientValidation: category
          ? categoryDefaults.requiresClientValidation
          : ticket.requires_client_validation,
        sla: category ? categoryDefaults.sla : ticket.sla,
      };
      metaPatch = {
        category: transitionPayload.category,
        category_id: transitionPayload.categoryId,
        category_name: transitionPayload.categoryName,
        subcategory: input?.subcategory || "",
        priority: transitionPayload.priority,
        team: transitionPayload.team,
        responsible_technician: transitionPayload.responsibleTechnician,
        responsible_technician_name: responsibleTechnician
          ? getUserDisplayName(responsibleTechnician)
          : ticket.responsible_technician_name,
        technicians: mergedTechnicians,
        technician_names: mergedTechnicianNames,
        triage_completed: true,
        triage_completed_at: now,
        triage_completed_by: currentUserId,
        triage_completed_by_name: currentUserName,
        triage_notes: input?.triageNotes || "",
        sla_paused: false,
        sla_paused_at: null,
      };
      reason =
        input?.triageNotes
        || `Categoria definida como ${transitionPayload.category || "Sem categoria"}.`;
      break;
    case "start_service":
      metaPatch = {
        started_at: ticket.started_at || now,
        started_by: ticket.started_by || currentUserId,
        started_by_name: ticket.started_by_name || currentUserName,
        paused_at: null,
        paused_by: null,
        paused_by_name: "",
        pause_reason: "",
        waiting_reason: "",
        sla_paused: false,
        sla_paused_at: null,
      };
      reason = "Atendimento iniciado.";
      break;
    case "resume_service": {
      const currentPauseMs =
        ticket.sla_paused && ticket.sla_paused_at
          ? Math.max(0, new Date(now).getTime() - new Date(ticket.sla_paused_at).getTime())
          : 0;
      metaPatch = {
        started_at: ticket.started_at || now,
        started_by: ticket.started_by || currentUserId,
        started_by_name: ticket.started_by_name || currentUserName,
        paused_at: null,
        paused_by: null,
        paused_by_name: "",
        pause_reason: "",
        waiting_reason: "",
        sla_paused: false,
        sla_paused_at: null,
        sla_pause_total_ms: Number(ticket.sla_pause_total_ms || 0) + currentPauseMs,
      };
      reason = "Atendimento retomado.";
      break;
    }
    case "wait_customer":
      transitionPayload = {
        status: targetStatus,
        internalNotes: input?.waitingReason || "",
      };
      metaPatch = {
        waiting_reason: input?.waitingReason || "",
        paused_at: now,
        paused_by: currentUserId,
        paused_by_name: currentUserName,
        sla_paused: true,
        sla_paused_at: ticket.sla_paused_at || now,
      };
      reason = input?.waitingReason || "Aguardando retorno do cliente.";
      break;
    case "send_validation":
      metaPatch = {
        validation_notes: "Chamado enviado para validacao.",
        sla_paused: false,
        sla_paused_at: null,
      };
      reason = "Chamado enviado para validacao.";
      break;
    case "pause":
      transitionPayload = {
        status: targetStatus,
        internalNotes: input?.pauseReason || "",
      };
      metaPatch = {
        pause_reason: input?.pauseReason || "",
        paused_at: now,
        paused_by: currentUserId,
        paused_by_name: currentUserName,
        sla_paused: true,
        sla_paused_at: ticket.sla_paused_at || now,
      };
      reason = input?.pauseReason || "";
      break;
    case "cancel":
      transitionPayload = {
        status: targetStatus,
        internalNotes: input?.cancelReason || "",
      };
      metaPatch = {
        cancel_reason: input?.cancelReason || "",
        canceled_at: now,
        canceled_by: currentUserId,
        canceled_by_name: currentUserName,
        sla_paused: false,
        sla_paused_at: null,
      };
      reason = input?.cancelReason || "";
      break;
    case "finish":
      transitionPayload = {
        status: targetStatus,
        finishedAt: now,
        internalNotes: input?.finalObservation || "",
      };
      metaPatch = {
        finished_at: now,
        finished_by: currentUserId,
        finished_by_name: currentUserName,
        resolution_description: input?.resolutionDescription || "",
        final_observation: input?.finalObservation || "",
        sla_paused: false,
        sla_paused_at: null,
      };
      reason = input?.resolutionDescription || "";
      break;
    default:
      break;
  }

  return {
    transitionPayload,
    metaPatch,
    historyEntry: buildTicketStatusHistoryEntry({
      ticket,
      fromStatus: ticket.status,
      toStatus: transitionPayload.status,
      action: actionId,
      reason,
      userId: currentUserId,
      userName: currentUserName,
      createdAt: now,
    }),
    successMessage: `${getTicketWorkflowActionLabel(actionId)} concluído.`,
  };
}

export function mergeTicketWithWorkflowMeta(
  ticket: Ticket,
  meta?: TicketWorkflowMeta | null,
) {
  if (!meta) {
    return ticket;
  }

  return {
    ...ticket,
    category: meta.category || ticket.category,
    category_id: meta.category_id ?? ticket.category_id,
    category_name: meta.category_name || ticket.category_name,
    subcategory: meta.subcategory || ticket.subcategory,
    priority: meta.priority || ticket.priority,
    team: meta.team || ticket.team,
    responsible_technician: meta.responsible_technician ?? ticket.responsible_technician,
    responsible_technician_name:
      meta.responsible_technician_name || ticket.responsible_technician_name,
    technicians: meta.technicians || ticket.technicians,
    technician_names: meta.technician_names || ticket.technician_names,
    triage_completed: meta.triage_completed ?? ticket.triage_completed,
    triage_completed_at: meta.triage_completed_at ?? ticket.triage_completed_at,
    triage_completed_by: meta.triage_completed_by ?? ticket.triage_completed_by,
    triage_completed_by_name:
      meta.triage_completed_by_name || ticket.triage_completed_by_name,
    triage_notes: meta.triage_notes || ticket.triage_notes,
    started_at: meta.started_at ?? ticket.started_at,
    started_by: meta.started_by ?? ticket.started_by,
    started_by_name: meta.started_by_name || ticket.started_by_name,
    paused_at: meta.paused_at ?? ticket.paused_at,
    paused_by: meta.paused_by ?? ticket.paused_by,
    paused_by_name: meta.paused_by_name || ticket.paused_by_name,
    pause_reason: meta.pause_reason || ticket.pause_reason,
    waiting_reason: meta.waiting_reason || ticket.waiting_reason,
    validation_notes: meta.validation_notes || ticket.validation_notes,
    finished_at: meta.finished_at ?? ticket.finished_at,
    finished_by: meta.finished_by ?? ticket.finished_by,
    finished_by_name: meta.finished_by_name || ticket.finished_by_name,
    resolution_description: meta.resolution_description || ticket.resolution_description,
    final_observation: meta.final_observation || ticket.final_observation,
    cancel_reason: meta.cancel_reason || ticket.cancel_reason,
    canceled_at: meta.canceled_at ?? ticket.canceled_at,
    canceled_by: meta.canceled_by ?? ticket.canceled_by,
    canceled_by_name: meta.canceled_by_name || ticket.canceled_by_name,
    sla_paused: meta.sla_paused ?? ticket.sla_paused,
    sla_paused_at: meta.sla_paused_at ?? ticket.sla_paused_at,
    sla_pause_total_ms: meta.sla_pause_total_ms ?? ticket.sla_pause_total_ms,
    linked_activity: meta.linked_activity ?? ticket.linked_activity,
    linked_activity_name: meta.linked_activity_name || ticket.linked_activity_name,
    linked_activities: meta.linked_activities || ticket.linked_activities,
    status_history: meta.status_history?.length ? meta.status_history : ticket.status_history,
  };
}

function describeHistoryAction(action: TicketWorkflowActionId) {
  switch (action) {
    case "categorize":
      return "Chamado categorizado";
    case "start_service":
      return "Atendimento iniciado";
    case "resume_service":
      return "Atendimento retomado";
    case "wait_customer":
      return "Chamado aguardando cliente";
    case "send_validation":
      return "Chamado enviado para validacao";
    case "pause":
      return "Chamado pausado";
    case "cancel":
      return "Chamado cancelado";
    case "finish":
      return "Chamado finalizado";
    case "approve":
      return "Chamado aprovado";
    case "reject":
      return "Chamado reprovado";
    default:
      return "Status atualizado";
  }
}

export function ticketStatusHistoryToTimelineEvents(
  ticket: Ticket,
  history: TicketStatusHistory[] = [],
): TicketTimelineEvent[] {
  return history.map((entry) => {
    const actor = entry.userName ? ` por ${entry.userName}` : "";
    const reason = entry.reason ? `. ${entry.reason}` : "";

    return {
      id: entry.id,
      ticket: ticket.id,
      author: entry.userId,
      author_name: entry.userName,
      created_at: entry.createdAt,
      type: "status",
      visibility: "internal",
      message: `${describeHistoryAction(entry.action)}${actor}.${reason}`.trim(),
      metadata: {
        action: entry.action,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
      },
    };
  });
}
