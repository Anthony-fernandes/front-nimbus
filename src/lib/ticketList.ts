import type { Ticket } from "@/lib/types";
import { isTicketLate } from "@/services/analytics";

export type TicketQuickFilter =
  | "open"
  | "approval"
  | "in_progress"
  | "waiting"
  | "late"
  | "finished";

export type TicketSortBy =
  | "recent_desc"
  | "recent_asc"
  | "priority"
  | "sla_critical"
  | "client_asc"
  | "client_desc"
  | "technician_asc"
  | "technician_desc"
  | "status";

export type TicketAdvancedFilters = {
  status: string;
  priority: string;
  client: string;
  technician: string;
  category: string;
  sla: "" | "late" | "on_time";
  dateFrom: string;
  dateTo: string;
};

export const DEFAULT_TICKET_ADVANCED_FILTERS: TicketAdvancedFilters = {
  status: "",
  priority: "",
  client: "",
  technician: "",
  category: "",
  sla: "",
  dateFrom: "",
  dateTo: "",
};

export const TICKET_SORT_OPTIONS: Array<{ value: TicketSortBy; label: string }> = [
  { value: "recent_desc", label: "Mais recentes primeiro" },
  { value: "recent_asc", label: "Mais antigos primeiro" },
  { value: "priority", label: "Prioridade" },
  { value: "sla_critical", label: "SLA mais critico primeiro" },
  { value: "client_asc", label: "Cliente A-Z" },
  { value: "client_desc", label: "Cliente Z-A" },
  { value: "technician_asc", label: "Técnico A-Z" },
  { value: "technician_desc", label: "Técnico Z-A" },
  { value: "status", label: "Status" },
];

const PRIORITY_RANK: Record<string, number> = {
  CRITICA: 4,
  ALTA: 3,
  MEDIA: 2,
  BAIXA: 1,
  PENDENTE: 0,
};

function normalizeValue(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s/_-]+/g, " ");
}

function compareStrings(left: string, right: string) {
  return left.localeCompare(right, "pt-BR", { sensitivity: "base" });
}

function getOpenedTimestamp(ticket: Ticket) {
  const raw = ticket.opened_at || ticket.created_at || "";
  const value = raw ? new Date(raw).getTime() : Number.NaN;
  return Number.isNaN(value) ? 0 : value;
}

