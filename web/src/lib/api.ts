/** Thin fetch wrapper. Session is a Bearer token minted by /v1/auth/apple.
 *  Web-side signing in uses Sign in with Apple JS (loaded from apple CDN) and
 *  posts the identityToken to /v1/auth/apple. Token is stored in localStorage;
 *  swap for HttpOnly cookies once we're running behind the same origin. */

const TOKEN_KEY = "botboss.session";
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setSessionToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function send<T>(
  method: string,
  path: string,
  body?: unknown,
  { requiresAuth = true }: { requiresAuth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (requiresAuth) {
    const token = getSessionToken();
    if (!token) throw new APIError(401, "Not authenticated");
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    if (res.status === 401) setSessionToken(null);
    throw new APIError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: { requiresAuth?: boolean }) =>
    send<T>("GET", path, undefined, opts),
  post: <T>(path: string, body: unknown, opts?: { requiresAuth?: boolean }) =>
    send<T>("POST", path, body, opts),
  patch: <T>(path: string, body: unknown, opts?: { requiresAuth?: boolean }) =>
    send<T>("PATCH", path, body, opts),
  delete: <T>(path: string, opts?: { requiresAuth?: boolean }) =>
    send<T>("DELETE", path, undefined, opts),
};
