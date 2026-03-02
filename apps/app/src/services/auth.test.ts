/**
 * Auth Service Tests
 *
 * Tests the mapping layer between Supabase Auth responses and
 * our app's AuthResult/AuthSession types. This is critical because
 * a broken mapping causes silent failures — sign-in appears to work
 * but returns wrong data, or errors get swallowed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the Supabase client before importing the auth service.
 * We control exactly what Supabase returns so we can verify
 * our mapping handles every response shape correctly.
 */
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) =>
        mockSignInWithPassword(...args),
      signOut: () => mockSignOut(),
      resetPasswordForEmail: (...args: unknown[]) =>
        mockResetPasswordForEmail(...args),
      getSession: () => mockGetSession(),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

import { authService } from "./auth";

describe("Auth Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signUp", () => {
    it("maps a successful Supabase signup to AuthResult", async () => {
      mockSignUp.mockResolvedValue({
        data: {
          session: {
            user: { id: "user-123", email: "test@example.com" },
            access_token: "access-abc",
            refresh_token: "refresh-xyz",
            expires_at: 1700000000,
          },
        },
        error: null,
      });

      const result = await authService.signUp(
        "test@example.com",
        "password123",
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.session).toEqual({
        userId: "user-123",
        email: "test@example.com",
        accessToken: "access-abc",
        refreshToken: "refresh-xyz",
        expiresAt: 1700000000,
      });
    });

    it("maps a successful signup with no session (email confirmation pending)", async () => {
      /**
       * When email confirmation is enabled, Supabase returns
       * a null session until the user clicks the confirmation link.
       * Our mapping must handle this without crashing.
       */
      mockSignUp.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await authService.signUp(
        "test@example.com",
        "password123",
      );

      expect(result.success).toBe(true);
      expect(result.session).toBeNull();
      expect(result.error).toBeNull();
    });

    it("maps a Supabase signup error to AuthResult", async () => {
      mockSignUp.mockResolvedValue({
        data: { session: null },
        error: {
          status: 422,
          message: "User already registered",
        },
      });

      const result = await authService.signUp(
        "existing@example.com",
        "password123",
      );

      expect(result.success).toBe(false);
      expect(result.session).toBeNull();
      expect(result.error).toEqual({
        code: "422",
        message: "User already registered",
      });
    });

    it("handles error with no status code", async () => {
      /**
       * Some Supabase errors don't include a status code.
       * Our mapping should default to 'unknown' instead of crashing.
       */
      mockSignUp.mockResolvedValue({
        data: { session: null },
        error: {
          message: "Network error",
        },
      });

      const result = await authService.signUp(
        "test@example.com",
        "password123",
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("unknown");
      expect(result.error?.message).toBe("Network error");
    });
  });

  describe("signIn", () => {
    it("maps a successful Supabase sign-in to AuthResult", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          session: {
            user: { id: "user-456", email: "login@example.com" },
            access_token: "access-def",
            refresh_token: "refresh-uvw",
            expires_at: 1800000000,
          },
        },
        error: null,
      });

      const result = await authService.signIn(
        "login@example.com",
        "password123",
      );

      expect(result.success).toBe(true);
      expect(result.session).toEqual({
        userId: "user-456",
        email: "login@example.com",
        accessToken: "access-def",
        refreshToken: "refresh-uvw",
        expiresAt: 1800000000,
      });
    });

    it("maps a failed sign-in to AuthResult with error", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null },
        error: {
          status: 400,
          message: "Invalid login credentials",
        },
      });

      const result = await authService.signIn(
        "test@example.com",
        "wrongpassword",
      );

      expect(result.success).toBe(false);
      expect(result.session).toBeNull();
      expect(result.error).toEqual({
        code: "400",
        message: "Invalid login credentials",
      });
    });

    it("maps session with missing email to empty string", async () => {
      /**
       * Edge case: Supabase user object may have undefined email
       * in some OAuth flows. Our mapping should default to empty string
       * rather than passing undefined through.
       */
      mockSignInWithPassword.mockResolvedValue({
        data: {
          session: {
            user: { id: "user-789" },
            access_token: "token",
            refresh_token: "refresh",
            expires_at: 1900000000,
          },
        },
        error: null,
      });

      const result = await authService.signIn(
        "test@example.com",
        "password123",
      );

      expect(result.success).toBe(true);
      expect(result.session?.email).toBe("");
    });

    it("maps session with missing expires_at to 0", async () => {
      /**
       * Edge case: expires_at may be undefined in some token states.
       * Default to 0 so downstream code can detect an invalid expiry.
       */
      mockSignInWithPassword.mockResolvedValue({
        data: {
          session: {
            user: { id: "user-789", email: "test@example.com" },
            access_token: "token",
            refresh_token: "refresh",
          },
        },
        error: null,
      });

      const result = await authService.signIn(
        "test@example.com",
        "password123",
      );

      expect(result.success).toBe(true);
      expect(result.session?.expiresAt).toBe(0);
    });
  });

  describe("signOut", () => {
    it("calls Supabase signOut", async () => {
      mockSignOut.mockResolvedValue({ error: null });

      await authService.signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });

    it("throws when Supabase signOut returns an error", async () => {
      mockSignOut.mockResolvedValue({
        error: { message: "Session expired" },
      });

      await expect(authService.signOut()).rejects.toThrow("Session expired");
    });
  });

  describe("resetPassword", () => {
    it("calls Supabase resetPasswordForEmail with the email", async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      await authService.resetPassword("test@example.com");

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "test@example.com",
      );
    });

    it("throws when Supabase returns an error", async () => {
      mockResetPasswordForEmail.mockResolvedValue({
        error: { message: "Rate limit exceeded" },
      });

      await expect(
        authService.resetPassword("test@example.com"),
      ).rejects.toThrow("Rate limit exceeded");
    });
  });

  describe("getSession", () => {
    it("maps an existing Supabase session to AuthSession", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { id: "user-abc", email: "session@example.com" },
            access_token: "access-session",
            refresh_token: "refresh-session",
            expires_at: 2000000000,
          },
        },
        error: null,
      });

      const session = await authService.getSession();

      expect(session).toEqual({
        userId: "user-abc",
        email: "session@example.com",
        accessToken: "access-session",
        refreshToken: "refresh-session",
        expiresAt: 2000000000,
      });
    });

    it("returns null when no session exists", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const session = await authService.getSession();

      expect(session).toBeNull();
    });

    it("throws when Supabase returns an error", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Token refresh failed" },
      });

      await expect(authService.getSession()).rejects.toThrow(
        "Token refresh failed",
      );
    });
  });

  describe("onAuthStateChange", () => {
    it("subscribes to auth state changes and returns unsubscribe function", () => {
      const mockUnsubscribe = vi.fn();
      mockOnAuthStateChange.mockReturnValue({
        data: {
          subscription: { unsubscribe: mockUnsubscribe },
        },
      });

      const callback = vi.fn();
      const unsubscribe = authService.onAuthStateChange(callback);

      /** Verify the callback was passed to Supabase */
      expect(mockOnAuthStateChange).toHaveBeenCalledWith(expect.any(Function));

      /** Verify we got back an unsubscribe function */
      expect(typeof unsubscribe).toBe("function");

      /** Call unsubscribe and verify it calls Supabase's unsubscribe */
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it("maps Supabase session to AuthSession in the callback", () => {
      /**
       * Capture the callback that our service passes to Supabase
       * so we can invoke it manually and check the mapping.
       */
      let capturedCallback: (
        event: string,
        session: unknown,
      ) => void = () => {};
      mockOnAuthStateChange.mockImplementation(
        (cb: (event: string, session: unknown) => void) => {
          capturedCallback = cb;
          return {
            data: {
              subscription: { unsubscribe: vi.fn() },
            },
          };
        },
      );

      const userCallback = vi.fn();
      authService.onAuthStateChange(userCallback);

      /** Simulate Supabase firing a SIGNED_IN event */
      capturedCallback("SIGNED_IN", {
        user: { id: "user-event", email: "event@example.com" },
        access_token: "access-event",
        refresh_token: "refresh-event",
        expires_at: 2100000000,
      });

      /** Verify our callback received the mapped AuthSession */
      expect(userCallback).toHaveBeenCalledWith({
        userId: "user-event",
        email: "event@example.com",
        accessToken: "access-event",
        refreshToken: "refresh-event",
        expiresAt: 2100000000,
      });
    });

    it("passes null to callback when session is null (signed out)", () => {
      let capturedCallback: (
        event: string,
        session: unknown,
      ) => void = () => {};
      mockOnAuthStateChange.mockImplementation(
        (cb: (event: string, session: unknown) => void) => {
          capturedCallback = cb;
          return {
            data: {
              subscription: { unsubscribe: vi.fn() },
            },
          };
        },
      );

      const userCallback = vi.fn();
      authService.onAuthStateChange(userCallback);

      /** Simulate Supabase firing a SIGNED_OUT event */
      capturedCallback("SIGNED_OUT", null);

      expect(userCallback).toHaveBeenCalledWith(null);
    });
  });
});
