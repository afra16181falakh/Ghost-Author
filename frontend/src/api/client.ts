/**
 * Central API client — wraps fetch with auth headers, base URL, and error handling.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function getToken(): string | null {
  return localStorage.getItem('ghost_token');
}

export function setToken(token: string) {
  localStorage.setItem('ghost_token', token);
}

export function clearToken() {
  localStorage.removeItem('ghost_token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'API error');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get:    <T>(path: string)              => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string)              => request<T>(path, { method: 'DELETE' }),
};

/** Open a WebSocket to stream logs for a run. Returns the WebSocket instance. */
export function openRunSocket(
  runId: string,
  handlers: {
    onLog?: (level: string, msg: string, ts?: string) => void;
    onStatus?: (status: string) => void;
    onComplete?: (success: boolean, prUrl: string | null) => void;
    onError?: (e: Event) => void;
  }
): WebSocket {
  const wsBase = BASE.replace(/^http/, 'ws');
  const ws = new WebSocket(`${wsBase}/api/runs/${runId}/ws`);

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'log')      handlers.onLog?.(msg.payload.level, msg.payload.message, msg.payload.ts);
      if (msg.type === 'status')   handlers.onStatus?.(msg.payload.status);
      if (msg.type === 'complete') handlers.onComplete?.(msg.payload.success, msg.payload.pr_url);
    } catch { /* ignore parse errors */ }
  };
  ws.onerror = handlers.onError ?? (() => {});

  // Keep-alive ping every 20s
  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send('ping');
  }, 20_000);
  ws.onclose = () => clearInterval(ping);

  return ws;
}
