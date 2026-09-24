import { getCsrfToken, invalidateCsrfToken } from "./queryClient";

export { apiRequest } from "./queryClient";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  const text = await res.text();
  let body: unknown = text;
  let message = res.statusText || `Request failed (${res.status})`;
  if (text) {
    try {
      const parsed = JSON.parse(text);
      body = parsed;
      if (
        parsed &&
        typeof parsed === "object" &&
        "message" in parsed &&
        typeof (parsed as { message: unknown }).message === "string"
      ) {
        message = (parsed as { message: string }).message;
      }
    } catch {
      message = text;
    }
  }
  return new ApiError(res.status, message, body);
}

export async function apiUpload<T = unknown>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers: { "x-csrf-token": await getCsrfToken() },
    credentials: "include",
  });
  if (!res.ok) {
    if (res.status === 403) invalidateCsrfToken();
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
