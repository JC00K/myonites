import type { AuthService, AuthSession } from "@myonites/shared";
import { supabase } from "./supabase";

function mapSession(
  session: {
    user: { id: string; email?: string };
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  } | null,
): AuthSession | null {
  if (!session) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? 0,
  };
}

export const authService: AuthService = {
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return {
        success: false,
        session: null,
        error: {
          code: error.status?.toString() ?? "unknown",
          message: error.message,
        },
      };
    }
    return { success: true, session: mapSession(data.session), error: null };
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return {
        success: false,
        session: null,
        error: {
          code: error.status?.toString() ?? "unknown",
          message: error.message,
        },
      };
    }
    return { success: true, session: mapSession(data.session), error: null };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    return mapSession(data.session);
  },

  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(mapSession(session));
    });
    return () => data.subscription.unsubscribe();
  },
};
