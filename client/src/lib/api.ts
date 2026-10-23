// Fetch wrapper for the TraceErase API. In development Vite proxies /api to the server; online, the
// website (Firebase Hosting) calls the API on its own address (VITE_API_URL) with a sign-in token.
import { API_URL } from './config';

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) { super(message); this.status = status; this.data = data; }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal };

// ---------- sign-in tokens (kept in this browser) ----------
const USER_KEY = 'te_token';
const STAFF_KEY = 'te_staff_token';
const read = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const write = (k: string, v: string) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
export const setUserToken = (t: string) => write(USER_KEY, t);
export const setStaffToken = (t: string) => write(STAFF_KEY, t);
export const clearTokens = () => { write(USER_KEY, ''); write(STAFF_KEY, ''); };

export const apiUrl = (path: string) => API_URL + (path.startsWith('/api') ? path : '/api' + path);

export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const u = read(USER_KEY); const s = read(STAFF_KEY);
  if (u) h.Authorization = `Bearer ${u}`;
  if (s) h['X-Staff-Token'] = s;
  return h;
}

// ---------- "server is waking up" (the free server sleeps when nobody uses it) ----------
let pending = 0;
let lastAnswer = 0; // when the server last answered (it sleeps after 15 quiet minutes)
let slowTimer: number | undefined;
const wakeListeners = new Set<(slow: boolean) => void>();
const setSlow = (v: boolean) => wakeListeners.forEach(f => f(v));
export const onServerSlow = (f: (slow: boolean) => void) => { wakeListeners.add(f); return () => { wakeListeners.delete(f); }; };

/** fetch() to the API with the sign-in token attached. */
export async function apiFetch(path: string, init: RequestInit = {}) {
  pending++;
  if (pending === 1) slowTimer = window.setTimeout(() => { if (Date.now() - lastAnswer > 10 * 60000) setSlow(true); }, 4000);
  try {
    const r = await fetch(apiUrl(path), { credentials: 'include', ...init, headers: { ...authHeaders(), ...(init.headers as Record<string, string> || {}) } });
    lastAnswer = Date.now(); setSlow(false);
    return r;
  } finally {
    pending--;
    if (!pending) { window.clearTimeout(slowTimer); setSlow(false); }
  }
}

/** Start waking the server as soon as the website opens. */
export const warmUp = () => { if (API_URL) fetch(apiUrl('/api/health')).then(() => { lastAnswer = Date.now(); setSlow(false); }).catch(() => {}); };

export async function api<T = any>(path: string, { method = 'GET', body, signal }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(API_URL ? 'Cannot reach the TraceErase server. It may be waking up (about a minute on the free plan); please try again.' : 'Cannot reach the TraceErase server', 0);
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  // Remember sign-ins
  if (data && typeof data.token === 'string') {
    if (data.user) setUserToken(data.token);
    else if (data.staff) setStaffToken(data.token);
  }
  return data as T;
}

export const get = <T = any>(p: string) => api<T>(p);
export const post = <T = any>(p: string, body?: unknown) => api<T>(p, { method: 'POST', body: body ?? {} });
export const patch = <T = any>(p: string, body?: unknown) => api<T>(p, { method: 'PATCH', body });
export const del = <T = any>(p: string) => api<T>(p, { method: 'DELETE' });

/** Opens a printable page from the API (certificate, complaint, evidence) in a new tab. */
export async function openApiPage(path: string) {
  const w = window.open('', '_blank');
  try {
    const r = await apiFetch(path);
    if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || 'Could not open it');
    const html = await r.text();
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    if (w) w.location.href = url; else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { w?.close(); throw e; }
}

/** Downloads a file from the API (with the sign-in token). */
export async function downloadApi(path: string, filename: string) {
  const r = await apiFetch(path);
  if (!r.ok) throw new ApiError((await r.json().catch(() => null))?.error || 'Download failed', r.status);
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
