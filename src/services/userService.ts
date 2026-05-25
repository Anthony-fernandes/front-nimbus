import type { MemberFormData } from "@/components/forms/MemberForm";
import { getUserRole } from "@/lib/auth";
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
  return listResource<User>(ENDPOINT, params);
}

export function getUser(id: string) {
  return getResource<User>(ENDPOINT, id);
}

export function createUser(payload: Partial<User> & { password?: string }) {
  return createResource<User>(ENDPOINT, payload);
}

export function updateUser(id: string, payload: Partial<User> & { password?: string }) {
  return updateResource<User>(ENDPOINT, id, payload);
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
) {
  requireId(mode, userId);

  const names = splitName(data.name);
  const legacyPayload = {
    username: data.username || data.email || data.name.toLowerCase().replace(/\s+/g, "."),
    email: data.email,
    first_name: names.first_name,
    last_name: names.last_name,
    role: data.role,
    client: data.role === "CLIENT" ? data.client || null : null,
    job_title: data.jobTitle || "",
    specialty: data.specialty || "",
    phone: data.phone || "",
    total_hours: toNumber(data.availableHours, 40),
    technical_group: data.group || "",
    permissions_json: data.permissions,
    is_active: data.status === "Ativo",
    ...(data.password ? { password: data.password } : {}),
  };
  const payload = {
    ...legacyPayload,
    hourly_cost: parseCurrencyInput(data.hourlyCost, 0),
  };

  try {
    return mode === "edit" ? updateUser(userId!, payload) : createUser(payload);
  } catch (error) {
    if (!canRetryWithLegacyPayload(error)) {
      throw error;
    }

    return mode === "edit" ? updateUser(userId!, legacyPayload) : createUser(legacyPayload);
  }
}

export function toMemberFormData(user: User): Partial<MemberFormData> {
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
    client: user.client || user.client_id || "",
    jobTitle: user.job_title || "",
    specialty: user.specialty || "",
    hourlyCost: formatCurrencyInput(user.hourly_cost ?? 0),
    group: user.technical_group || "",
    availableHours: String(user.total_hours ?? 40),
    status: user.is_active === false ? "Inativo" : "Ativo",
    password: "",
    confirmPassword: "",
    permissions: user.permissions_json || [],
  };
}
