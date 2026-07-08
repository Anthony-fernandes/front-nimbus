import { getUserRole, isClientRoute, isClientUser, type AppUserRole } from "@/lib/auth";
import type { PermissionBlock, User } from "@/lib/types";

export type PermissionLeaf = boolean | undefined;

export type PermissionMap = {
  tickets?: {
    viewAll?: PermissionLeaf;
    viewOwn?: PermissionLeaf;
    viewAssigned?: PermissionLeaf;
    viewTeam?: PermissionLeaf;
    viewOrganization?: PermissionLeaf;
    create?: PermissionLeaf;
    edit?: PermissionLeaf;
    editOwnBeforeStart?: PermissionLeaf;
    assign?: PermissionLeaf;
    categorize?: PermissionLeaf;
    approve?: PermissionLeaf;
    finish?: PermissionLeaf;
    delete?: PermissionLeaf;
    commentInternal?: PermissionLeaf;
    commentPublic?: PermissionLeaf;
    commentOwn?: PermissionLeaf;
    validateOwn?: PermissionLeaf;
    validateOrganization?: PermissionLeaf;
    rateOwn?: PermissionLeaf;
    attachFiles?: PermissionLeaf;
    manageChecklist?: PermissionLeaf;
    manageTags?: PermissionLeaf;
    manageSla?: PermissionLeaf;
    manageEffort?: PermissionLeaf;
  };
  activities?: {
    view?: PermissionLeaf;
    create?: PermissionLeaf;
    edit?: PermissionLeaf;
    manage?: PermissionLeaf;
    delete?: PermissionLeaf;
    trackTime?: PermissionLeaf;
  };
  projects?: {
    view?: PermissionLeaf;
    create?: PermissionLeaf;
    edit?: PermissionLeaf;
    manage?: PermissionLeaf;
    delete?: PermissionLeaf;
  };
  sprints?: {
    view?: PermissionLeaf;
    create?: PermissionLeaf;
    edit?: PermissionLeaf;
    manage?: PermissionLeaf;
    delete?: PermissionLeaf;
  };
  clients?: {
    view?: PermissionLeaf;
    create?: PermissionLeaf;
    edit?: PermissionLeaf;
    manage?: PermissionLeaf;
    delete?: PermissionLeaf;
  };
  users?: {
    view?: PermissionLeaf;
    create?: PermissionLeaf;
    edit?: PermissionLeaf;
    manage?: PermissionLeaf;
    delete?: PermissionLeaf;
    managePermissions?: PermissionLeaf;
  };
  reports?: {
    view?: PermissionLeaf;
    export?: PermissionLeaf;
  };
  settings?: {
    view?: PermissionLeaf;
    edit?: PermissionLeaf;
  };
  categories?: {
    view?: PermissionLeaf;
    create?: PermissionLeaf;
    edit?: PermissionLeaf;
    manage?: PermissionLeaf;
    delete?: PermissionLeaf;
  };
  permissionBlocks?: {
    view?: PermissionLeaf;
    create?: PermissionLeaf;
    edit?: PermissionLeaf;
    manage?: PermissionLeaf;
    delete?: PermissionLeaf;
  };
};

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

export type PermissionPreset = {
  key: string;
  label: string;
  description: string;
  role: AppUserRole;
};

export type PermissionSummaryItem = {
  permission: string;
  label: string;
  granted: boolean;
  fromBase: boolean;
  fromBlock: boolean;
  fromGrant: boolean;
  deniedDirectly: boolean;
};

type RouteAccessResult = {
  allowed: boolean;
  fallbackTo?: string;
};

