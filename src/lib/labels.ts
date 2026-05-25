function normalizeLabelValue(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s/_-]+/g, " ");
}

function resolveLabel(
  value: string | null | undefined,
  map: Record<string, string>,
) {
  const normalizedValue = normalizeLabelValue(value);
  return map[normalizedValue] || value || "-";
}

export function formatTicketTypeLabel(value?: string | null) {
  return resolveLabel(value, {
    SOLICITACAO: "Solicitacao",
    DUVIDA: "Duvida",
    MUDANCA: "Mudanca",
  });
}

export function formatTicketStatusLabel(value?: string | null) {
  return resolveLabel(value, {
    "AGUARDANDO APROVACAO": "Aguardando aprovacao",
    "TRIAGEM CATEGORIZACAO": "Triagem",
    TRIAGEM: "Triagem",
    "AGUARDANDO ATENDIMENTO": "Aguardando atendimento",
    "VALIDACAO AVALIACAO": "Em validacao",
    VALIDACAO: "Em validacao",
    "EM VALIDACAO": "Em validacao",
  });
}

export function formatPriorityLabel(value?: string | null) {
  return resolveLabel(value, {
    CRITICA: "Critica",
    MEDIA: "Media",
  });
}

export function formatImpactLabel(value?: string | null) {
  return resolveLabel(value, {
    MEDIO: "Medio",
  });
}

export function formatUrgencyLabel(value?: string | null) {
  return resolveLabel(value, {
    MEDIA: "Media",
  });
}

export function formatActivityTypeLabel(value?: string | null) {
  return resolveLabel(value, {
    HISTORIA: "Historia",
  });
}

export function formatActivityStatusLabel(value?: string | null) {
  return resolveLabel(value, {
    "EM REVISAO": "Em revisao",
    CONCLUIDO: "Concluido",
  });
}

export function formatProjectStatusLabel(value?: string | null) {
  return resolveLabel(value, {
    CONCLUIDO: "Concluido",
  });
}

export function formatSprintStatusLabel(value?: string | null) {
  return resolveLabel(value, {
    CONCLUIDA: "Concluida",
  });
}
