/**
 * Authentication service interface.
 * Currently implemented by Supabase Auth.
 * Designed for future migration to AWS Cognito.
 */
export interface AuthService {
  signUp(email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(
    callback: (session: AuthSession | null) => void
  ): Unsubscribe;
}

export interface AuthResult {
  success: boolean;
  session: AuthSession | null;
  error: AuthError | null;
}

export interface AuthSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthError {
  code: string;
  message: string;
}

export type Unsubscribe = () => void;