const permissionOption = (value: string, label: string, description: string): PermissionOption => ({
  value,
  label,
  description,
});

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "tickets",
    label: "Chamados",
    permissions: [
      permissionOption("tickets.viewAll", "Ver todos os chamados", "Acessa todos os chamados da operacao."),
      permissionOption("tickets.viewOwn", "Ver chamados próprios", "Consulta chamados criados pelo próprio usuário."),
      permissionOption("tickets.viewAssigned", "Ver chamados atribuídos", "Consulta chamados atribuídos diretamente ao usuário."),
      permissionOption("tickets.viewTeam", "Ver chamados da equipe", "Consulta chamados do grupo técnico do usuário."),
      permissionOption("tickets.viewOrganization", "Ver chamados da organização", "Consulta chamados da organização atendida."),
      permissionOption("tickets.create", "Criar chamados", "Permite abrir novos chamados."),
      permissionOption("tickets.edit", "Editar chamados", "Permite editar chamados existentes."),
      permissionOption("tickets.editOwnBeforeStart", "Editar próprio chamado antes do início", "Permite ao cliente ajustar o próprio chamado antes do atendimento iniciar."),
      permissionOption("tickets.assign", "Atribuir chamados", "Define técnico ou equipe responsável."),
      permissionOption("tickets.categorize", "Categorizar chamados", "Define categoria, prioridade, impacto e urgencia."),
      permissionOption("tickets.approve", "Aprovar chamados", "Executa aprovacoes operacionais."),
      permissionOption("tickets.finish", "Finalizar chamados", "Encerra, cancela ou conclui chamados."),
      permissionOption("tickets.delete", "Excluir chamados", "Remove chamados do sistema."),
      permissionOption("tickets.commentInternal", "Comentar internamente", "Registra observacoes internas."),
      permissionOption("tickets.commentPublic", "Comentar publicamente", "Responde para cliente ou solicitante pelo fluxo publico."),
      permissionOption("tickets.commentOwn", "Comentar nos próprios chamados", "Permite ao cliente responder nos próprios chamados."),
      permissionOption("tickets.validateOwn", "Validar próprios chamados", "Permite aprovar ou devolver os próprios chamados em validacao."),
      permissionOption("tickets.validateOrganization", "Validar chamados da organização", "Permite validar chamados da organização atendida."),
      permissionOption("tickets.rateOwn", "Avaliar atendimento", "Permite avaliar chamados concluídos."),
      permissionOption("tickets.attachFiles", "Anexar arquivos", "Permite enviar anexos em chamados."),
      permissionOption("tickets.manageChecklist", "Gerenciar checklist", "Atualiza checklist operacional do chamado."),
      permissionOption("tickets.manageTags", "Gerenciar tags", "Atualiza tags do chamado."),
      permissionOption("tickets.manageSla", "Gerenciar SLA", "Ajusta SLA e prazos operacionais."),
      permissionOption("tickets.manageEffort", "Gerenciar esforco", "Atualiza horas estimadas e realizadas."),
    ],
  },
  {
    key: "activities",
    label: "Atividades",
    permissions: [
      permissionOption("activities.view", "Ver atividades", "Consulta backlog, kanban e atividades."),
      permissionOption("activities.create", "Criar atividades", "Permite cadastrar novas atividades."),
      permissionOption("activities.edit", "Editar atividades", "Permite editar atividades existentes."),
      permissionOption("activities.manage", "Gerenciar atividades", "Permite administrar backlog, kanban e responsáveis."),
      permissionOption("activities.delete", "Excluir atividades", "Permite remover atividades."),
      permissionOption("activities.trackTime", "Apontar horas", "Permite registrar tempo trabalhado."),
    ],
  },
  {
    key: "projects",
    label: "Projetos",
    permissions: [
      permissionOption("projects.view", "Ver projetos", "Consulta projetos e seus detalhes."),
      permissionOption("projects.create", "Criar projetos", "Permite cadastrar novos projetos."),
      permissionOption("projects.edit", "Editar projetos", "Permite editar projetos."),
      permissionOption("projects.manage", "Gerenciar projetos", "Permite gerenciar equipe, cronograma e escopo."),
      permissionOption("projects.delete", "Excluir projetos", "Permite remover projetos."),
    ],
  },
  {
    key: "sprints",
    label: "Sprints",
    permissions: [
      permissionOption("sprints.view", "Ver sprints", "Consulta sprints e planejamento."),
      permissionOption("sprints.create", "Criar sprints", "Permite cadastrar novas sprints."),
      permissionOption("sprints.edit", "Editar sprints", "Permite editar sprints."),
      permissionOption("sprints.manage", "Gerenciar sprints", "Permite planejar e conduzir sprints."),
      permissionOption("sprints.delete", "Excluir sprints", "Permite remover sprints."),
    ],
  },
  {
    key: "clients",
    label: "Organizacoes",
    permissions: [
      permissionOption("clients.view", "Ver organizacoes", "Consulta organizacoes atendidas."),
      permissionOption("clients.create", "Criar organizacoes", "Permite cadastrar organizacoes."),
      permissionOption("clients.edit", "Editar organizacoes", "Permite editar organizacoes."),
      permissionOption("clients.manage", "Gerenciar organizacoes", "Permite administrar relacionamento e dados da organização."),
      permissionOption("clients.delete", "Excluir organizacoes", "Permite remover organizacoes."),
    ],
  },
  {
    key: "users",
    label: "Usuários",
    permissions: [
      permissionOption("users.view", "Ver usuários", "Consulta usuários da plataforma."),
      permissionOption("users.create", "Criar usuários", "Permite cadastrar usuários."),
      permissionOption("users.edit", "Editar usuários", "Permite editar usuários."),
      permissionOption("users.manage", "Gerenciar usuários", "Permite administrar acessos e perfis."),
      permissionOption("users.delete", "Excluir usuários", "Permite remover usuários."),
      permissionOption("users.managePermissions", "Gerenciar permissoes", "Permite aplicar blocos, grants e denies individuais."),
    ],
  },
  {
    key: "reports",
    label: "Relatórios",
    permissions: [
      permissionOption("reports.view", "Ver relatórios", "Consulta dashboards e relatórios."),
      permissionOption("reports.export", "Exportar relatórios", "Permite exportar relatórios."),
    ],
  },
  {
    key: "settings",
    label: "Configurações",
    permissions: [
      permissionOption("settings.view", "Ver configurações", "Consulta configurações do sistema."),
      permissionOption("settings.edit", "Editar configurações", "Altera configurações globais."),
    ],
  },
  {
    key: "categories",
    label: "Categorias",
    permissions: [
      permissionOption("categories.view", "Ver categorias", "Consulta categorias de chamados."),
      permissionOption("categories.create", "Criar categorias", "Permite cadastrar categorias."),
      permissionOption("categories.edit", "Editar categorias", "Permite editar categorias."),
      permissionOption("categories.manage", "Gerenciar categorias", "Permite administrar categorias e regras."),
      permissionOption("categories.delete", "Excluir categorias", "Permite remover categorias."),
    ],
  },
  {
    key: "permissionBlocks",
    label: "Blocos de permissoes",
    permissions: [
      permissionOption("permissionBlocks.view", "Ver blocos de permissoes", "Consulta blocos reutilizáveis de permissões."),
      permissionOption("permissionBlocks.create", "Criar blocos de permissoes", "Permite cadastrar blocos."),
      permissionOption("permissionBlocks.edit", "Editar blocos de permissoes", "Permite editar blocos."),
      permissionOption("permissionBlocks.manage", "Gerenciar blocos de permissoes", "Permite administrar blocos e aplicação."),
      permissionOption("permissionBlocks.delete", "Excluir blocos de permissoes", "Permite remover blocos."),
    ],
  },
];

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    key: "admin",
    label: "Administrador",
    description: "Portal interno com acesso total por padrao.",
    role: "ADMIN",
  },
  {
    key: "technician",
    label: "Técnico",
    description: "Portal interno operacional com acesso controlado por permissões.",
    role: "TECHNICIAN",
  },
  {
    key: "client",
    label: "Cliente",
    description: "Portal do cliente para abrir e acompanhar demandas.",
    role: "CLIENT",
  },
];

