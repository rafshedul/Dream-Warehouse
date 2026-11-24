const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

const configuredBaseUrl = configuredApiUrl || "http://localhost:8000";
export const API_BASE_URL = configuredBaseUrl
  .replace(/^http:\/\/127\.0\.0\.1(?=:|\/|$)/, "http://localhost")
  .replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getErrorMessage(payload: unknown, status: number) {
  if (typeof payload === "string" && payload.trim()) return payload;

  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = payload.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (!item || typeof item !== "object") return String(item);
          const issue = item as { loc?: unknown[]; msg?: string };
          const field = issue.loc?.slice(1).join(".");
          return field ? `${field}: ${issue.msg ?? "Invalid value"}` : issue.msg ?? "Invalid value";
        })
        .join("; ");
    }
    if (detail && typeof detail === "object" && "message" in detail) {
      return String(detail.message);
    }
  }

  return `API request failed (${status})`;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: options.credentials ?? "include",
    headers,
  });

  if (response.status === 204) return undefined as T;

  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload, response.status), response.status);
  }

  return payload as T;
}
