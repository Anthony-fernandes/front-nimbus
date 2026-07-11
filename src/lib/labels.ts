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
    SOLICITACAO: "Solicitação",
    DUVIDA: "Dúvida",
    MUDANCA: "Mudança",
    MUDANÇA: "Mudança",
    REQUISIÇÃO: "Requisição",
    REQUISICAO: "Requisição",
    INCIDENTE: "Incidente",
    PROBLEMA: "Problema",
    OUTRO: "Outro",
    ERRO: "Erro",
    MELHORIA: "Melhoria",
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

/** Badge pill de status de atividade — mesmo visual dos chamados (getTicketStatusClass). */
export function getActivityStatusClass(value?: string | null) {
  switch (normalizeLabelValue(value)) {
    case "BACKLOG":
    case "A FAZER":
      return "bg-muted/60 text-muted-foreground";
    case "EM PROGRESSO":
    case "EM ANDAMENTO":
      return "bg-primary/15 text-primary";
    case "EM REVISAO":
    case "EM VALIDACAO":
      return "bg-accent/15 text-accent";
    case "PAUSADO":
    case "PAUSADA":
      return "bg-muted text-muted-foreground";
    case "BLOQUEADO":
    case "BLOQUEADA":
      return "bg-warning/15 text-warning";
    case "CANCELADO":
    case "CANCELADA":
      return "bg-destructive/15 text-destructive";
    case "CONCLUIDO":
    case "CONCLUIDA":
    case "DONE":
      return "bg-success/15 text-success";
    default:
      return "bg-muted/60 text-muted-foreground";
  }
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