export const defaultRolePermissions: Record<AppUserRole, PermissionMap> = {
  ADMIN: {
    tickets: {
      viewAll: true,
      viewOwn: true,
      create: true,
      edit: true,
      assign: true,
      categorize: true,
      approve: true,
      finish: true,
      delete: true,
      commentInternal: true,
      commentPublic: true,
      manageChecklist: true,
      manageTags: true,
      manageSla: true,
      manageEffort: true,
    },
    activities: {
      view: true,
      create: true,
      edit: true,
      manage: true,
      delete: true,
      trackTime: true,
    },
    projects: {
      view: true,
      create: true,
      edit: true,
      manage: true,
      delete: true,
    },
    sprints: {
      view: true,
      create: true,
      edit: true,
      manage: true,
      delete: true,
    },
    clients: {
      view: true,
      create: true,
      edit: true,
      manage: true,
      delete: true,
    },
    users: {
      view: true,
      create: true,
      edit: true,
      manage: true,
      delete: true,
      managePermissions: true,
    },
    reports: {
      view: true,
      export: true,
    },
    settings: {
      view: true,
      edit: true,
    },
    categories: {
      view: true,
      create: true,
      edit: true,
      manage: true,
      delete: true,
    },
    permissionBlocks: {
      view: true,
      create: true,
      edit: true,
      manage: true,
      delete: true,
    },
  },
  TECHNICIAN: {
    tickets: {
      viewAssigned: true,
      viewTeam: true,
      viewOwn: true,
      create: true,
      edit: true,
      categorize: true,
      finish: true,
      commentInternal: true,
      commentPublic: true,
      manageChecklist: true,
      manageEffort: true,
    },
    activities: {
      view: true,
      create: true,
      edit: true,
      trackTime: true,
    },
    projects: {
      view: true,
    },
    sprints: {
      view: true,
    },
    clients: {
      view: true,
    },
    categories: {
      view: true,
    },
  },
  CLIENT: {
    tickets: {
      viewOwn: true,
      create: true,
      editOwnBeforeStart: true,
      commentOwn: true,
      validateOwn: true,
      rateOwn: true,
      attachFiles: true,
    },
  },
};

