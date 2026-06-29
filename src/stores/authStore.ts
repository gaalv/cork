/**
 * Auth store — manages authentication state.
 *
 * For now, auth state is local-only (no backend).
 * Persists login status to localStorage so the user stays logged in.
 * In v2, OAuth flow will replace the mock login.
 */

import { create } from "zustand";

type AuthState = {
  isAuthenticated: boolean;
  user: { email: string; name: string } | null;
  login: (email: string, name: string) => void;
  logout: () => void;
};

function loadPersistedAuth(): {
  isAuthenticated: boolean;
  user: { email: string; name: string } | null;
} {
  try {
    const stored = localStorage.getItem("cork:auth");
    if (stored) {
      const parsed = JSON.parse(stored) as { email: string; name: string };
      return { isAuthenticated: true, user: parsed };
    }
  } catch {
    /* ignore */
  }
  return { isAuthenticated: false, user: null };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadPersistedAuth(),

  login: (email, name) => {
    const user = { email, name };
    localStorage.setItem("cork:auth", JSON.stringify(user));
    set({ isAuthenticated: true, user });
  },

  logout: () => {
    localStorage.removeItem("cork:auth");
    set({ isAuthenticated: false, user: null });
  },
}));