function getDueTimestamp(ticket: Ticket) {
  const raw = ticket.due_at || "";
  const value = raw ? new Date(raw).getTime() : Number.NaN;
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

function getDayStart(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
}

function getDayEnd(value: string) {
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
}

function getTicketSearchHaystack(ticket: Ticket) {
  return normalizeValue(
    [
      ticket.code,
      ticket.id,
      ticket.title,
      ticket.client_name,
      ticket.client,
      ticket.category_name,
      ticket.category,
      ticket.status,
      ticket.requester_name,
      ticket.requester,
      ticket.responsible_technician_name,
      ...getTicketTechnicianNames(ticket),
    ].join(" "),
  );
}

function matchesPeriod(ticket: Ticket, filters: TicketAdvancedFilters) {
  if (!filters.dateFrom && !filters.dateTo) {
    return true;
  }

  const timestamp = getOpenedTimestamp(ticket);

  if (!timestamp) {
    return false;
  }

  if (filters.dateFrom) {
    const from = getDayStart(filters.dateFrom);
    if (!Number.isNaN(from) && timestamp < from) {
      return false;
    }
  }

  if (filters.dateTo) {
    const to = getDayEnd(filters.dateTo);
    if (!Number.isNaN(to) && timestamp > to) {
      return false;
    }
  }

  return true;
}

function matchesStatusGroup(ticket: Ticket, aliases: string[]) {
  const normalizedStatus = normalizeValue(ticket.status);
  return aliases.some((alias) => normalizedStatus.includes(alias));
}

function compareRecent(left: Ticket, right: Ticket) {
  return getOpenedTimestamp(right) - getOpenedTimestamp(left);
}

export function getTicketTechnicianNames(ticket: Ticket) {
  const names = new Set<string>();

  ticket.technician_names?.forEach((name) => {
    if (name) {
      names.add(name);
    }
  });

  if (ticket.responsible_technician_name) {
    names.add(ticket.responsible_technician_name);
  }

  return [...names];
}

export function getPrimaryTicketTechnician(ticket: Ticket) {
  return getTicketTechnicianNames(ticket)[0] || "";
}

export function isTicketOverdue(ticket: Ticket) {
  const lateFlags = ticket as Ticket & {
    isLate?: boolean;
    is_late?: boolean;
  };

  return Boolean(lateFlags.isLate || lateFlags.is_late || isTicketLate(ticket));
}

export function matchesTicketQuickFilter(
  ticket: Ticket,
  quickFilter: TicketQuickFilter | null,
) {
  if (!quickFilter) {
    return true;
  }

  switch (quickFilter) {
    case "open":
      return matchesStatusGroup(ticket, [
        "ABERTO",
        "OPEN",
        "TRIAGEM",
        "TRIAGEM CATEGORIZACAO",
        "AGUARDANDO ATENDIMENTO",
      ]);
    case "approval":
      return (
        matchesStatusGroup(ticket, [
          "APROVACAO",
          "AGUARDANDO APROVACAO",
          "APPROVAL",
          "PENDING APPROVAL",
        ]) ||
        normalizeValue(ticket.approval_status) === "PENDING"
      );
    case "in_progress":
      return matchesStatusGroup(ticket, ["EM ATENDIMENTO", "IN PROGRESS", "ATENDIMENTO"]);
    case "waiting":
      return (
        matchesStatusGroup(ticket, [
          "AGUARDANDO",
          "AGUARDANDO CLIENTE",
          "AGUARDANDO RETORNO",
          "AGUARDANDO FORNECEDOR",
          "WAITING",
          "WAITING CUSTOMER",
        ]) || matchesStatusGroup(ticket, ["VALIDACAO", "VALIDACAO AVALIACAO"])
      );
    case "late":
      return isTicketOverdue(ticket);
    case "finished":
      return (
        matchesStatusGroup(ticket, ["FINALIZADO", "CONCLUIDO", "CLOSED", "DONE"]) ||
        Boolean(ticket.finished_at)
      );
    default:
      return true;
  }
}

export function matchesTicketAdvancedFilters(
  ticket: Ticket,
  filters: TicketAdvancedFilters,
) {
  if (filters.status && normalizeValue(ticket.status) !== normalizeValue(filters.status)) {
    return false;
  }

  if (filters.priority && normalizeValue(ticket.priority) !== normalizeValue(filters.priority)) {
    return false;
  }

  if (filters.client) {
    const clientName = ticket.client_name || ticket.client || "";
    if (normalizeValue(clientName) !== normalizeValue(filters.client)) {
      return false;
    }
  }

  if (filters.technician) {
    const matchesTechnician = getTicketTechnicianNames(ticket).some(
      (name) => normalizeValue(name) === normalizeValue(filters.technician),
    );

    if (!matchesTechnician) {
      return false;
    }
  }

  if (filters.category) {
    const categoryName = ticket.category_name || ticket.category || "";
    if (normalizeValue(categoryName) !== normalizeValue(filters.category)) {
      return false;
    }
  }

  if (filters.sla === "late" && !isTicketOverdue(ticket)) {
    return false;
  }

  if (filters.sla === "on_time" && isTicketOverdue(ticket)) {
    return false;
  }

  return matchesPeriod(ticket, filters);
}

export function matchesTicketSearch(ticket: Ticket, searchTerm: string) {
  if (!searchTerm.trim()) {
    return true;
  }

  return getTicketSearchHaystack(ticket).includes(normalizeValue(searchTerm));
}

export function sortTicketList(tickets: Ticket[], sortBy: TicketSortBy) {
  const nextTickets = [...tickets];

  nextTickets.sort((left, right) => {
    switch (sortBy) {
      case "recent_asc":
        return getOpenedTimestamp(left) - getOpenedTimestamp(right);
      case "priority": {
        const priorityDelta =
          (PRIORITY_RANK[normalizeValue(right.priority)] ?? -1) -
          (PRIORITY_RANK[normalizeValue(left.priority)] ?? -1);
        return priorityDelta || compareRecent(left, right);
      }
      case "sla_critical": {
        const leftLate = isTicketOverdue(left) ? 0 : 1;
        const rightLate = isTicketOverdue(right) ? 0 : 1;

        if (leftLate !== rightLate) {
          return leftLate - rightLate;
        }

        const dueDelta = getDueTimestamp(left) - getDueTimestamp(right);
        return dueDelta || compareRecent(left, right);
      }
      case "client_asc":
        return (
          compareStrings(left.client_name || left.client || "", right.client_name || right.client || "") ||
          compareRecent(left, right)
        );
      case "client_desc":
        return (
          compareStrings(right.client_name || right.client || "", left.client_name || left.client || "") ||
          compareRecent(left, right)
        );
      case "technician_asc":
        return (
          compareStrings(getPrimaryTicketTechnician(left), getPrimaryTicketTechnician(right)) ||
          compareRecent(left, right)
        );
      case "technician_desc":
        return (
          compareStrings(getPrimaryTicketTechnician(right), getPrimaryTicketTechnician(left)) ||
          compareRecent(left, right)
        );
      case "status":
        return (
          compareStrings(left.status || "", right.status || "") ||
          compareRecent(left, right)
        );
      case "recent_desc":
      default:
        return compareRecent(left, right);
    }
  });

  return nextTickets;
}

export function applyTicketListView(
  tickets: Ticket[],
  args: {
    activeQuickFilter: TicketQuickFilter | null;
    filters: TicketAdvancedFilters;
    searchTerm: string;
    sortBy: TicketSortBy;
  },
) {
  return sortTicketList(
    tickets
      .filter((ticket) => matchesTicketQuickFilter(ticket, args.activeQuickFilter))
      .filter((ticket) => matchesTicketAdvancedFilters(ticket, args.filters))
      .filter((ticket) => matchesTicketSearch(ticket, args.searchTerm)),
    args.sortBy,
  );
}

export function countActiveTicketFilters(filters: TicketAdvancedFilters) {
  let count = 0;

  if (filters.status) count += 1;
  if (filters.priority) count += 1;
  if (filters.client) count += 1;
  if (filters.technician) count += 1;
  if (filters.category) count += 1;
  if (filters.sla) count += 1;
  if (filters.dateFrom || filters.dateTo) count += 1;

  return count;
}

export function getTicketSortLabel(sortBy: TicketSortBy) {
  return TICKET_SORT_OPTIONS.find((option) => option.value === sortBy)?.label
    || TICKET_SORT_OPTIONS[0].label;
}