const PERMISSION_LABELS = new Map(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => [permission.value, permission.label] as const),
  ),
);

const permissionDefinitions = PERMISSION_GROUPS.flatMap((group) => group.permissions);

function isPermissionRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clonePermissionMap(map: PermissionMap | null | undefined): PermissionMap {
  if (!isPermissionRecord(map)) {
    return {};
  }

  const clone: Record<string, unknown> = {};
  Object.entries(map).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      clone[key] = value;
      return;
    }

    if (isPermissionRecord(value)) {
      clone[key] = clonePermissionMap(value as PermissionMap);
    }
  });

  return clone as PermissionMap;
}

function mergeTwoPermissions(base: PermissionMap, extra: PermissionMap): PermissionMap {
  const result = clonePermissionMap(base);

  Object.entries(extra || {}).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      (result as Record<string, unknown>)[key] = value;
      return;
    }

    if (isPermissionRecord(value)) {
      const current = isPermissionRecord((result as Record<string, unknown>)[key])
        ? ((result as Record<string, unknown>)[key] as PermissionMap)
        : {};

      (result as Record<string, unknown>)[key] = mergeTwoPermissions(current, value as PermissionMap);
    }
  });

  return result;
}

function getPermissionMapFromUnknown(value: unknown): PermissionMap {
  return isPermissionRecord(value) ? (value as PermissionMap) : {};
}

function getPermissionValueFromMap(map: PermissionMap | null | undefined, path: string) {
  const segments = path.split(".");
  let current: unknown = map;

  for (const segment of segments) {
    if (!isPermissionRecord(current)) {
      return false;
    }

    current = current[segment];
  }

  return current === true;
}

function setPermissionValue(
  map: PermissionMap,
  path: string,
  value: boolean,
) {
  const segments = path.split(".");
  const next = clonePermissionMap(map);
  let current: Record<string, unknown> = next as Record<string, unknown>;

  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }

    if (!isPermissionRecord(current[segment])) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  });

  return next;
}

export function mergePermissions(...maps: Array<PermissionMap | null | undefined>) {
  return maps.reduce<PermissionMap>(
    (result, map) => mergeTwoPermissions(result, getPermissionMapFromUnknown(map)),
    {},
  );
}

export function applyDeniedPermissions(
  basePermissions: PermissionMap | null | undefined,
  deniedPermissions: PermissionMap | null | undefined,
) {
  const result = clonePermissionMap(basePermissions);

  Object.entries(getPermissionMapFromUnknown(deniedPermissions)).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      if (value) {
        (result as Record<string, unknown>)[key] = false;
      }
      return;
    }

    if (isPermissionRecord(value)) {
      const current = isPermissionRecord((result as Record<string, unknown>)[key])
        ? ((result as Record<string, unknown>)[key] as PermissionMap)
        : {};

      (result as Record<string, unknown>)[key] = applyDeniedPermissions(current, value as PermissionMap);
    }
  });

  return result;
}

