/**
 * Global 401 handler. When any API call returns 401 (expired / invalid token),
 * clear the stored session and bounce to /login. Installed once at startup so
 * every service (which use raw fetch) is covered uniformly — no per-call code.
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function installAuthInterceptor(): void {
  const w = window as unknown as { __authInterceptorInstalled?: boolean };
  if (w.__authInterceptorInstalled) return;
  w.__authInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await originalFetch(input, init);
    try {
      if (res.status === 401) {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
            ? input.href
            : (input as Request).url;
        const isApi = url.includes(API_BASE) || url.includes('/api/');
        const isAuthEndpoint = /\/api\/auth\/(login|demo-login|github)/.test(url);
        const onLogin = window.location.pathname.startsWith('/login');
        if (isApi && !isAuthEndpoint && !onLogin) {
          try {
            localStorage.removeItem('insightsmart-auth');
          } catch {
            /* ignore */
          }
          window.location.assign('/login');
        }
      }
    } catch {
      /* never let the interceptor break a request */
    }
    return res;
  }) as typeof window.fetch;
}
