const FALLBACK_API_URL = 'https://backend-production-0c3e.up.railway.app/api';
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  FALLBACK_API_URL;

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isFormData = typeof window !== 'undefined' && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  // Asegurar que el path empiece con / si no lo hace
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_URL}${normalizedPath}`;
  
  // Debug en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('[apiFetch]', { API_URL, path, normalizedPath, url });
  }

  const maxRetries = 2;
  const timeoutMs = 10000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...options, headers, signal: controller.signal });
    } catch (err: unknown) {
      clearTimeout(tid);
      const e = err as { name?: string; message?: string } | string | undefined;
      const isAbort = typeof e === 'object' && e && 'name' in e && (e as { name?: string }).name === 'AbortError';
      const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message?: string }).message) : String(e ?? '');
      const networkLike = isAbort || /Failed to fetch|NetworkError|ECONNREFUSED|ENOTFOUND/i.test(msg);
      if (networkLike && attempt < maxRetries) {
        await delay((attempt + 1) * 500);
        continue;
      }
      const message = `Fallo consultando ${url}: ${msg}`;
      console.error('[apiFetch] Network/Fetch error', { url, attempt, msg });
      throw new Error(message);
    }

    clearTimeout(tid);

    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/login')) {
          localStorage.removeItem('token');
          window.location.href = '/auth/login';
        }
        // No loguear error en consola para 401, es flujo esperado
        throw new Error('Sesión expirada o credenciales inválidas');
      }

      const ct = res.headers.get('content-type') || '';
      const raw = await res.text();
      const parsed = ct.includes('application/json') ? safeJson(raw) : null;
      const base = `Error ${res.status} ${res.statusText} consultando ${url}`;
      const detail = parsed && typeof parsed === 'object' ? stringifyError(parsed) : raw;
      const message = detail ? `${base}: ${truncate(detail, 500)}` : base;
      if (res.status >= 500 && attempt < maxRetries) {
        await delay((attempt + 1) * 500);
        continue;
      }
      console.error('[apiFetch] HTTP error', { url, status: res.status, statusText: res.statusText, detail });
      throw new Error(message);
    }
    return (await res.json()) as T;
  }
  throw new Error(`Fallo consultando ${url}`);
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function safeJson(t: string): unknown { try { return JSON.parse(t); } catch { return null; } }
function truncate(t: string, n: number) { return t.length > n ? t.slice(0, n) + '…' : t; }
function stringifyError(obj: unknown) {
  const r = obj as Record<string, unknown> | undefined;
  const m = r?.message ?? r?.error ?? r?.errors;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join(', ');
  try { return JSON.stringify(obj as Record<string, unknown>); } catch { return String(obj as unknown as string); }
}
