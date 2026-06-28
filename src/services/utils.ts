import type { AxiosError } from "axios";

/**
 * Extracts a user-friendly error message from an API error.
 * Never exposes raw technical messages or stack traces.
 */
export function parseApiError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;

  const axiosError = error as AxiosError<Record<string, unknown>>;
  const data = axiosError.response?.data;

  if (!data) return fallback;

  // Check top-level message fields
  if (typeof data.detail === "string" && data.detail) return data.detail;
  if (typeof data.message === "string" && data.message) return data.message;
  if (typeof data.error === "string" && data.error) return data.error;

  // Field-level validation errors: { field_name: ["error text"] }
  if (typeof data === "object" && !Array.isArray(data)) {
    const fieldErrors = Object.entries(data)
      .filter(([, v]) => Array.isArray(v) || typeof v === "string")
      .map(([, v]) => (Array.isArray(v) ? v.join(", ") : String(v)))
      .filter(Boolean);
    if (fieldErrors.length > 0) return fieldErrors.join(". ");
  }

  return fallback;
}

export function toNumber(value: string | number | undefined | null, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toDateOrNull(value?: string | null) {
  return value ? value : null;
}

function toValidDate(value?: string | number | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function requireId(mode: "create" | "edit", id?: string) {
  if (mode === "edit" && !id) {
    throw new Error("ID obrigatorio para atualizar o registro.");
  }
}

export function formatDate(value?: string | null) {
  return formatDateSafe(value, "-");
}

export function formatDateTime(value?: string | null) {
  return formatDateTimeSafe(value, "-");
}

export function formatDateSafe(
  value?: string | number | Date | null,
  fallback = "Não informado",
) {
  const date = toValidDate(value);
  return date ? date.toLocaleDateString("pt-BR") : fallback;
}

export function formatDateTimeSafe(
  value?: string | number | Date | null,
  fallback = "Não informado",
) {
  const date = toValidDate(value);
  return date ? date.toLocaleString("pt-BR") : fallback;
}

export function formatCurrency(value?: string | number | null) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseCurrencyInput(value?: string | number | null, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (!value) return fallback;

  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return toNumber(normalized, fallback);
}

export function formatCurrencyInput(value?: string | number | null) {
  const amount = parseCurrencyInput(value, 0);
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function maskCurrencyInput(value?: string | number | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRelativeDate(value?: string | null) {
  if (!value) return "-";

  const date = toValidDate(value);
  if (!date) {
    return "-";
  }
  const diffInSeconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "agora";
  if (diffInSeconds < 3600) return `ha ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `ha ${Math.floor(diffInSeconds / 3600)} h`;

  return formatDateTime(value);
}
