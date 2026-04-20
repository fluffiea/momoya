import {
  notifySessionReplaced,
} from '@/auth/sessionReplaced';

const jsonHeaders = { 'Content-Type': 'application/json' };

/** 将 `/api/...` 解析为完整 URL（生产构建带 `VITE_API_BASE_URL` 时使用） */
export function resolveApiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (!base) return path;
  if (path.startsWith('http')) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; code?: string }
> {
  const url = resolveApiUrl(path);
  const hasJsonBody =
    typeof init?.body === 'string' &&
    init.method &&
    init.method !== 'GET' &&
    init.method !== 'HEAD';
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(hasJsonBody ? jsonHeaders : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    let code: string | undefined;
    if (typeof body === 'object' && body !== null && 'code' in body) {
      const c = (body as { code?: unknown }).code;
      if (typeof c === 'string') code = c;
    }
    const err =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error?: string }).error === 'string'
        ? (body as { error: string }).error
        : `请求失败 (${res.status})`;
    if (res.status === 401 && code === 'SESSION_REPLACED') {
      notifySessionReplaced(err);
    }
    return { ok: false, status: res.status, error: err, code };
  }
  return { ok: true, data: body as T };
}

export async function apiPostJson<T>(path: string, body: unknown) {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function apiPatchJson<T>(path: string, body: unknown) {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function apiDelete(path: string) {
  return apiFetch<unknown>(path, { method: 'DELETE' });
}
