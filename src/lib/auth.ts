import type { User } from "@/lib/types";

export type HomeRoute = "/" | "/client";
export type AppUserRole = "ADMIN" | "TECHNICIAN" | "CLIENT";

export type CreateRoute =
  | "/activities/new"
  | "/clients/new"
  | "/projects/new"
  | "/sprints/new"
  | "/teams/new"
  | "/tickets/new"
  | "/client/tickets/new";

function slugifyRole(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function getRelationId(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "id" in value) {
    const relationId = (value as { id?: string | number | null }).id;
    return relationId == null ? null : String(relationId);
  }
  return null;
}

function getRelationName(value: unknown) {
  if (value && typeof value === "object" && "name" in value) {
    const relationName = (value as { name?: string | null }).name;
    return relationName || null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeUserRole(role: unknown): AppUserRole | undefined {
  const normalized = slugifyRole(role);

  switch (normalized) {
    case "ADMIN":
    case "ADMINISTRADOR":
    case "ADMINISTRATOR":
    case "SUPERUSER":
    case "SUPER_USER":
      return "ADMIN";
    case "MANAGER":
    case "GESTOR":
    case "GESTAO":
    case "COORDENACAO":
    case "COORDENADOR":
    case "PROJECT_LEAD":
    case "LIDER_PROJETO":
    case "LIDER_DE_PROJETO":
    case "LEAD":
    case "SUPERVISOR":
    case "COLLABORATOR":
    case "COLABORADOR":
      return "TECHNICIAN";
    case "TECH":
    case "TECNICO":
    case "TECHNICIAN":
    case "SUPORTE":
    case "SUPPORT":
      return "TECHNICIAN";
    case "CLIENT":
    case "CLIENTE":
    case "CUSTOMER":
    case "REQUESTER":
    case "SOLICITANTE":
    case "OBSERVER":
    case "OBSERVADOR":
    case "APPROVER":
    case "APROVADOR":
      return "CLIENT";
    default:
      return normalized ? (normalized as AppUserRole) : undefined;
  }
}

export function getUserRole(user: Partial<User> | null | undefined) {
  return normalizeUserRole(user?.role);
}

export function getRoleLabel(role: unknown) {
  switch (normalizeUserRole(role)) {
    case "ADMIN":
      return "Administrador";
    case "TECHNICIAN":
      return "Técnico";
    case "CLIENT":
      return "Cliente";
    default:
      return "Usuário";
  }
}

export function normalizeUser(user: User | null | undefined): User | null {
  if (!user) return null;

  const client = getRelationId(user.client);
  const clientId = getRelationId(user.client_id) || client;
  const organizationId = getRelationId(user.organization_id) || clientId;
  const clientName =
    user.client_name || user.organization_name || getRelationName(user.client) || null;
  const organizationLinks = Array.isArray(user.organization_links)
    ? user.organization_links.filter((link) => isRecord(link))
    : [];

  return {
    ...user,
    role: normalizeUserRole(user.role) || user.role,
    client: client || clientId || organizationId,
    client_id: clientId || client || organizationId,
    client_name: clientName || undefined,
    organization_id: organizationId || client || clientId,
    organization_name: clientName || undefined,
    organization_links: organizationLinks,
  };
}

export function getUserDisplayName(user: Partial<User> | null | undefined) {
  return (
    user?.name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    user?.email ||
    "Usuário"
  );
}

export function getUserInitials(user: Partial<User> | null | undefined) {
  return (
    getUserDisplayName(user)
      .split(" ")
      .map((segment) => segment[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "US"
  );
}

export function isClientUser(user: Partial<User> | null | undefined) {
  return getUserRole(user) === "CLIENT";
}

export function isInternalUser(user: Partial<User> | null | undefined) {
  const role = getUserRole(user);
  return role === "ADMIN" || role === "TECHNICIAN";
}

export function isClientRoute(pathname: string) {
  return pathname === "/client" || pathname.startsWith("/client/");
}

export function getUserClientId(user: Partial<User> | null | undefined) {
  return (
    getRelationId(user?.client)
    || getRelationId(user?.client_id)
    || getRelationId(user?.organization_id)
    || null
  );
}

export function getUserClientName(user: Partial<User> | null | undefined) {
  return user?.client_name || user?.organization_name || null;
}

export function getUserOrganizationIds(user: Partial<User> | null | undefined) {
  const normalized = normalizeUser(user as User | null);
  const links = Array.isArray(normalized?.organization_links)
    ? normalized.organization_links
    : [];
  const ids = new Set<string>();

  const primaryId = getUserClientId(normalized);
  if (primaryId) {
    ids.add(primaryId);
  }

  links.forEach((link) => {
    const relationId =
      getRelationId(link)
      || (isRecord(link) ? getRelationId(link.organization) : null)
      || (isRecord(link) ? getRelationId(link.organization_id) : null);

    if (relationId) {
      ids.add(relationId);
    }
  });

  return Array.from(ids);
}

export function hasClientScope(user: Partial<User> | null | undefined) {
  return Boolean(getUserClientId(user));
}

export function getHomeRoute(user: Partial<User> | null | undefined): HomeRoute {
  return isClientUser(user) ? "/client" : "/";
}

export function getCreateRoute(
  pathname: string,
  user: Partial<User> | null | undefined,
): CreateRoute {
  if (isClientUser(user)) return "/client/tickets/new";
  if (pathname.startsWith("/projects")) return "/projects/new";
  if (pathname.startsWith("/sprints")) return "/sprints/new";
  if (pathname.startsWith("/activities") || pathname.startsWith("/backlog")) {
    return "/activities/new";
  }
  if (pathname.startsWith("/teams")) return "/teams/new";
  if (pathname.startsWith("/clients")) return "/clients/new";
  return "/tickets/new";
}
