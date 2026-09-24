import { QueryClient, QueryFunction } from "@tanstack/react-query";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let _csrfToken: string | null = null;
export async function getCsrfToken(): Promise<string> {
  if (_csrfToken) return _csrfToken;
  const res = await fetch("/api/csrf-token", { credentials: "include" });
  const { csrfToken } = await res.json();
  _csrfToken = csrfToken;
  return csrfToken;
}

export function invalidateCsrfToken(): void {
  _csrfToken = null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 403) _csrfToken = null;
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};

  if (!SAFE_METHODS.has(method.toUpperCase())) {
    headers["x-csrf-token"] = await getCsrfToken();
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: true,
      staleTime: 5_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
