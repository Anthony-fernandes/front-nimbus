import type { User } from "@/lib/types";
import { normalizeUser } from "@/lib/auth";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "auth_user";

const LEGACY_ACCESS_TOKEN_KEY = "stratos_access_token";
const LEGACY_REFRESH_TOKEN_KEY = "stratos_refresh_token";
const LEGACY_USER_KEY = "stratos_user";

function isBrowser() {
  return typeof window !== "undefined";
}

function getItem(keys: string[]) {
  if (!isBrowser()) return null;
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export function getAccessToken() {
  return getItem([ACCESS_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY]);
}

export function getRefreshToken() {
  return getItem([REFRESH_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
}

export function getStoredUser<T = User>() {
  const raw = getItem([USER_KEY, LEGACY_USER_KEY]);
  return raw ? (normalizeUser(JSON.parse(raw) as User) as T) : null;
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

export function setSession(data: { access: string; refresh?: string; user?: User | null }) {
  if (!isBrowser()) return;

  localStorage.setItem(ACCESS_TOKEN_KEY, data.access);

  if (data.refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  if (Object.prototype.hasOwnProperty.call(data, "user")) {
    const normalizedUser = normalizeUser(data.user);

    if (normalizedUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }

  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
}

export function updateStoredUser(user: User | null) {
  if (!isBrowser()) return;
  const normalizedUser = normalizeUser(user);
  if (normalizedUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function clearSession() {
  if (!isBrowser()) return;

  [
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    USER_KEY,
    LEGACY_ACCESS_TOKEN_KEY,
    LEGACY_REFRESH_TOKEN_KEY,
    LEGACY_USER_KEY,
  ].forEach((key) => localStorage.removeItem(key));
}
