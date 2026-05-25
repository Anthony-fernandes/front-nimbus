import axios from "axios";

import { clearSession, getAccessToken, getRefreshToken, setSession } from "./session";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

function resolveApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return "/api";
  }

  const normalizedBaseUrl = configuredBaseUrl.replace(/\/$/, "");
  return normalizedBaseUrl.endsWith("/api") ? normalizedBaseUrl : `${normalizedBaseUrl}/api`;
}

export const API_BASE_URL = resolveApiBaseUrl();
export const AUTH_REQUIRED_EVENT = "nimbus:auth-required";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

let refreshPromise: Promise<string | null> | null = null;

function notifyAuthRequired() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearSession();
    notifyAuthRequired();
    return null;
  }

  try {
    const response = await axios.post<{ access: string; refresh?: string }>(
      `${API_BASE_URL}/auth/refresh/`,
      { refresh },
    );

    setSession({
      access: response.data.access,
      refresh: response.data.refresh ?? refresh,
    });

    return response.data.access;
  } catch {
    clearSession();
    notifyAuthRequired();
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (!originalRequest || originalRequest._retry || (status !== 401 && status !== 403)) {
      return Promise.reject(error);
    }

    const requestUrl = String(originalRequest.url || "");
    if (requestUrl.includes("/auth/login/") || requestUrl.includes("/auth/refresh/")) {
      clearSession();
      notifyAuthRequired();
      return Promise.reject(error);
    }

    if (status === 403) {
      clearSession();
      notifyAuthRequired();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newAccessToken = await refreshPromise;
    if (!newAccessToken) {
      notifyAuthRequired();
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
    return api(originalRequest);
  },
);
