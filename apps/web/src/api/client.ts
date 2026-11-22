import type { ApiErrorBody } from '@ticketing/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors from a 400 VALIDATION_ERROR, keyed by top-level path. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as Array<{ path?: string; message?: string }>) {
        if (d?.path && d.message && !out[d.path]) out[d.path] = d.message;
      }
    }
    return out;
  }
}

let onUnauthenticated: (() => void) | null = null;

/** Registered by the app shell: navigates to /login?next=… when a session expires mid-use. */
export function setOnUnauthenticated(handler: (() => void) | null): void {
  onUnauthenticated = handler;
}

export interface ApiInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (init.body !== undefined) headers['content-type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }

  if (!res.ok) {
    const body = data as ApiErrorBody | undefined;
    const error = body?.error
      ? new ApiError(res.status, body.error.code, body.error.message, body.error.details)
      : new ApiError(res.status, `HTTP_${res.status}`, res.status >= 500 ? 'The server had a problem. Try again in a moment.' : `Request failed (${res.status}).`);
    if (res.status === 401 && error.code === 'UNAUTHENTICATED') onUnauthenticated?.();
    throw error;
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
