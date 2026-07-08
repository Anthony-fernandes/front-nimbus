// Espelho frontend das regras configuráveis de workflow (fonte da verdade: backend common/status_rules.py)

export const WORKFLOW_PHASES = [
  { value: "entrada", label: "Entrada" },
  { value: "triagem", label: "Triagem" },
  { value: "aprovacao", label: "Aprovação" },
  { value: "atendimento", label: "Atendimento" },
  { value: "aguardando_terceiro", label: "Aguardando terceiro" },
  { value: "validacao", label: "Validação" },
  { value: "pausado", label: "Pausado" },
  { value: "final", label: "Final" },
] as const;

export const WORKFLOW_ITEM_TYPES = [
  { value: "ticket", label: "Chamado" },
  { value: "activity", label: "Atividade" },
] as const;

export const PERMISSION_LABELS: Record<string, string> = {
  allows_edit: "Editar campos do item",
  allows_comment: "Comentar",
  allows_attachment: "Anexar arquivos",
  allows_assignment: "Atribuir responsável",
  allows_priority_change: "Alterar prioridade",
  allows_send_to_sprint: "Enviar para sprint",
  allows_backlog: "Enviar para backlog",
  allows_start_work: "Iniciar atendimento",
  allows_pause: "Pausar",
  allows_resume: "Retomar atendimento",
  allows_send_to_validation: "Enviar para validação",
  allows_finish: "Finalizar / resolver",
  allows_cancel: "Cancelar",
  allows_reopen: "Reabrir",
};

export const REQUIREMENT_LABELS: Record<string, string> = {
  requires_reason: "Exigir motivo ao entrar no status",
  requires_comment: "Exigir comentário",
  requires_assignee: "Exigir responsável definido",
  requires_resolution: "Exigir resolução documentada",
  requires_approval: "Exigir aprovação",
};

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSION_LABELS);
export const ALL_REQUIREMENT_KEYS = Object.keys(REQUIREMENT_LABELS);

// Sugestões por fase — usadas para pré-preencher o formulário quando a fase muda
export const PHASE_PERMISSION_DEFAULTS: Record<string, Record<string, boolean>> = {
  entrada: {
    allows_edit: true, allows_comment: true, allows_attachment: true,
    allows_assignment: true, allows_priority_change: true,
    allows_backlog: true, allows_cancel: true,
  },
  triagem: {
    allows_edit: true, allows_comment: true, allows_attachment: true,
    allows_assignment: true, allows_priority_change: true,
    allows_send_to_sprint: true, allows_backlog: true,
    allows_start_work: true, allows_cancel: true,
  },
  aprovacao: { allows_comment: true, allows_attachment: true, allows_cancel: true },
  atendimento: {
    allows_edit: true, allows_comment: true, allows_attachment: true,
    allows_assignment: true, allows_priority_change: true,
    allows_send_to_sprint: true, allows_pause: true,
    allows_send_to_validation: true, allows_finish: true, allows_cancel: true,
  },
  aguardando_terceiro: {
    allows_comment: true, allows_attachment: true,
    allows_resume: true, allows_pause: true, allows_cancel: true,
  },
  validacao: { allows_comment: true, allows_finish: true, allows_resume: true },
  pausado: {
    allows_comment: true, allows_attachment: true,
    allows_resume: true, allows_cancel: true,
  },
  final: { allows_comment: true, allows_reopen: true },
};

export function phasePermissionDefaults(phase: string): Record<string, boolean> {
  const suggested = PHASE_PERMISSION_DEFAULTS[phase] || {};
  const full: Record<string, boolean> = {};
  for (const key of ALL_PERMISSION_KEYS) full[key] = Boolean(suggested[key]);
  return full;
}
