import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: 'user' | 'manager' | 'admin';
  status: 'pending' | 'active' | 'suspended' | 'expired';
  max_questions_per_day: number;
  max_tokens_per_day: number;
  max_cost_usd_per_month: number;
  expiry_date: string | null;
  total_questions: number;
  total_tokens: number;
  total_cost_usd: number;
  today_questions: number;
  today_tokens: number;
  today_cost_usd: number;
  month_cost_usd: number;
}

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user';
  title: string;
  manager_id: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isPrivileged: boolean;  // admin or manager
  isPending: boolean;
  login: (name: string, email: string) => Promise<void>;
  loginAsDemo: (userId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

export async function fetchDemoUsers(): Promise<DemoUser[]> {
  const res = await fetch(`${API_BASE}/api/auth/demo-users`);
  if (!res.ok) throw new Error('Failed to load demo users');
  return res.json();
}

function deriveFlags(user: User | null) {
  return {
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    isPrivileged: user?.role === 'admin' || user?.role === 'manager',
    isPending: user?.status === 'pending',
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      isManager: false,
      isPrivileged: false,
      isPending: false,

      login: async (name: string, email: string) => {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email }),
        });
        if (response.status === 403) {
          const data = await response.json();
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            ...deriveFlags(data.user),
          });
          return;
        }
        if (!response.ok) throw new Error('Login failed');
        const data = await response.json();
        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          ...deriveFlags(data.user),
        });
      },

      loginAsDemo: async (userId: string) => {
        const previousUser = get().user;
        const switchingPersona = previousUser && previousUser.id !== userId;

        const response = await fetch(`${API_BASE}/api/auth/demo-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        if (!response.ok) {
          let detail = `Demo login failed (${response.status})`;
          try {
            const body = await response.json();
            if (body?.detail) detail = String(body.detail);
          } catch {
            /* ignore */
          }
          throw new Error(detail);
        }
        const data = await response.json();

        // If we're switching to a different persona, wipe the previous
        // user's persisted Zustand caches so they don't bleed into this
        // user's view. The backend already scopes sessions / canvas
        // blocks / workspaces by user_id, but the persisted stores hold
        // a snapshot of the previous user's data and would override the
        // freshly-fetched server view if left in place. A reload after
        // clearing makes the app rehydrate from the server cleanly.
        if (switchingPersona) {
          localStorage.removeItem('insightsmart-chat');
          localStorage.removeItem('insightsmart-canvas');
          localStorage.removeItem('insightsmart-workspaces');
        }

        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
          ...deriveFlags(data.user),
        });

        // Force a hard reload so every Zustand store's `persist()`
        // rehydrate runs against the now-empty localStorage and React
        // re-mounts from scratch. We append a cache-busting query so
        // the browser doesn't serve a cached bundle (which could keep
        // stale in-memory state from the previous persona). Equivalent
        // to a manual Ctrl+Shift+R, but automatic.
        if (switchingPersona) {
          window.location.href = `/?p=${Date.now()}`;
        }
      },

      refreshUser: async () => {
        const { token } = get();
        if (!token) return;
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          if (response.status === 401) {
            set({ user: null, token: null, isAuthenticated: false, isAdmin: false, isManager: false, isPrivileged: false, isPending: false });
          }
          return;
        }
        const user: User = await response.json();
        set({
          user,
          isAuthenticated: true,
          ...deriveFlags(user),
        });
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, isAdmin: false, isManager: false, isPrivileged: false, isPending: false });
        // Clear ALL per-user stores so the next login doesn't see stale
        // data from this persona (chats, canvas blocks, workspace list).
        localStorage.removeItem('insightsmart-workspaces');
        localStorage.removeItem('insightsmart-chat');
        localStorage.removeItem('insightsmart-canvas');
      },
    }),
    { name: 'insightsmart-auth' }
  )
);
