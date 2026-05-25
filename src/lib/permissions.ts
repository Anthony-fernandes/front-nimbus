import { getUserRole } from "@/lib/auth";
import type { User } from "@/lib/types";

export type PermissionOption = {
  value: string;
  label: string;
  description: string;
};

export type PermissionGroup = {
  key: string;
  label: string;
  permissions: PermissionOption[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "operations",
    label: "Operacao",
    permissions: [
      {
        value: "tickets.view",
        label: "Ver chamados",
        description: "Consultar chamados e acompanhar status.",
      },
      {
        value: "tickets.manage",
        label: "Gerenciar chamados",
        description: "Criar, editar, atribuir e encerrar chamados.",
      },
      {
        value: "tickets.categorize",
        label: "Categorizar chamados",
        description: "Definir categoria, prioridade, impacto, SLA e equipe responsável.",
      },
      {
        value: "tickets.approve",
        label: "Aprovar chamados",
        description: "Aprovar ou reprovar chamados que exigem autorizacao.",
      },
      {
        value: "tickets.finalize",
        label: "Finalizar chamados",
        description: "Cancelar, validar e finalizar chamados.",
      },
      {
        value: "activities.view",
        label: "Ver atividades",
        description: "Consultar backlog, kanban e tarefas.",
      },
      {
        value: "activities.manage",
        label: "Gerenciar atividades",
        description: "Criar e atualizar atividades de projeto.",
      },
    ],
  },
  {
    key: "delivery",
    label: "Entrega",
    permissions: [
      {
        value: "projects.view",
        label: "Ver projetos",
        description: "Consultar projetos, progresso e custos.",
      },
      {
        value: "projects.manage",
        label: "Gerenciar projetos",
        description: "Criar projetos, atualizar escopo e equipe.",
      },
      {
        value: "sprints.view",
        label: "Ver sprints",
        description: "Acompanhar sprints e capacidade.",
      },
      {
        value: "sprints.manage",
        label: "Gerenciar sprints",
        description: "Planejar, iniciar e fechar sprints.",
      },
    ],
  },
  {
    key: "accounts",
    label: "Relacionamento",
    permissions: [
      {
        value: "clients.view",
        label: "Ver clientes",
        description: "Consultar carteira, contatos e saude da conta.",
      },
      {
        value: "clients.manage",
        label: "Gerenciar clientes",
        description: "Criar e atualizar clientes e contratos.",
      },
      {
        value: "reports.view",
        label: "Ver relatorios",
        description: "Acessar dashboards e relatorios consolidados.",
      },
    ],
  },
  {
    key: "admin",
    label: "Administracao",
    permissions: [
      {
        value: "users.view",
        label: "Ver usuários",
        description: "Consultar usuários, perfis e cargas.",
      },
      {
        value: "users.manage",
        label: "Gerenciar usuários",
        description: "Criar usuários, redefinir acessos e editar perfis.",
      },
      {
        value: "settings.manage",
        label: "Configurar workspace",
        description: "Alterar configurações gerais da aplicação.",
      },
      {
        value: "ticket-categories.manage",
        label: "Gerenciar categorias",
        description: "Cadastrar categorias, regras de SLA, aprovação e conversão.",
      },
    ],
  },
];

export const PERMISSION_PRESETS = [
  {
    key: "admin",
    label: "Administrador",
    description: "Acesso completo ao workspace.",
    permissions: PERMISSION_GROUPS.flatMap((group) =>
      group.permissions.map((permission) => permission.value),
    ),
  },
  {
    key: "manager",
    label: "Coordenacao",
    description: "Gestao de operacao, entrega e relatorios.",
    permissions: [
      "tickets.view",
      "tickets.manage",
      "tickets.categorize",
      "tickets.approve",
      "tickets.finalize",
      "activities.view",
      "activities.manage",
      "projects.view",
      "projects.manage",
      "sprints.view",
      "sprints.manage",
      "clients.view",
      "clients.manage",
      "reports.view",
      "users.view",
      "ticket-categories.manage",
    ],
  },
  {
    key: "operator",
    label: "Operacao",
    description: "Atendimento diario, backlog e acompanhamento.",
    permissions: [
      "tickets.view",
      "tickets.manage",
      "tickets.categorize",
      "activities.view",
      "activities.manage",
      "projects.view",
      "sprints.view",
      "clients.view",
    ],
  },
  {
    key: "client",
    label: "Cliente",
    description: "Consulta limitada a chamados e projetos.",
    permissions: ["tickets.view", "projects.view", "clients.view"],
  },
];

const PERMISSION_LABELS = new Map(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => [permission.value, permission.label] as const),
  ),
);

export function dedupePermissions(permissions: string[]) {
  return Array.from(new Set(permissions)).sort();
}

export function getPermissionLabel(permission: string) {
  return PERMISSION_LABELS.get(permission) || permission;
}

export function hasPermission(
  user: Pick<User, "role" | "permissions_json"> | null | undefined,
  permission: string,
) {
  const role = getUserRole(user);

  if (role === "ADMIN") return true;
  if (user?.permissions_json?.includes(permission)) return true;
  if (user?.permissions_json?.includes("settings.manage")) return true;

  return false;
}

export function hasAnyPermission(
  user: Pick<User, "role" | "permissions_json"> | null | undefined,
  permissions: string[],
) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function canApproveTickets(user: Pick<User, "role" | "permissions_json"> | null | undefined) {
  const role = getUserRole(user);
  return role === "ADMIN" || role === "MANAGER" || hasPermission(user, "tickets.approve");
}

export function canManageTickets(
  user: Pick<User, "role" | "permissions_json"> | null | undefined,
) {
  const role = getUserRole(user);
  return (
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "TECHNICIAN" ||
    hasPermission(user, "tickets.manage")
  );
}

export function canCategorizeTickets(
  user: Pick<User, "role" | "permissions_json"> | null | undefined,
) {
  const role = getUserRole(user);
  return (
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "TECHNICIAN" ||
    hasPermission(user, "tickets.categorize")
  );
}

export function canFinalizeTickets(
  user: Pick<User, "role" | "permissions_json"> | null | undefined,
) {
  const role = getUserRole(user);
  return role === "ADMIN" || role === "MANAGER" || hasPermission(user, "tickets.finalize");
}

export function canManageTicketCategories(
  user: Pick<User, "role" | "permissions_json"> | null | undefined,
) {
  const role = getUserRole(user);
  return role === "ADMIN" || hasPermission(user, "ticket-categories.manage");
}
