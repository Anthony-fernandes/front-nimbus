import type { MemberFormData } from "@/components/forms/MemberForm";
import { getUserOrganizationIds, getUserRole, normalizeUser } from "@/lib/auth";
import {
  flattenGrantedPermissions,
  permissionMapFromKeys,
} from "@/lib/permissions";
import type { User } from "@/lib/types";

import {
  createResource,
  deleteResource,
  getResource,
  listResource,
  updateResource,
} from "./crud";
import { formatCurrencyInput, parseCurrencyInput, requireId, toNumber } from "./utils";

const ENDPOINT = "/users";

function splitName(name: string) {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { first_name: firstName, last_name: rest.join(" ") };
}

export function listUsers(params?: Record<string, unknown>) {
  return listResource<User>(ENDPOINT, params).then((users) =>
    users
      .map((user) => normalizeUser(user))
      .filter((user): user is User => Boolean(user)),
  );
}

export function getUser(id: string) {
  return getResource<User>(ENDPOINT, id).then((user) => normalizeUser(user) || user);
}

export function createUser(payload: Partial<User> & { password?: string }) {
  return createResource<User>(ENDPOINT, payload).then((user) => normalizeUser(user) || user);
}

export function updateUser(id: string, payload: Partial<User> & { password?: string }) {
  return updateResource<User>(ENDPOINT, id, payload).then((user) => normalizeUser(user) || user);
}

export function deleteUser(id: string) {
  return deleteResource(ENDPOINT, id);
}

function getStatusCode(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status;
}

function canRetryWithLegacyPayload(error: unknown) {
  const status = getStatusCode(error);
  return status === 400 || status === 404;
}

export async function saveMember(
  data: MemberFormData,
  mode: "create" | "edit",
  userId?: string,
  options?: { includePermissionConfig?: boolean },
) {
  requireId(mode, userId);

  const names = splitName(data.name);
  const selectedOrganizationIds = Array.from(
    new Set([data.primaryOrganization, ...data.organizationAccessIds].filter(Boolean)),
  );
  const grantedPermissions = permissionMapFromKeys(data.grantedPermissionKeys);
  const deniedPermissions = permissionMapFromKeys(data.deniedPermissionKeys);
  const legacyPermissionKeys = flattenGrantedPermissions(grantedPermissions);

  const legacyPayload = {
    username: data.username || data.email || data.name.toLowerCase().replace(/\s+/g, "."),
    email: data.email,
    first_name: names.first_name,
    last_name: names.last_name,
    role: data.role,
    client: data.primaryOrganization || selectedOrganizationIds[0] || null,
    job_title: data.jobTitle || "",
    specialty: data.specialty || "",
    phone: data.phone || "",
    total_hours: toNumber(data.availableHours, 40),
    permissions_json: legacyPermissionKeys,
    is_active: data.status === "Ativo",
    ...(data.password ? { password: data.password } : {}),
  };
  const payload = {
    ...legacyPayload,
    hourly_cost: parseCurrencyInput(data.hourlyCost, 0),
    organization_links: selectedOrganizationIds.map((organizationId) => ({
      organization: organizationId,
      role: data.role,
      active: true,
    })),
  };
  const orgPayload = {
    department: data.department || null,
    position: data.position || null,
    supervisor: data.supervisor || null,
    manager: data.manager || null,
    approval_mode: data.approvalMode || "INHERITED",
    is_service_desk_approver: data.isServiceDeskApprover ?? false,
  };
  const extendedPayload = options?.includePermissionConfig
    ? {
        ...payload,
        ...orgPayload,
        permission_blocks: data.permissionBlockIds,
        granted_permissions: grantedPermissions,
        denied_permissions: deniedPermissions,
      }
    : { ...payload, ...orgPayload };

  try {
    return mode === "edit" ? updateUser(userId!, extendedPayload as Partial<User>) : createUser(extendedPayload as Partial<User>);
  } catch (error) {
    if (!canRetryWithLegacyPayload(error)) {
      throw error;
    }

    return mode === "edit" ? updateUser(userId!, legacyPayload) : createUser(legacyPayload);
  }
}

export function toMemberFormData(user: User): Partial<MemberFormData> {
  const organizationIds = getUserOrganizationIds(user);

  return {
    name:
      user.name ||
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.username ||
      "",
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    role: getUserRole(user) || "TECHNICIAN",
    primaryOrganization: user.client || user.client_id || user.organization_id || "",
    organizationAccessIds: organizationIds,
    jobTitle: user.job_title || "",
    specialty: user.specialty || "",
    hourlyCost: formatCurrencyInput(user.hourly_cost ?? 0),
    availableHours: String(user.total_hours ?? 40),
    status: user.is_active === false ? "Inativo" : "Ativo",
    password: "",
    confirmPassword: "",
    permissionBlockIds: Array.isArray(user.permission_blocks)
      ? user.permission_blocks.map(String)
      : Array.isArray(user.permission_blocks_data)
        ? user.permission_blocks_data.map((block) => block.id)
        : [],
    grantedPermissionKeys: flattenGrantedPermissions(user.granted_permissions)
      .concat(
        user.granted_permissions ? [] : user.permissions_json || [],
      )
      .filter((value, index, list) => list.indexOf(value) === index),
    deniedPermissionKeys: flattenGrantedPermissions(user.denied_permissions),
    department: user.department || "",
    position: user.position || "",
    supervisor: user.supervisor || "",
    manager: user.manager || "",
    approvalMode: user.approval_mode || "INHERITED",
    isServiceDeskApprover: user.is_service_desk_approver ?? false,
  };
}