export function permissionMapFromKeys(permissionKeys: string[]) {
  return permissionKeys.reduce<PermissionMap>((result, key) => setPermissionValue(result, key, true), {});
}

export function flattenGrantedPermissions(map: PermissionMap | null | undefined) {
  return permissionDefinitions
    .filter((permission) => getPermissionValueFromMap(map, permission.value))
    .map((permission) => permission.value);
}

function getLegacyGrantedPermissions(user: Pick<User, "permissions_json"> | null | undefined) {
  const permissionKeys = Array.isArray(user?.permissions_json) ? user.permissions_json : [];
  return permissionMapFromKeys(permissionKeys);
}

export function getPermissionLabel(permission: string) {
  return PERMISSION_LABELS.get(permission) || permission;
}

export function getPermissionOption(permission: string) {
  return permissionDefinitions.find((item) => item.value === permission) || null;
}

export function getPermissionBlocks(user: Partial<User> | null | undefined) {
  return Array.isArray(user?.permission_blocks_data)
    ? user.permission_blocks_data.filter((block) => block.active !== false)
    : [];
}

export function getGrantedPermissionMap(user: Partial<User> | null | undefined) {
  if (isPermissionRecord(user?.granted_permissions)) {
    return user?.granted_permissions as PermissionMap;
  }

  return getLegacyGrantedPermissions(user as Pick<User, "permissions_json"> | null | undefined);
}

export function getDeniedPermissionMap(user: Partial<User> | null | undefined) {
  return getPermissionMapFromUnknown(user?.denied_permissions);
}

export function resolveUserPermissions(user: Partial<User> | null | undefined) {
  const role = getUserRole(user);
  const basePermissions = role ? defaultRolePermissions[role] || {} : {};
  const blockPermissions = mergePermissions(
    ...getPermissionBlocks(user).map((block) => block.permissions || {}),
  );
  const grantedPermissions = getGrantedPermissionMap(user);
  const deniedPermissions = getDeniedPermissionMap(user);

  return applyDeniedPermissions(
    mergePermissions(basePermissions, blockPermissions, grantedPermissions),
    deniedPermissions,
  );
}

export function getPermissionSummary(user: Partial<User> | null | undefined): PermissionSummaryItem[] {
  const role = getUserRole(user);
  const basePermissions = role ? defaultRolePermissions[role] || {} : {};
  const blockPermissions = mergePermissions(
    ...getPermissionBlocks(user).map((block) => block.permissions || {}),
  );
  const grantedPermissions = getGrantedPermissionMap(user);
  const deniedPermissions = getDeniedPermissionMap(user);
  const finalPermissions = resolveUserPermissions(user);

  return permissionDefinitions.map((permission) => ({
    permission: permission.value,
    label: permission.label,
    granted: getPermissionValueFromMap(finalPermissions, permission.value),
    fromBase: getPermissionValueFromMap(basePermissions, permission.value),
    fromBlock: getPermissionValueFromMap(blockPermissions, permission.value),
    fromGrant: getPermissionValueFromMap(grantedPermissions, permission.value),
    deniedDirectly: getPermissionValueFromMap(deniedPermissions, permission.value),
  }));
}

export function hasPermission(
  user: Partial<User> | null | undefined,
  permission: string,
) {
  return getPermissionValueFromMap(resolveUserPermissions(user), permission);
}

export function hasAnyPermission(
  user: Partial<User> | null | undefined,
  permissions: string[],
) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function canApproveTickets(user: Partial<User> | null | undefined) {
  return hasPermission(user, "tickets.approve");
}

export function canManageTickets(user: Partial<User> | null | undefined) {
  return hasAnyPermission(user, [
    "tickets.viewAll",
    "tickets.viewAssigned",
    "tickets.viewTeam",
    "tickets.viewOwn",
    "tickets.edit",
  ]);
}

export function canCategorizeTickets(user: Partial<User> | null | undefined) {
  return hasPermission(user, "tickets.categorize");
}

export function canFinalizeTickets(user: Partial<User> | null | undefined) {
  return hasPermission(user, "tickets.finish");
}

export function canManageTicketCategories(user: Partial<User> | null | undefined) {
  return hasAnyPermission(user, ["categories.manage", "categories.edit", "settings.edit"]);
}

