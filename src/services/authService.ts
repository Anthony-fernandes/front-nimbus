import type { User } from "@/lib/types";
import { normalizeUser } from "@/lib/auth";

import { api, AUTH_REQUIRED_EVENT } from "./api";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  isAuthenticated,
  setSession,
  updateStoredUser,
} from "./session";

type LoginResponse = {
  access: string;
  refresh: string;
  user?: User | null;
};

export {
  AUTH_REQUIRED_EVENT,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  isAuthenticated,
};

export async function login(username: string, password: string) {
  const response = await api.post<LoginResponse>("/auth/login/", { username, password });
  setSession({ access: response.data.access, refresh: response.data.refresh, user: null });

  try {
    const user =
      normalizeUser(response.data.user) ||
      normalizeUser((await api.get<User>("/auth/me/")).data);

    const session = {
      ...response.data,
      user,
    };
    setSession(session);
    return session;
  } catch (error) {
    clearSession();
    throw error;
  }
}

export async function fetchCurrentUser() {
  const response = await api.get<User>("/auth/me/");
  const user = normalizeUser(response.data);
  updateStoredUser(user);
  return user;
}

export async function updateMyProfile(data: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  job_title?: string;
}): Promise<User> {
  const response = await api.patch<User>("/auth/me/", data);
  const user = normalizeUser(response.data) ?? response.data;
  updateStoredUser(user);
  return user;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await api.post("/auth/change-password/", { old_password: oldPassword, new_password: newPassword });
}

export async function logout() {
  const refresh = getRefreshToken();

  try {
    if (refresh) {
      await api.post("/auth/logout/", { refresh });
    }
  } finally {
    clearSession();
  }
}
