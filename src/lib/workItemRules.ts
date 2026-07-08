/**
 * Matriz central de ações permitidas por status (espelho de
 * back-nimbus/common/status_rules.py). Use para esconder/desabilitar
 * botões com motivo claro — o backend valida de novo por segurança.
 */

export type WorkItemAction =
  | "edit"
  | "start"
  | "pause"
  | "resume"
  | "validate"
  | "resolve"
  | "reopen"
  | "cancel"
  | "priority"
  | "responsible"
  | "sprint";

const TICKET_ACTIONS: Record<string, Set<WorkItemAction>> = {
  Aberto: new Set(["edit", "priority", "responsible", "cancel"]),
  Triagem: new Set(["edit", "priority", "responsible", "cancel", "sprint", "start"]),
  "Aguardando Aprovacao": new Set(["cancel"]),
  Aprovado: new Set(["responsible", "sprint", "priority", "start"]),
  Reprovado: new Set(["reopen"]),
  "Aguardando atendimento": new Set(["edit", "start", "priority", "responsible", "sprint", "cancel"]),
  "Em atendimento": new Set(["edit", "pause", "validate", "resolve", "cancel", "responsible", "sprint", "priority"]),
  "Aguardando cliente": new Set(["resume", "pause", "cancel", "responsible"]),
  Validacao: new Set(["resolve", "resume"]),
  Pausado: new Set(["resume", "cancel"]),
  Cancelado: new Set(["reopen"]),
  Finalizado: new Set(["reopen"]),
};

const ACTIVITY_ACTIONS: Record<string, Set<WorkItemAction>> = {
  Backlog: new Set(["edit", "priority", "responsible", "sprint", "start"]),
  "A fazer": new Set(["edit", "start", "priority", "responsible", "sprint", "pause"]),
  "Em progresso": new Set(["edit", "pause", "validate", "resolve", "responsible", "sprint", "priority"]),
  "Em revisao": new Set(["resolve", "resume"]),
  Bloqueado: new Set(["resume", "sprint"]),
  "Concluída": new Set(["reopen"]),
  Concluido: new Set(["reopen"]),
  "Concluído": new Set(["reopen"]),
  Cancelado: new Set(["reopen"]),
  Cancelada: new Set(["reopen"]),
};

const BLOCK_REASONS: Partial<Record<WorkItemAction, string>> = {
  edit: "Itens encerrados não podem ser editados. Reabra para alterar.",
  start: "Este item não pode iniciar atendimento no status atual.",
  resolve: "Finalize apenas itens em atendimento/progresso ou em validação.",
  sprint: "Este item não pode ser enviado para sprint no status atual.",
  priority: "A prioridade não pode ser alterada neste status.",
  responsible: "O responsável não pode ser alterado neste status.",
  reopen: "Apenas itens encerrados podem ser reabertos.",
  validate: "Envie para validação apenas itens em atendimento.",
  pause: "Este item não pode ser pausado/bloqueado agora.",
  resume: "Este item não está pausado ou aguardando.",
  cancel: "Este item não pode ser cancelado neste status.",
};

export function canPerformAction(
  backend: "ticket" | "activity",
  status: string,
  action: WorkItemAction,
): boolean {
  const table = backend === "ticket" ? TICKET_ACTIONS : ACTIVITY_ACTIONS;
  return table[status]?.has(action) ?? false;
}

export function actionBlockReason(action: WorkItemAction): string {
  return BLOCK_REASONS[action] || "Esta ação não é permitida para o status atual.";
}

export const TICKET_SPRINT_ELIGIBLE = new Set([
  "Triagem", "Aprovado", "Aguardando atendimento", "Em atendimento",
]);
export const ACTIVITY_SPRINT_ELIGIBLE = new Set([
  "Backlog", "A fazer", "Em progresso", "Bloqueado",
]);

export function canSendToSprint(type: string, status: string): boolean {
  return type === "ticket"
    ? TICKET_SPRINT_ELIGIBLE.has(status)
    : ACTIVITY_SPRINT_ELIGIBLE.has(status);
}