export function canManagePermissionBlocks(user: Partial<User> | null | undefined) {
  return hasAnyPermission(user, [
    "permissionBlocks.manage",
    "permissionBlocks.edit",
    "users.managePermissions",
  ]);
}

function getDeniedFallback(user: Partial<User> | null | undefined) {
  return isClientUser(user) ? "/client" : "/";
}

function canAccessInternalPath(user: Partial<User> | null | undefined, pathname: string): RouteAccessResult {
  if (isClientUser(user)) {
    return { allowed: false, fallbackTo: getDeniedFallback(user) };
  }

  if (pathname === "/" || pathname === "/admin") {
    return { allowed: true };
  }

  if (pathname.startsWith("/superadmin")) {
    return {
      allowed: !!(user?.is_staff || user?.is_superuser),
      fallbackTo: "/access-denied",
    };
  }

  if (pathname.startsWith("/tickets")) {
    if (pathname.endsWith("/new")) {
      return { allowed: hasPermission(user, "tickets.create"), fallbackTo: getDeniedFallback(user) };
    }

    if (pathname.endsWith("/edit")) {
      return { allowed: hasPermission(user, "tickets.edit"), fallbackTo: getDeniedFallback(user) };
    }

    return {
      allowed: hasAnyPermission(user, [
        "tickets.viewAll",
        "tickets.viewAssigned",
        "tickets.viewTeam",
        "tickets.viewOwn",
        "tickets.create",
      ]),
      fallbackTo: getDeniedFallback(user),
    };
  }

  if (pathname.startsWith("/projects")) {
    if (pathname.endsWith("/new")) {
      return { allowed: hasPermission(user, "projects.create"), fallbackTo: getDeniedFallback(user) };
    }

    if (pathname.endsWith("/edit")) {
      return {
        allowed: hasAnyPermission(user, ["projects.edit", "projects.manage"]),
        fallbackTo: getDeniedFallback(user),
      };
    }

    return { allowed: hasPermission(user, "projects.view"), fallbackTo: getDeniedFallback(user) };
  }

  if (pathname.startsWith("/sprints")) {
    if (pathname.endsWith("/new") || pathname.endsWith("/nova")) {
      return { allowed: hasPermission(user, "sprints.create"), fallbackTo: getDeniedFallback(user) };
    }

    if (pathname.endsWith("/edit") || pathname.endsWith("/editar")) {
      return {
        allowed: hasAnyPermission(user, ["sprints.edit", "sprints.manage"]),
        fallbackTo: getDeniedFallback(user),
      };
    }

    return { allowed: hasPermission(user, "sprints.view"), fallbackTo: getDeniedFallback(user) };
  }

  if (pathname.startsWith("/clients")) {
    if (pathname.endsWith("/new")) {
      return { allowed: hasPermission(user, "clients.create"), fallbackTo: getDeniedFallback(user) };
    }

    if (pathname.endsWith("/edit")) {
      return {
        allowed: hasAnyPermission(user, ["clients.edit", "clients.manage"]),
        fallbackTo: getDeniedFallback(user),
      };
    }

    return { allowed: hasPermission(user, "clients.view"), fallbackTo: getDeniedFallback(user) };
  }

  if (pathname.startsWith("/teams")) {
    if (pathname.endsWith("/new")) {
      return {
        allowed: hasAnyPermission(user, ["users.managePermissions", "users.manage"]),
        fallbackTo: getDeniedFallback(user),
      };
    }

    if (pathname.endsWith("/edit")) {
      return {
        allowed: hasAnyPermission(user, ["users.managePermissions", "users.manage"]),
        fallbackTo: getDeniedFallback(user),
      };
    }

    return {
      allowed: hasAnyPermission(user, ["users.view", "users.manage", "users.managePermissions"]),
      fallbackTo: getDeniedFallback(user),
    };
  }

  if (pathname.startsWith("/reports")) {
    return { allowed: hasPermission(user, "reports.view"), fallbackTo: getDeniedFallback(user) };
  }

  if (pathname.startsWith("/settings")) {
    return {
      allowed: hasAnyPermission(user, [
        "settings.view",
        "settings.edit",
        "permissionBlocks.view",
        "categories.view",
      ]),
      fallbackTo: getDeniedFallback(user),
    };
  }

  if (pathname.startsWith("/ticket-categories")) {
    return {
      allowed: hasAnyPermission(user, ["categories.view", "categories.manage"]),
      fallbackTo: getDeniedFallback(user),
    };
  }

  if (pathname.startsWith("/permission-blocks")) {
    return {
      allowed: hasAnyPermission(user, ["permissionBlocks.view", "permissionBlocks.manage"]),
      fallbackTo: getDeniedFallback(user),
    };
  }

  if (pathname.startsWith("/knowledge") || pathname.startsWith("/forum") || pathname.startsWith("/doubts") || pathname.startsWith("/chat")) {
    return { allowed: hasAnyPermission(user, ["knowledge.view", "communication.view", "activities.view"]), fallbackTo: getDeniedFallback(user) };
  }

  if (pathname.startsWith("/org")) {
    return { allowed: hasAnyPermission(user, ["users.manage", "users.managePermissions"]), fallbackTo: getDeniedFallback(user) };
  }

  if (pathname.startsWith("/notification-preferences")) {
    return { allowed: true };
  }

  if (pathname.startsWith("/audit")) {
    return { allowed: hasAnyPermission(user, ["settings.view", "settings.edit"]) || getUserRole(user) === "ADMIN", fallbackTo: getDeniedFallback(user) };
  }

  if (pathname.startsWith("/webhooks")) {
    return { allowed: getUserRole(user) === "ADMIN", fallbackTo: getDeniedFallback(user) };
  }

  if (pathname.startsWith("/kanban") || pathname.startsWith("/backlog") || pathname.startsWith("/activities")) {
    if (pathname.endsWith("/new") || pathname.endsWith("/nova")) {
      return { allowed: hasPermission(user, "activities.create"), fallbackTo: getDeniedFallback(user) };
    }

    if (pathname.endsWith("/edit") || pathname.endsWith("/editar")) {
      return {
        allowed: hasAnyPermission(user, ["activities.edit", "activities.manage"]),
        fallbackTo: getDeniedFallback(user),
      };
    }

    return {
      allowed: hasAnyPermission(user, ["activities.view", "projects.view", "sprints.view"]),
      fallbackTo: getDeniedFallback(user),
    };
  }

  return { allowed: true };
}

