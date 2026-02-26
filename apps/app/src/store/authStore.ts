import { create } from "zustand";
import type { AuthSession } from "@myonites/shared";
import { authService } from "../services/auth";

interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;

  initialize: () => Unsubscribe;
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  clearError: () => void;
}

type Unsubscribe = () => void;

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true,
  error: null,

  initialize: () => {
    const unsubscribe = authService.onAuthStateChange((session) => {
      set({ session, isLoading: false });
    });

    authService.getSession().then((session) => {
      set({ session, isLoading: false });
    });

    return unsubscribe;
  },

  signUp: async (email, password) => {
    set({ isLoading: true, error: null });
    const result = await authService.signUp(email, password);
    if (!result.success) {
      set({
        isLoading: false,
        error: result.error?.message ?? "Sign up failed",
      });
      return false;
    }
    set({ isLoading: false });
    return true;
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    const result = await authService.signIn(email, password);
    if (!result.success) {
      set({
        isLoading: false,
        error: result.error?.message ?? "Sign in failed",
      });
      return false;
    }
    set({ isLoading: false });
    return true;
  },

  signOut: async () => {
    set({ isLoading: true });
    await authService.signOut();
    set({ session: null, isLoading: false });
  },

  resetPassword: async (email) => {
    set({ isLoading: true, error: null });
    try {
      await authService.resetPassword(email);
      set({ isLoading: false });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Reset failed",
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
