export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
export const BACKEND_URL = API_URL.replace(/\/api\/?$/, '');

export function getImageUrl(path?: string): string {
  if (!path) return "/vercel.svg";
  if (path.startsWith("http")) return path;
  
  // Normalizar path: reemplazar backslashes con forward slashes y eliminar espacios extra
  const normalizedPath = path.replace(/\\/g, '/').trim();
  
  return `${BACKEND_URL}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
}

// Debug en desarrollo
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[API] API_URL configurado:', API_URL);
  console.log('[API] BACKEND_URL calculado:', BACKEND_URL);
  console.log('[API] NEXT_PUBLIC_API_URL env:', process.env.NEXT_PUBLIC_API_URL);
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  // Prioriza localStorage pero permite sesión temporal si el usuario eligió no recordar.
  return localStorage.getItem('token') ?? sessionStorage.getItem('token');
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isFormData =
    typeof window !== 'undefined' && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    Accept: 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_URL}${normalizedPath}`;
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
      const isAbort =
        typeof e === 'object' &&
        e &&
        'name' in e &&
        (e as { name?: string }).name === 'AbortError';
      const msg =
        typeof e === 'object' && e && 'message' in e
          ? String((e as { message?: string }).message)
          : String(e ?? '');
      const networkLike =
        isAbort ||
        /Failed to fetch|NetworkError|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|timeout/i.test(
          msg,
        );
      console.error('[apiFetch] Network error', { url, attempt, msg });
      if (networkLike && attempt < maxRetries) {
        await delay((attempt + 1) * 500);
        continue;
      }
      throw new Error(`Fallo consultando ${url}: ${msg}`);
    }
    clearTimeout(tid);
    if (!res.ok) {
      if (res.status === 401) {
        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/auth/login')
        ) {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          window.location.href = '/auth/login';
        }
        throw new Error('Sesión expirada o credenciales inválidas');
      }
      const ct = res.headers.get('content-type') || '';
      const raw = await res.text();
      const parsed = ct.includes('application/json') ? safeJson(raw) : null;
      const base = `Error ${res.status} ${res.statusText} consultando ${url}`;
      const detail =
        parsed && typeof parsed === 'object' ? stringifyError(parsed) : raw;
      const message = detail ? `${base}: ${truncate(detail, 500)}` : base;
      console.error('[apiFetch] HTTP error', {
        url,
        status: res.status,
        statusText: res.statusText,
        detail,
      });
      if (res.status >= 500 && attempt < maxRetries) {
        await delay((attempt + 1) * 500);
        continue;
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
  }
  throw new Error(`Fallo consultando ${url}`);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function stringifyError(obj: unknown) {
  const anyObj = obj as Record<string, unknown> | undefined;
  const m = anyObj?.message ?? anyObj?.error ?? anyObj?.errors;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join(', ');
  try {
    return JSON.stringify(anyObj as Record<string, unknown>);
  } catch {
    return String(obj as unknown as string);
  }
}

// Requiere autenticación previa; si no hay token, redirige al login con mensaje y parámetro next
export function requireAuthOrRedirect(nextUrl?: string) {
  const token = getToken();
  if (!token && typeof window !== 'undefined') {
    const msg = encodeURIComponent('Debes iniciar sesión para continuar');
    const next = encodeURIComponent(nextUrl ?? (window.location.pathname + window.location.search));
    window.location.assign(`/auth/login?msg=${msg}&next=${next}`);
    return null;
  }
  return token;
}

// Versión de apiFetch que falla temprano si no hay token y necesita autenticación
export async function apiFetchAuth<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // No pasar rutas de API como "next"; debemos regresar al lugar actual del usuario.
  const token = requireAuthOrRedirect();
  if (!token) throw new Error('no_auth');
  
  try {
    return await apiFetch<T>(path, options);
  } catch (err: any) {
    if (err.message.includes('"statusCode":401') || err.message.includes('Unauthorized')) {
      // Si recibimos un 401 del backend, el token probablemente expiró
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        requireAuthOrRedirect();
      }
    }
    throw err;
  }
}