function canAccessClientPath(user: Partial<User> | null | undefined, pathname: string): RouteAccessResult {
  if (!isClientUser(user)) {
    return { allowed: false, fallbackTo: getDeniedFallback(user) };
  }

  if (pathname === "/client") {
    return { allowed: true };
  }

  if (pathname.startsWith("/client/tickets/new")) {
    return { allowed: hasPermission(user, "tickets.create"), fallbackTo: getDeniedFallback(user) };
  }

  if (pathname.startsWith("/client/tickets")) {
    return {
      allowed: hasAnyPermission(user, [
        "tickets.viewOwn",
        "tickets.viewOrganization",
        "tickets.create",
      ]),
      fallbackTo: getDeniedFallback(user),
    };
  }

  if (pathname.startsWith("/client/validations")) {
    return {
      allowed: hasAnyPermission(user, [
        "tickets.validateOwn",
        "tickets.validateOrganization",
      ]),
      fallbackTo: getDeniedFallback(user),
    };
  }

  if (pathname.startsWith("/client/ratings")) {
    return { allowed: hasPermission(user, "tickets.rateOwn"), fallbackTo: getDeniedFallback(user) };
  }

  if (pathname.startsWith("/client/projects")) {
    return { allowed: false, fallbackTo: getDeniedFallback(user) };
  }

  return { allowed: true };
}

export function canAccessPath(
  user: Partial<User> | null | undefined,
  pathname: string,
): RouteAccessResult {
  if (!user) {
    return { allowed: false, fallbackTo: "/login" };
  }

  if (pathname === "/login" || pathname === "/access-denied") {
    return { allowed: true };
  }

  if (isClientRoute(pathname)) {
    return canAccessClientPath(user, pathname);
  }

  return canAccessInternalPath(user, pathname);
}

export function countEnabledPermissions(map: PermissionMap | null | undefined) {
  return flattenGrantedPermissions(map).length;
}

export function getPermissionBlockLabel(block: Pick<PermissionBlock, "name">) {
  return block.name;
}
